#!/usr/bin/env python3

import datetime
import logging
import os
import traceback
from logging.handlers import SMTPHandler
from typing import Dict, Union, Any, Optional, List
from uuid import uuid4

import pynmrstar
import requests
import simplejson as json
from flask import Flask, request, jsonify, url_for, redirect, send_file, send_from_directory, Response
from flask_mail import Mail, Message
from itsdangerous import URLSafeSerializer
from itsdangerous.exc import BadData
from werkzeug.datastructures import FileStorage

from bmrbdep import depositions
from bmrbdep.common import configuration, get_schema, root_dir, secure_filename, get_release
from bmrbdep.exceptions import ServerError, RequestError
# Set up the flask application
from bmrbdep.helpers.star_tools import merge_entries

application = Flask(__name__)
#files_index = AutoIndex(application, configuration['output_path'], add_url_rules=False)

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

    # Send a message to the admin on ServerError
    if isinstance(exception, ServerError) and not configuration['debug']:
        message = Message("A BMRBdep ServerException happened!", recipients=configuration['smtp']['admins'])
        message.body = "Exception raised on request %s %s\n\n%s" % \
                       (request.method, request.url, traceback.format_exc())
        mail.send(message)

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
        # Send a message to the admin
        if not configuration['debug']:
            message = Message("An unhandled BMRBdep exception happened!", recipients=configuration['smtp']['admins'])
            message.body = "Exception raised on request %s %s\n\n%s" % \
                           (request.method, request.url, traceback.format_exc())
            mail.send(message)

        response = jsonify({"error": "Server error."})
        response.status_code = 500
        return response


@application.route('/released/<int:entry_id>')
@application.route('/released/<int:entry_id>/<file_name>')
def released(entry_id: int, file_name=None):
    if file_name:
        return send_from_directory(os.path.join(configuration['output_path'], str(entry_id)), file_name)

    full_path = os.path.join(configuration['output_path'], str(entry_id))
    if not os.path.exists(full_path):
        return "Invalid entry ID."
    files = [f'<a href="{url_for("released", entry_id=entry_id, file_name=f)}">{f}</a>' for f in os.listdir(full_path)]
    if len(files) == 0:
        return "Invalid entry ID."
    return "<br>".join(files)


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
def send_validation_email(uuid) -> Response:
    """ Sends the validation e-mail. """

    uuid = str(uuid)

    with depositions.DepositionRepo(uuid) as repo:
        # Already validated, don't re-send the email
        if repo.metadata['email_validated']:
            # Ask them to confirm their e-mail
            confirm_message = Message("Entry reference for BMRbig deposition '%s'." %
                                      repo.metadata['deposition_nickname'],
                                      recipients=[repo.metadata['author_email']],
                                      reply_to=configuration['smtp']['reply_to_address'])
            token = URLSafeSerializer(configuration['secret_key']).dumps({'deposition_id': uuid})

            confirm_message.html = """
            Thank you for your deposition '%s' created %s (UTC).
            <br><br>
            To return to this deposition, click <a href="%s" target="BMRbig">here</a>.
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
            BMRbig System""" % (repo.metadata['deposition_nickname'], repo.metadata['creation_date'],
                                 url_for('validate_user', token=token, _external=True))

            mail.send(confirm_message)



            return jsonify({'status': 'validated'})


        # Ask them to confirm their e-mail
        confirm_message = Message("Please validate your e-mail address for BMRbig deposition '%s'." %
                                  repo.metadata['deposition_nickname'],
                                  recipients=[repo.metadata['author_email']],
                                  reply_to=configuration['smtp']['reply_to_address'])
        token = URLSafeSerializer(configuration['secret_key']).dumps({'deposition_id': uuid})

        confirm_message.html = """
Thank you for your deposition '%s' created %s (UTC).
<br><br>
Please click <a href="%s" target="BMRbig">here</a> to validate your e-mail for this session. This is required to 
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
BMRbig System""" % (repo.metadata['deposition_nickname'], repo.metadata['creation_date'],
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

    with depositions.DepositionRepo(uuid) as repo:
        merge_entries(entry_template, repo.get_entry(), schema)

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
            new_repo.commit('Creating new deposition from existing deposition %s' % uuid)

    return jsonify({'deposition_id': deposition_id})


@application.route('/deposition/newmicro', methods=('POST',))
def new_deposition_micro() -> Response:
    """ Starts a new micro deposition. """

    request_info: Dict[str, Any] = request.form

    if not request_info or 'email' not in request_info:
        raise RequestError("Must specify user e-mail to start a session.")

    if 'deposition_nickname' not in request_info:
        raise RequestError("Must specify a nickname for the deposition.")

    author_email: str = request_info['email'].lower()
    author_orcid: Optional[str] = request_info.get('orcid')
    if not author_orcid:
        author_orcid = None

    # Create the deposition
    deposition_id = str(uuid4())
    schema_name = configuration['schema_version']
    schema: pynmrstar.Schema = pynmrstar.Schema(get_schema(schema_name, schema_format='xml'))
    json_schema: dict = get_schema(schema_name)
    entry_template: pynmrstar.Entry = pynmrstar.Entry.from_scratch(deposition_id)
    entry_template.add_saveframe(pynmrstar.Saveframe.from_template('entry_interview', entry_id=deposition_id,
                                                                   all_tags=True, default_values=True, schema=schema))
    entry_template.add_saveframe(pynmrstar.Saveframe.from_template('deposited_data_files', entry_id=deposition_id,
                                                                   all_tags=True, default_values=True, schema=schema))
    entry_saveframe: pynmrstar.Saveframe = pynmrstar.Saveframe.from_template('entry_information',
                                                                             entry_id=deposition_id,
                                                                             all_tags=True, default_values=True,
                                                                             schema=schema)
    citation_saveframe: pynmrstar.Saveframe = pynmrstar.Saveframe.from_template('citations', entry_id=deposition_id,
                                                                                all_tags=True,
                                                                                default_values=True, schema=schema)
    entry_template.add_saveframe(entry_saveframe)
    entry_template.add_saveframe(citation_saveframe)

    # Set the entry information tags
    entry_saveframe: pynmrstar.Saveframe = entry_template.get_saveframes_by_category('entry_information')[0]
    entry_saveframe['NMR_STAR_version'] = schema.version
    entry_saveframe['Original_NMR_STAR_version'] = schema.version
    entry_saveframe['Title'] = request_info['deposition_nickname']
    entry_saveframe['Release_privacy'] = request_info['session_validity']
    citation_saveframe['Title'] = request_info['deposition_nickname']

    # Modify the contact_loop as needed
    contact_loop: pynmrstar.Loop = entry_saveframe['_Contact_person']
    contact_loop.data.insert(0, ['.'] * len(contact_loop.tags))
    contact_loop.data[0][contact_loop.tag_index('Email_address')] = author_email

    # Look up information based on the ORCID
    if author_orcid:
        contact_loop.data[0][contact_loop.tag_index('ORCID')] = author_orcid
        if 'orcid' not in configuration or configuration['orcid']['bearer'] == 'CHANGEME':
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
        saveframe.add_tag('_Deleted', 'no')

        for loop in saveframe:
            if not loop.data:
                row_data = []
                for tag in loop.tags:
                    fqtn = (loop.category + '.' + tag).lower()
                    if tag == "ID":
                        row_data.append(1)
                    elif schema.schema[fqtn]['default value'] not in ["?", '']:
                        row_data.append(schema.schema[fqtn]['default value'])
                    else:
                        row_data.append('.')
                loop.data = [row_data]

    entry_meta: dict = {'deposition_id': deposition_id,
                        'author_email': author_email,
                        'author_orcid': author_orcid,
                        'last_ip': request.environ['REMOTE_ADDR'],
                        'deposition_origination': {'request': dict(request.headers),
                                                   'ip': request.environ['REMOTE_ADDR']},
                        'email_validated': False,
                        'schema_version': schema.version,
                        'entry_deposited': False,
                        'server_version_at_creation': get_release(),
                        'creation_date': datetime.datetime.utcnow().strftime("%I:%M %p on %B %d, %Y"),
                        'deposition_nickname': request_info['deposition_nickname'],
                        'deposition_from_file': False}

    # Initialize the repo
    with depositions.DepositionRepo(deposition_id, initialize=True) as repo:
        # Manually set the metadata during object creation - never should be done this way elsewhere
        repo._live_metadata = entry_meta
        repo.write_entry(entry_template)
        repo.write_file('schema.json', json.dumps(json_schema).encode(), root=True)
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
        message.html = f'''Thank you for your deposition! Your assigned BMRbig ID is test-{bmrb_num}. This is a
test-only ID, and will not be preserved permanently. We have attached a 
copy of the deposition contents for reference. If you have marked your submission as public,
it will be visible <a href="{url_for("released", entry_id=bmrb_num, _external=True)}">here</a>.<br><br>
Deposited data files: {repo.get_data_file_list()}'''
        message.attach("%s.str" % uuid, "text/plain", str(final_entry))
        mail.send(message)

        # Send a message to the annotators
        if not configuration['debug']:
            message = Message("BMRbig: BMRB entry %s has been deposited." % bmrb_num,
                              recipients=[configuration['smtp']['annotator_address']])
            message.body = '''The following new entry has been deposited via BMRbig:

restart id:            %s
bmrb accession number: %s

title: %s

contact persons: %s
''' % (uuid, bmrb_num, final_entry.get_saveframes_by_category('entry_information')[0]['Title'][0], contact_full)
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
            if repo.delete_data_file(filename):
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
