#!/usr/bin/env python3

import datetime
import logging
import os
import re
import traceback
from logging.handlers import SMTPHandler
from typing import Dict, Union, Any, Optional, List
from uuid import uuid4

import pynmrstar
import requests
import simplejson as json
from dns.exception import Timeout
from dns.resolver import NXDOMAIN
from flask import Flask, request, jsonify, url_for, redirect, send_file, send_from_directory, Response
from flask_mail import Mail, Message
from itsdangerous import URLSafeSerializer, BadSignature
from validate_email import validate_email
from werkzeug.datastructures import FileStorage

from bmrbdep import depositions
from bmrbdep.common import configuration, get_schema, root_dir, secure_filename, get_release
from bmrbdep.exceptions import ServerError, RequestError

# Set up the flask application
application = Flask(__name__)

# Set debug if running from command line
if application.debug or configuration['debug']:
    from flask_cors import CORS

    configuration['debug'] = True
    CORS(application)

application.secret_key = configuration['secret_key']

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

    response = jsonify(exception.to_dict())
    response.status_code = exception.status_code
    return response


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
        response = jsonify({"error": "Server error."})
        response.status_code = 500
        return response


@application.route('/')
@application.route('/<filename>')
def send_local_file(filename: str = None) -> Response:
    if filename is None:
        filename = "index.html"

    no_container_path = os.path.join(root_dir, '..', '..', 'FrontEnd', 'dist')
    container_path = os.path.join(root_dir, 'html')
    if os.path.exists(no_container_path):
        return send_from_directory(no_container_path, filename)
    elif os.path.exists(container_path):
        return send_from_directory(container_path, filename)
    else:
        return Response('Broken installation. The Angular HTML/JS/CSS files are missing from the docker container. ')


@application.route('/deposition/<uuid:uuid>/check-valid')
def send_validation_status(uuid) -> Response:
    """ Returns whether or not an entry has been validated. """

    with depositions.DepositionRepo(str(uuid)) as repo:
        return jsonify({'status': repo.metadata['email_validated']})


@application.route('/deposition/<uuid:uuid>/resend-validation-email')
def send_validation_email(uuid) -> Response:
    """ Sends the validation e-mail. """

    uuid = str(uuid)

    with depositions.DepositionRepo(uuid) as repo:
        # Already validated, don't re-send the email
        if repo.metadata['email_validated']:
            return jsonify({'status': 'validated'})
        # Ask them to confirm their e-mail
        confirm_message = Message("Please validate your e-mail address for BMRBDep deposition '%s'." %
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
    except (BadSignature, KeyError, TypeError):
        raise RequestError('Invalid e-mail validation token. Please request a new e-mail validation message.')

    with depositions.DepositionRepo(deposition_id) as repo:
        if not repo.metadata['email_validated']:
            repo.metadata['email_validated'] = True
            repo.commit("E-mail validated.")

    return redirect('/entry/load/%s' % deposition_id, code=302)


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

    author_email: str = request_info.get('email', '')
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
            elif not validate_email(author_email, verify=True, sending_email='webmaster@bmrb.wisc.edu', smtp_timeout=3):
                raise RequestError("The e-mail you provided is invalid. That e-mail address does not exist at that "
                                   "server. (Do you have a typo in the e-mail address before the @?) If you are certain"
                                   " that your e-mail is correct, please select the 'My e-mail is correct' checkbox "
                                   "and click to start a new deposition again.")
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
    schema: pynmrstar.Schema = pynmrstar.Schema(get_schema(configuration['schema_version'], schema_format='xml'))
    json_schema: dict = get_schema(configuration['schema_version'])
    entry_template: pynmrstar.Entry = pynmrstar.Entry.from_template(entry_id=deposition_id, all_tags=True,
                                                                    default_values=True, schema=schema)

    def sort_saveframes(l):
        """ Sort the given iterable in the way that humans expect.

        Via: https://stackoverflow.com/questions/2669059/how-to-sort-alpha-numeric-set-in-python"""

        def convert(text):
            return int(text) if text.isdigit() else text

        def alphanum_key(key):
            return [convert(c) for c in re.split('([0-9]+)', key.name)]

        return sorted(l, key=alphanum_key)

    # Merge the entries
    if uploaded_entry:
        # Rename the saveframes in the uploaded entry before merging them
        for category in uploaded_entry.category_list:
            for x, saveframe in enumerate(sort_saveframes(uploaded_entry.get_saveframes_by_category(category))):
                # Set the "Name" tag if it isn't already set
                if (saveframe.tag_prefix + '.name').lower() in schema.schema:
                    try:
                        saveframe.add_tag('Name', saveframe['sf_framecode'][0].replace("_", " "), update=False)
                    except ValueError:
                        pass
                new_name = "%s_%s" % (saveframe.category, x + 1)
                if saveframe.name != new_name:
                    uploaded_entry.rename_saveframe(saveframe.name, new_name)

    # Merge the entries
    if uploaded_entry:
        for category in uploaded_entry.category_list:
            delete_saveframes = entry_template.get_saveframes_by_category(category)
            for saveframe in delete_saveframes:
                if saveframe.category == "entry_interview":
                    continue
                del entry_template[saveframe]
            for saveframe in uploaded_entry.get_saveframes_by_category(category):
                # Don't copy over the entry interview at all
                if saveframe.category == "entry_interview":
                    continue
                new_saveframe = pynmrstar.Saveframe.from_template(category, name=saveframe.name, entry_id=deposition_id,
                                                                  default_values=True, schema=schema, all_tags=True)
                frame_prefix_lower = saveframe.tag_prefix.lower()

                # Don't copy the tags from entry_information
                if saveframe.category != "entry_information":
                    for tag in saveframe.tags:
                        lower_tag = tag[0].lower()
                        if lower_tag not in ['sf_category', 'sf_framecode', 'id', 'entry_id', 'nmr_star_version',
                                             'original_nmr_star_version', 'atomic_coordinate_file_name',
                                             'atomic_coordinate_file_syntax', 'constraint_file_name']:
                            fqtn = frame_prefix_lower + '.' + lower_tag
                            if fqtn in schema.schema:
                                new_saveframe.add_tag(tag[0], tag[1], update=True)

                for loop in saveframe.loops:
                    # Don't copy the experimental data loops
                    if loop.category == "_Upload_data" in loop.tags:
                        continue
                    lower_tags = [_.lower() for _ in loop.tags]
                    tags_to_pull = [_ for _ in new_saveframe[loop.category].tags if _.lower() in lower_tags]
                    filtered_original_loop = loop.filter(tags_to_pull)
                    filtered_original_loop.add_missing_tags(schema=schema, all_tags=True)
                    new_saveframe[filtered_original_loop.category] = filtered_original_loop

                entry_template.add_saveframe(new_saveframe)

        # Strip off any loop Entry_ID tags from the original entry
        for saveframe in entry_template.frame_list:
            for loop in saveframe:
                for tag in loop.tags:
                    fqtn = (loop.category + "." + tag).lower()
                    try:
                        tag_schema = schema.schema[fqtn]
                        if tag_schema['Natural foreign key'] == '_Entry.ID':
                            loop[tag] = [None] * len(loop[tag])
                    except KeyError:
                        pass

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
    entry_information: pynmrstar.Saveframe = entry_template.get_saveframes_by_category('entry_information')[0]
    entry_information['NMR_STAR_version'] = schema.version
    entry_information['Original_NMR_STAR_version'] = schema.version

    # Suggest some default sample conditions
    sample_conditions: pynmrstar.Loop = entry_template.get_loops_by_category('_Sample_condition_variable')[0]
    if sample_conditions.empty:
        sample_conditions.data = [[None for _ in range(len(sample_conditions.tags))] for _ in range(4)]
        sample_conditions['Type'] = ['temperature', 'pH', 'pressure', 'ionic strength']
        sample_conditions['Val'] = [None, None, '1', None]
        sample_conditions['Val_units'] = ['K', 'pH', 'atm', 'M']

    entry_saveframe: pynmrstar.Saveframe = entry_template.get_saveframes_by_category("entry_information")[0]

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
        if 'orcid' not in configuration:
            logging.warning('Please specify your ORCID API credentials, or else auto-filling from ORCID will fail.')
        else:
            r = requests.get(configuration['orcid']['url'] % author_orcid,
                             headers={"Accept": "application/json",
                                      'Authorization': 'Bearer %s' % configuration['orcid']['bearer']})
            if not r.ok:
                if r.status_code == 404:
                    raise RequestError('Invalid ORCID!')
                else:
                    application.logger.exception('An error occurred while contacting the ORCID server.')
            orcid_json = r.json()
            author_given = orcid_json['person']['name']['given-names']['value']
            author_family = orcid_json['person']['name']['family-name']['value']

            contact_loop.data[0][contact_loop.tag_index('ORCID')] = author_orcid
            contact_loop.data[0][contact_loop.tag_index('Given_name')] = author_given
            contact_loop.data[0][contact_loop.tag_index('Family_name')] = author_family

    # Set the loops to have at least one row of data
    for saveframe in entry_template:

        # Add a "deleted" tag to use to track deletion status
        saveframe.add_tag('_Deleted', 'no')

        for loop in saveframe:
            if not loop.data:
                loop.data = []

                iterations: int = 1
                if "Experiment_ID" in loop.tags:
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
    send_validation_email(deposition_id)

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
            message = Message("BMRBdep: BMRB entry %s has been deposited." % bmrb_num,
                              recipients=[configuration['smtp']['annotator_address']])
            message.body = '''The following new entry has been deposited via BMRBdep:

restart id:            %s
bmrb accession number: %s

title: %s

contact persons: %s
''' % (uuid, bmrb_num, final_entry['entry_information_1']['Title'][0], contact_full)
        mail.send(message)

    return jsonify({'commit': repo.last_commit})


@application.route('/deposition/<uuid:uuid>/file/<filename>', methods=('GET', 'DELETE'))
def file_operations(uuid, filename: str) -> Response:
    """ Either retrieve or delete a file. """

    if request.method == "GET":
        with depositions.DepositionRepo(uuid) as repo:
            return send_file(repo.get_file(filename, root=False),
                             attachment_filename=secure_filename(filename))
    elif request.method == "DELETE":
        with depositions.DepositionRepo(uuid) as repo:
            repo.delete_data_file(filename)
            repo.commit('Deleted file %s' % filename)
        return jsonify({'commit': repo.last_commit})
    else:
        raise ServerError('If you see this, then somebody changed the allowed methods without changing the logic.')


@application.route('/deposition/<uuid:uuid>/file', methods=('POST',))
def store_file(uuid) -> Response:
    """ Stores a data file based on uuid. """

    file_obj: Optional[FileStorage] = request.files.get('file', None)

    if not file_obj or not file_obj.filename:
        raise RequestError('No file uploaded!')

    # Store a data file
    with depositions.DepositionRepo(uuid) as repo:
        filename = repo.write_file(file_obj.filename, file_obj.read())

        # Update the entry data
        if repo.commit("User uploaded file: %s" % filename):
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

            if repo.last_commit != entry_json['commit']:
                if 'force' not in entry_json:
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
        entry['commit'] = commit

        return jsonify(entry)
