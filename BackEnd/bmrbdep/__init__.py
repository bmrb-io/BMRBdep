#!/usr/bin/env python3

import datetime
import logging
import os
import socket
import traceback
from logging.handlers import SMTPHandler
from typing import Dict, Union, Any, Optional, List
from uuid import uuid4

import pynmrstar
import requests
import simplejson as json
import werkzeug.exceptions
from dns.exception import Timeout
from dns.resolver import NXDOMAIN
from flask import Flask, request, jsonify, url_for, redirect, send_file, send_from_directory, Response
from flask_mail import Mail, Message
from itsdangerous import URLSafeSerializer
from itsdangerous.exc import BadData
from validate_email import validate_email
from werkzeug.datastructures import FileStorage

from bmrbdep import depositions
from bmrbdep.common import configuration, get_schema, root_dir, secure_filename, get_release
from bmrbdep.depositions import DepositionRepo
from bmrbdep.exceptions import ServerError, RequestError
from bmrbdep.helpers.star_tools import merge_entries

application = Flask(__name__)

# Set debug if running from command line
if application.debug or configuration['debug']:
    from flask_cors import CORS

    configuration['debug'] = True
    CORS(application)

application.secret_key = configuration['secret_key']
assert application.secret_key != "CHANGE_ME"

# Set up the mail interface
application.config.update(
    MAIL_SERVER=configuration['smtp']['server'],
    MAIL_DEFAULT_SENDER=configuration['smtp']['from_address']
)
mail = Mail(application)

# Set up the SMTP error handler
if configuration['smtp'].get('server') != 'CHANGE_ME':

    # Don't send error e-mails in debugging mode
    if not configuration['debug']:
        mail_handler = SMTPHandler(mailhost=configuration['smtp']['server'],
                                   fromaddr=configuration['smtp']['from_address'],
                                   toaddrs=configuration['smtp']['admins'],
                                   subject='BMRB API Error occurred')
        mail_handler.setLevel(logging.WARNING)
        application.logger.addHandler(mail_handler)

else:
    logging.warning("Could not set up SMTP logger because the configuration"
                    " was not specified.")


    class MockMail:
        @staticmethod
        def send(message):
            logging.info('Would have sent e-mail:\n%s', message.html)


    mail = MockMail()

# Set up the logger
if configuration['debug']:
    logging.basicConfig(format='%(asctime)s %(levelname)-8s [%(filename)s:%(lineno)d] %(message)s')
    logging.getLogger().setLevel('INFO')
else:
    logging.getLogger().setLevel('WARNING')


# Set up error handling
@application.errorhandler(ServerError)
@application.errorhandler(RequestError)
def handle_our_errors(exception: Union[ServerError, RequestError]):
    """ Handles exceptions we raised ourselves. """

    logging.warning("A handled exception was thrown! Exception: %s" % exception)

    # Send a message to the admin on ServerError
    if isinstance(exception, ServerError) and not configuration['debug']:
        message = Message("A BMRBdep ServerException happened!", recipients=configuration['smtp']['admins'])
        message.body = "Exception raised on request %s %s\n\n%s" % \
                       (request.method, request.url, traceback.format_exc())
        mail.send(message)

    response = jsonify(exception.to_dict())
    response.status_code = exception.status_code
    return response


@application.errorhandler(werkzeug.exceptions.MethodNotAllowed)
def handle_wrong_method(exception: werkzeug.exceptions.MethodNotAllowed):
    logging.warning('Someone is vulnerability scanning us. Method that was'
                    f' scanned: {request.method}:{request.url}')
    return Response('🤨', status=404)


@application.errorhandler(Exception)
def handle_other_errors(exception: Exception):
    """ Catches any other exceptions and formats them. Only
    displays the actual error to local clients (to prevent disclosing
    issues that could be security vulnerabilities)."""

    logging.exception("An unhandled exception was thrown! Exception: %s" % exception)

    def check_local_ip() -> bool:
        """ Checks if the given IP is a local user."""

        for local_address in configuration['local-ips']:
            if request.remote_addr.startswith(local_address):
                return True

        return False

    if check_local_ip():
        return Response("NOTE: You are seeing this error because your IP was "
                        "recognized as a local IP:\n%s" %
                        traceback.format_exc(), mimetype="text/plain")
    else:
        # Send a message to the admin
        if not configuration['debug']:
            message = Message("An unhandled BMRBdep exception happened!", recipients=configuration['smtp']['admins'])
            message.body = "Exception raised on request %s %s\n\n%s" % \
                           (request.method, request.url, traceback.format_exc())
            mail.send(message)

        response = jsonify({"error": "An exception has been triggered on the BMRBdep server. This error has been sent "
                                     "to BMRB staff to investigate. If you were attempting to deposit when this error "
                                     "occurred, expect us to reach out to you within one business day."})
        response.status_code = 500
        return response


@application.route('/')
@application.route('/<path:filename>', methods=['GET'])
def send_local_file(filename: str = None) -> Response:
    if filename is None:
        filename = "index.html"

    angular_path: str = os.path.join(root_dir, '..', '..', 'FrontEnd', 'dist')
    if not os.path.exists(angular_path):
        angular_path = os.path.join(root_dir, '..', 'dist')
    if not os.path.exists(angular_path):
        return Response('Broken installation. The Angular HTML/JS/CSS files are missing from the docker container. ')

    if not os.path.exists(os.path.join(angular_path, filename)):
        filename = 'index.html'

    return send_from_directory(angular_path, filename)


@application.route('/deposition/<uuid:uuid>/check-valid')
def send_validation_status(uuid) -> Response:
    """ Returns whether or not an entry has been validated. """

    with depositions.DepositionRepo(str(uuid)) as repo:
        return jsonify({'status': repo.metadata['email_validated'],
                        'commit': repo.last_commit})


@application.route('/deposition/<uuid:uuid>/resend-validation-email')
def send_validation_email(uuid, repo_object: Optional[DepositionRepo] = None) -> Response:
    """ Sends the validation e-mail. """

    uuid = str(uuid)

    if not repo_object:
        repo_object = depositions.DepositionRepo(uuid)

    with repo_object as repo:
        # Already validated, don't re-send the email
        if repo.metadata['email_validated']:
            # Ask them to confirm their e-mail
            confirm_message = Message("Entry reference for BMRBDep deposition '%s'." %
                                      repo.metadata['deposition_nickname'],
                                      recipients=[repo.metadata['author_email']],
                                      reply_to=configuration['smtp']['reply_to_address'])
            token = URLSafeSerializer(configuration['secret_key']).dumps({'deposition_id': uuid})

            confirm_message.html = """
            Thank you for your deposition '%s' created %s (UTC).
            <br><br>
            To return to this deposition, click <a href="%s" target="BMRBDep">here</a>.
            <br><br>
            If you wish to share access with collaborators, simply forward them this e-mail. Be aware that anyone you
            share this e-mail with will have access to the full contents of your in-progress deposition and can make
            changes to it.

            If you are using a shared computer, please ensure that you click the "End Session" button in the left panel menu when
            leaving the computer. (You can always return to it using the link above.) If you fail to do so, others who use your
            computer could access your in-process deposition.
            <br><br>
            Thank you,
            <br>
            BMRBDep System""" % (repo.metadata['deposition_nickname'], repo.metadata['creation_date'],
                                 url_for('validate_user', token=token, _external=True))

            try:
                mail.send(confirm_message)
            except socket.gaierror:
                if configuration['debug']:
                    logging.warning('Invalid SMTP server configured!')
                else:
                    raise ServerError('Server is mis-configured, please contact the administrator.')
            return jsonify({'status': 'validated'})


        # Ask them to confirm their e-mail
        confirm_message = Message("Please validate your e-mail address for BMRBdep deposition '%s'." %
                                  repo.metadata['deposition_nickname'],
                                  recipients=[repo.metadata['author_email']],
                                  reply_to=configuration['smtp']['reply_to_address'])
        token = URLSafeSerializer(configuration['secret_key']).dumps({'deposition_id': uuid})

        confirm_message.html = """
Thank you for your deposition '%s' created %s (UTC).
<br><br>
Please click <a href="%s" target="BMRBDep">here</a> to validate your e-mail for this session. This is required to 
proceed. You can also use this link to return to your deposition later if you close the page before
it is complete.
<br><br>
If you wish to share access with collaborators, simply forward them this e-mail. Be aware that anyone you
share this e-mail with will have access to the full contents of your in-progress deposition and can make
changes to it.

If you are using a shared computer, please ensure that you click the "End Session" button in the left panel menu when
leaving the computer. (You can always return to it using the link above.) If you fail to do so, others who use your
computer could access your in-process deposition.
<br><br>
Thank you,
<br>
BMRBDep System""" % (repo.metadata['deposition_nickname'], repo.metadata['creation_date'],
                     url_for('validate_user', token=token, _external=True))

        mail.send(confirm_message)

    return jsonify({'status': 'unvalidated'})


@application.route('/deposition/validate_email/<token>')
def validate_user(token: str):
    """ Perform validation of user-email and then redirect to the entry loader URL. """

    serializer = URLSafeSerializer(application.config['SECRET_KEY'])
    try:
        deposition_data = serializer.loads(token)
        deposition_id = deposition_data['deposition_id']
    except (BadData, KeyError, TypeError):
        raise RequestError('Invalid e-mail validation token. Please request a new e-mail validation message.')

    with depositions.DepositionRepo(deposition_id) as repo:
        if not repo.metadata['email_validated']:
            repo.metadata['email_validated'] = True
            repo.commit("E-mail validated.")

    return redirect('/entry/load/%s' % deposition_id, code=302)


@application.route('/deposition/<uuid:uuid>/duplicate', methods=('POST',))
def duplicate_deposition(uuid) -> Response:
    """ Starts a new deposition from an existing deposition. """

    request_info: Dict[str, Any] = request.form

    # Create the deposition
    deposition_id = str(uuid4())
    schema_name = configuration['schema_version']
    if request_info.get('deposition_type', 'macromolecule') == "small molecule":
        schema_name += "-sm"
    schema: pynmrstar.Schema = pynmrstar.Schema(get_schema(schema_name, schema_format='xml'))
    json_schema: dict = get_schema(schema_name)
    entry_template: pynmrstar.Entry = pynmrstar.Entry.from_template(entry_id=deposition_id, all_tags=True,
                                                                    default_values=True, schema=schema)

    with depositions.DepositionRepo(uuid, read_only=True) as repo:
        merge_entries(entry_template, repo.get_entry(), schema, preserve_entry_information=True)

        # This shouldn't be necessary for modern entries, since they will already have the '_Deleted' tag
        #  But keep it in place for a while (until 2022?) in case people clone any old entries which are missing
        #   the tag. Alternatively, search for and fix all old entries with saveframes missing the '_Deleted' tag
        for saveframe in entry_template:
            if '_Deleted' not in saveframe or saveframe['_Deleted'] in pynmrstar.utils.definitions.NULL_VALUES:
                saveframe.add_tag('_Deleted', 'no', update=True)

        with depositions.DepositionRepo(deposition_id, initialize=True) as new_repo:
            new_repo._live_metadata = {'deposition_id': deposition_id,
                                       'author_email': repo.metadata['author_email'],
                                       'author_orcid': repo.metadata['author_orcid'],
                                       'last_ip': request.environ['REMOTE_ADDR'],
                                       'deposition_origination': {'request': dict(request.headers),
                                                                  'ip': request.environ['REMOTE_ADDR']},
                                       'email_validated': repo.metadata['email_validated'],
                                       'schema_version': schema.version,
                                       'entry_deposited': False,
                                       'server_version_at_creation': get_release(),
                                       'creation_date': datetime.datetime.utcnow().strftime("%I:%M %p on %B %d, %Y"),
                                       'deposition_nickname': request_info['deposition_nickname'],
                                       'deposition_from_file': False,
                                       'deposition_cloned_from': str(uuid)
                                       }
            new_repo.write_entry(entry_template)
            new_repo.write_file('schema.json', json.dumps(json_schema).encode(), root=True)
            # Delete data files when cloning
            for file_ in new_repo.get_data_file_list():
                new_repo.delete_data_file(file_)
            new_repo.commit('Creating new deposition from existing deposition %s' % uuid)
            send_validation_email(deposition_id, new_repo)

    return jsonify({'deposition_id': deposition_id})


@application.route('/deposition/new', methods=('POST',))
def new_deposition() -> Response:
    """ Starts a new deposition. """

    request_info: Dict[str, Any] = request.form

    if not request_info or 'email' not in request_info:
        raise RequestError("Must specify user e-mail to start a session.")

    if 'deposition_nickname' not in request_info:
        raise RequestError("Must specify a nickname for the deposition.")

    skip_email_validation = False
    if 'skip_validation' in request_info:
        skip_email_validation = True

    uploaded_entry: Optional[pynmrstar.Entry] = None
    entry_bootstrap: bool = False
    if 'nmrstar_file' in request.files and request.files['nmrstar_file'] and request.files['nmrstar_file'].filename:
        try:
            uploaded_entry = pynmrstar.Entry.from_string(request.files['nmrstar_file'].read().decode())
        except pynmrstar.exceptions.ParsingError as e:
            raise RequestError("Invalid NMR-STAR file: %s" % repr(e))
        except UnicodeDecodeError:
            raise RequestError("Invalid uploaded file. It is not an ASCII file.")
    # Check if they are bootstrapping from an existing entry - if so, make sure they didn't also upload a file
    if 'bootstrapID' in request_info and request_info['bootstrapID'] != 'null':
        if uploaded_entry:
            raise RequestError('Cannot create an entry from an uploaded file and existing entry.')
        try:
            uploaded_entry = pynmrstar.Entry.from_database(request_info['bootstrapID'])
        except IOError:
            raise RequestError('Invalid entry ID specified. No such entry exists, or is released.')
        entry_bootstrap = True

    author_email: str = request_info.get('email', '').lower()
    author_orcid: Optional[str] = request_info.get('orcid')
    if not author_orcid:
        author_orcid = None

    # Check the e-mail
    if not skip_email_validation:
        try:
            if not validate_email(author_email):
                raise RequestError("The e-mail you provided is not a valid e-mail. Please check the e-mail you "
                                   "provided for typos.")
            elif not validate_email(author_email, check_mx=True, smtp_timeout=3):
                raise RequestError("The e-mail you provided is invalid. There is no e-mail server at '%s'. (Do you "
                                   "have a typo in the part of your e-mail after the @?) If you are certain"
                                   " that your e-mail is correct, please select the 'My e-mail is correct' checkbox "
                                   "and click to start a new deposition again." %
                                   (author_email[author_email.index("@") + 1:]))
        except Timeout:
            raise RequestError("The e-mail you provided is invalid. There was no response when attempting to connect "
                               "to the server at %s. If you are certain that your e-mail is correct, please select the"
                               " 'My e-mail is correct' checkbox and click to start a new deposition again."
                               % author_email[author_email.index("@") + 1:])
        except NXDOMAIN:
            raise RequestError("The e-mail you provided is invalid. The domain '%s' is not a valid domain." %
                               author_email[author_email.index("@") + 1:])

    # Create the deposition
    deposition_id = str(uuid4())
    schema_name = configuration['schema_version']
    if request_info.get('deposition_type', 'macromolecule') == "small molecule":
        schema_name += "-sm"
    schema: pynmrstar.Schema = pynmrstar.Schema(get_schema(schema_name, schema_format='xml'))
    json_schema: dict = get_schema(schema_name)
    entry_template: pynmrstar.Entry = pynmrstar.Entry.from_template(entry_id=deposition_id, all_tags=True,
                                                                    default_values=True, schema=schema)

    # Merge the entries
    if uploaded_entry:
        merge_entries(entry_template, uploaded_entry, schema)

    # Delete the large data loops after merging, if the entry was uploaded and may have them
    if uploaded_entry:
        for saveframe in entry_template:
            for loop in saveframe:
                if loop.category in ['_Atom_chem_shift', '_Atom_site', '_Gen_dist_constraint']:
                    loop.data = []

    # Calculate the uploaded file types, if they upload a file
    if uploaded_entry and not entry_bootstrap:
        data_file_loop: pynmrstar.Loop = pynmrstar.Loop.from_scratch()
        data_file_loop.add_tag(['_Upload_data.Data_file_ID',
                                '_Upload_data.Deposited_data_files_ID',
                                '_Upload_data.Data_file_name',
                                '_Upload_data.Data_file_content_type',
                                '_Upload_data.Data_file_Sf_category'])
        upload_filename: str = secure_filename(request.files['nmrstar_file'].filename)

        # Get the categories types which are "data types"
        legal_data_categories: dict = dict()
        for data_upload_record in json_schema['file_upload_types']:
            for one_data_type in data_upload_record[1]:
                legal_data_categories[one_data_type] = data_upload_record[0]

        # If this entry has categories that are valid data types, add them
        pos: int = 1
        for data_type in uploaded_entry.category_list:
            if data_type in legal_data_categories:
                if data_type != 'chem_comp' and data_type != 'experiment_list':
                    data_file_loop.add_data([pos, 1, upload_filename, legal_data_categories[data_type], data_type])
                    pos += 1
        data_file_loop.add_missing_tags(all_tags=True, schema=schema)
        entry_template.get_saveframes_by_category('deposited_data_files')[0]['_Upload_data'] = data_file_loop

    entry_template.normalize(schema=schema)

    # Set the entry information tags
    entry_saveframe: pynmrstar.Saveframe = entry_template.get_saveframes_by_category('entry_information')[0]
    entry_saveframe['NMR_STAR_version'] = schema.version
    entry_saveframe['Original_NMR_STAR_version'] = schema.version

    # Suggest some default sample conditions
    sample_conditions: pynmrstar.Loop = entry_template.get_loops_by_category('_Sample_condition_variable')[0]
    if sample_conditions.empty:
        sample_conditions.data = [[None for _ in range(len(sample_conditions.tags))] for _ in range(4)]
        sample_conditions['Type'] = ['temperature', 'pH', 'pressure', 'ionic strength']
        sample_conditions['Val'] = [None, None, '1', None]
        sample_conditions['Val_units'] = ['K', 'pH', 'atm', 'M']

    # Just add a single row to the entry author loop
    author_loop: pynmrstar.Loop = entry_saveframe['_Entry_author']
    author_loop.data.insert(0, ['.'] * len(author_loop.tags))

    # Modify the contact_loop as needed
    contact_loop: pynmrstar.Loop = entry_saveframe['_Contact_person']

    # Make sure that whoever started the deposition is locked as the first contact person
    contact_emails: List[str] = contact_loop.get_tag('email_address')
    if author_email in contact_emails:
        # They are already there, move their data to the first row and update it if necessary
        contact_loop.data.insert(0, contact_loop.data.pop(contact_emails.index(author_email)))
    else:
        # They are not yet present in the contact persons
        contact_loop.data.insert(0, ['.'] * len(contact_loop.tags))
        contact_loop.data[0][contact_loop.tag_index('Email_address')] = author_email
    # Need to be 2 contact authors
    if len(contact_loop.data) < 2:
        contact_loop.data.append(['.'] * len(contact_loop.tags))
    contact_loop.renumber_rows('ID')

    # Look up information based on the ORCID
    if author_orcid:
        contact_loop.data[0][contact_loop.tag_index('ORCID')] = author_orcid
        if 'orcid' not in configuration or configuration['orcid']['bearer'] == 'CHANGEME':
            logging.warning('Please specify your ORCID API credentials, or else auto-filling from ORCID will fail.')
        else:
            try:
                r = requests.get(configuration['orcid']['url'] % author_orcid,
                                 headers={"Accept": "application/json",
                                          'Authorization': 'Bearer %s' % configuration['orcid']['bearer']})
            except (requests.exceptions.ConnectionError, requests.exceptions.ConnectTimeout):
                raise ServerError('An error occurred while contacting the ORCID server.')
            if not r.ok:
                if r.status_code == 404:
                    raise RequestError('Invalid ORCID!')
                else:
                    raise ServerError('An error occurred while contacting the ORCID server.')
            else:
                orcid_json = r.json()
                try:
                    author_given = orcid_json['person']['name']['given-names']['value']
                except (TypeError, KeyError):
                    author_given = None
                try:
                    author_family = orcid_json['person']['name']['family-name']['value']
                except (TypeError, KeyError):
                    author_family = None
                contact_loop.data[0][contact_loop.tag_index('Given_name')] = author_given
                contact_loop.data[0][contact_loop.tag_index('Family_name')] = author_family

    # Set the loops to have at least one row of data
    for saveframe in entry_template:

        # Add a "deleted" tag to use to track deletion status
        saveframe.add_tag('_Deleted', 'no', update=True)

        for loop in saveframe:
            if not loop.data:
                loop.data = []

                iterations: int = 1
                if "Experiment_ID" in loop.tags or loop.category == '_Sample_component':
                    iterations = 3

                for x in range(1, iterations + 1):
                    row_data = []
                    for tag in loop.tags:
                        fqtn = (loop.category + '.' + tag).lower()
                        if tag == "ID":
                            row_data.append(x)
                        elif schema.schema[fqtn]['default value'] not in ["?", '']:
                            row_data.append(schema.schema[fqtn]['default value'])
                        else:
                            row_data.append('.')
                    loop.data.append(row_data)

    # Set the entry_interview tags
    entry_interview: pynmrstar.Saveframe = entry_template.get_saveframes_by_category('entry_interview')[0]
    for tag in json_schema['file_upload_types']:
        entry_interview[tag[2]] = "no"
    entry_interview['PDB_deposition'] = "no"
    entry_interview['BMRB_deposition'] = "yes"
    # Set the tag to store that this entry was bootstrapped
    if entry_bootstrap:
        entry_interview['Previous_BMRB_entry_used'] = request_info['bootstrapID']

    entry_meta: dict = {'deposition_id': deposition_id,
                        'author_email': author_email,
                        'author_orcid': author_orcid,
                        'last_ip': request.environ['REMOTE_ADDR'],
                        'deposition_origination': {'request': dict(request.headers),
                                                   'ip': request.environ['REMOTE_ADDR']},
                        'email_validated': configuration['debug'],
                        'schema_version': schema.version,
                        'entry_deposited': False,
                        'server_version_at_creation': get_release(),
                        'creation_date': datetime.datetime.utcnow().strftime("%I:%M %p on %B %d, %Y"),
                        'deposition_nickname': request_info['deposition_nickname'],
                        'deposition_from_file': True if uploaded_entry else False}

    # Initialize the repo
    with depositions.DepositionRepo(deposition_id, initialize=True) as repo:
        # Manually set the metadata during object creation - never should be done this way elsewhere
        repo._live_metadata = entry_meta
        repo.write_entry(entry_template)
        repo.write_file('schema.json', json.dumps(json_schema).encode(), root=True)
        if uploaded_entry:
            if entry_bootstrap:
                entry_meta['bootstrap_entry'] = request_info['bootstrapID']
                repo.write_file('bootstrap_entry.str', str(uploaded_entry).encode(), root=True)
            else:
                request.files['nmrstar_file'].seek(0)
                repo.write_file('bootstrap_entry.str', request.files['nmrstar_file'].read(), root=True)
                entry_meta['bootstrap_filename'] = repo.write_file(request.files['nmrstar_file'].filename,
                                                                   str(uploaded_entry).encode())
        repo.commit("Entry created.")

        # Send the validation e-mail
        send_validation_email(deposition_id, repo)

    return jsonify({'deposition_id': deposition_id})


@application.route('/deposition/<uuid:uuid>/deposit', methods=('POST',))
def deposit_entry(uuid) -> Response:
    """ Complete the deposition. """

    if 'deposition_contents' not in request.form or not request.form['deposition_contents']:
        raise RequestError('No deposition submitted.')
    final_entry: pynmrstar.Entry = pynmrstar.Entry.from_string(request.form['deposition_contents'])

    with depositions.DepositionRepo(uuid) as repo:
        bmrb_num = repo.deposit(final_entry)

        # Send out the e-mails
        contact_emails: List[str] = final_entry.get_loops_by_category("_Contact_Person")[0].get_tag(['Email_address'])
        contact_full = ["%s %s <%s>" % tuple(x) for x in
                        final_entry.get_loops_by_category("_Contact_Person")[0].get_tag(
                            ['Given_name', 'Family_name', 'Email_address'])]
        message = Message("Your entry has been deposited!", recipients=contact_emails,
                          reply_to=configuration['smtp']['reply_to_address'])
        message.html = 'Thank you for your deposition! Your assigned BMRB ID is %s. We have attached a copy of the ' \
                       'deposition contents for reference. You may also use this file to start a new deposition. ' \
                       'You will hear from our annotators in the next few days. Please note that any data files that ' \
                       'you uploaded will be manually integrated into the final NMR-STAR file by the BMRB annotators ' \
                       '- their contents are not included in the NMR-STAR file attached to this e-mail.<br><br>' \
                       'Deposited data files: %s' % (bmrb_num, repo.get_data_file_list())
        message.attach("%s.str" % uuid, "text/plain", str(final_entry))
        mail.send(message)

        # Send a message to the annotators
        if not configuration['debug']:
            if isinstance(configuration['smtp']['annotator_address'], list):
                send_to = configuration['smtp']['annotator_address']
            else:
                send_to = [configuration['smtp']['annotator_address']]
            message = Message("BMRBdep: BMRB entry %s has been deposited." % bmrb_num, recipients=send_to)
            message.body = '''The following new entry has been deposited via BMRBdep:

restart id:            %s
bmrb accession number: %s

title: %s

contact persons: %s
''' % (uuid, bmrb_num, final_entry['entry_information_1']['Title'][0], contact_full)
        mail.send(message)

    return jsonify({'commit': repo.last_commit})


@application.route('/deposition/<uuid:uuid>/file/<path:path>', methods=('GET', 'DELETE'))
def file_operations(uuid, path: str) -> Response:
    """ Either retrieve or delete a file. """

    if request.method == "GET":
        with depositions.DepositionRepo(uuid, read_only=True) as repo:
            return send_file(repo.get_file(path, root=False), attachment_filename=path)
    elif request.method == "DELETE":
        with depositions.DepositionRepo(uuid) as repo:
            if repo.delete_data_file(path):
                repo.commit('Deleted file %s' % path)
        return jsonify({'commit': repo.last_commit})
    else:
        raise ServerError('If you see this, then somebody changed the allowed methods without changing the logic.')


@application.route('/deposition/<uuid:uuid>/file', methods=('POST',))
def store_file(uuid) -> Response:
    """ Stores a data file based on uuid. """

    file_obj: Optional[FileStorage] = request.files.get('file', None)
    relative_path = file_obj.filename

    if not file_obj or not file_obj.filename:
        raise RequestError('No file uploaded!')

    # Store a data file
    with depositions.DepositionRepo(uuid) as repo:
        filename = repo.write_file(relative_path, file_obj.read())

        # Update the entry data
        if repo.commit("User uploaded file: %s" % relative_path):
            return jsonify({'filename': filename, 'changed': True,
                            'commit': repo.last_commit})
        else:
            return jsonify({'filename': filename, 'changed': False,
                            'commit': repo.last_commit})


@application.route('/deposition/<uuid:uuid>', methods=('GET', 'PUT'))
def fetch_or_store_deposition(uuid):
    """ Fetches or stores an entry based on uuid """

    # Store an entry
    if request.method == "PUT":
        entry_json: dict = request.get_json()
        try:
            entry: pynmrstar.Entry = pynmrstar.Entry.from_json(entry_json)
        except ValueError:
            raise RequestError("Invalid JSON uploaded. The JSON was not a valid NMR-STAR entry.")

        with depositions.DepositionRepo(uuid) as repo:
            existing_entry: pynmrstar.Entry = repo.get_entry()

            # If they aren't making any changes
            try:
                if existing_entry == entry:
                    return jsonify({'commit': repo.last_commit})
            except ValueError as err:
                raise RequestError(repr(err))

            if existing_entry.entry_id != entry.entry_id:
                raise RequestError("Refusing to overwrite entry with entry of different ID.")

            # Next two lines can be removed after clients upgrade (06/01/2020)
            if isinstance(entry_json['commit'], str):
                entry_json['commit'] = [entry_json['commit']]

            if repo.last_commit not in entry_json['commit']:
                if 'force' not in entry_json:
                    logging.exception('An entry changed on the server!')
                    return jsonify({'error': 'reload'})

            # Update the entry data
            repo.write_entry(entry)
            repo.commit("Entry updated.")

            return jsonify({'commit': repo.last_commit})

    # Load an entry
    elif request.method == "GET":

        with depositions.DepositionRepo(uuid) as repo:
            entry: pynmrstar.Entry = repo.get_entry()
            schema_version: str = repo.metadata['schema_version']
            data_files: List[str] = repo.get_data_file_list()
            email_validated: bool = repo.metadata['email_validated']
            entry_deposited: bool = repo.metadata['entry_deposited']
            deposition_nickname: str = repo.metadata['deposition_nickname']
            commit: str = repo.last_commit
        try:
            schema: dict = get_schema(schema_version)
        except RequestError:
            raise ServerError("Entry specifies schema that doesn't exist on the server: %s" % schema_version)

        entry: dict = entry.get_json(serialize=False)
        entry['schema'] = schema
        entry['data_files'] = data_files
        entry['email_validated'] = email_validated
        entry['entry_deposited'] = entry_deposited
        entry['deposition_nickname'] = deposition_nickname
        entry['commit'] = [commit]

        return jsonify(entry)
