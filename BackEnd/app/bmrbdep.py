#!/usr/bin/env python3

import os
import sys
import logging
import datetime
import traceback
from logging.handlers import SMTPHandler
from uuid import uuid4

import requests
import pynmrstar
from itsdangerous import URLSafeSerializer, BadSignature
import simplejson as json

# Import flask
from flask import Flask, request, jsonify, url_for, redirect, send_file, send_from_directory, Response
from werkzeug.utils import secure_filename
from flask_mail import Mail, Message

# Set up paths for imports and such
local_dir = os.path.dirname(__file__)
os.chdir(local_dir)
sys.path.append(local_dir)

# Import the functions needed to service requests - must be after path updates
from common import ServerError, RequestError, configuration, get_schema, root_dir
import depositions
from validate_email import validate_email

# Set up the flask application
application = Flask(__name__)

# Set debug if running from command line
if application.debug:
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
    logging.getLogger().setLevel('INFO')
else:
    logging.getLogger().setLevel('WARNING')


# Set up error handling
@application.errorhandler(ServerError)
@application.errorhandler(RequestError)
def handle_our_errors(error):
    """ Handles exceptions we raised ourselves. """

    response = jsonify(error.to_dict())
    response.status_code = error.status_code
    return response


@application.errorhandler(Exception)
def handle_other_errors():
    """ Catches any other exceptions and formats them. Only
    displays the actual error to local clients (to prevent disclosing
    issues that could be security vulnerabilities)."""

    def check_local_ip():
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
        response = jsonify({"error": "Server error. Contact webmaster@bmrb.wisc.edu."})
        response.status_code = 500
        return response


@application.route('/')
@application.route('/<file_name>')
def send_file(file_name=None):
    if file_name is None:
        file_name = "index.html"

    no_container_path = os.path.join(root_dir, '..', '..', 'FrontEnd', 'dist')
    container_path = os.path.join(root_dir, 'html')
    if os.path.exists(no_container_path):
        return send_from_directory(no_container_path, file_name)
    elif os.path.exists(container_path):
        return send_from_directory(container_path, file_name)
    else:
        return 'Broken installation'


@application.route('/deposition/<uuid:uuid>/resend-validation-email')
def send_validation_email(uuid):
    """ Sends the validation e-mail. """

    uuid = str(uuid)

    with depositions.DepositionRepo(uuid) as repo:
        # Already validated, don't re-send the email
        if repo.metadata['email_validated']:
            return jsonify({'status': 'validated'})
        # Ask them to confirm their e-mail
        confirm_message = Message("Please validate your e-mail address for BMRBDep deposition '%s'." %
                                  repo.metadata['deposition_nickname'],
                                  recipients=[repo.metadata['author_email']])
        token = URLSafeSerializer(configuration['secret_key']).dumps({'deposition_id': uuid})

        confirm_message.html = """
Thank you for your deposition '%s' created %s (UTC).
<br><br>
Please click <a href="%s">here</a> to validate your e-mail for this session. This is required to proceed.
<br><br>
You can use <a href="%s">this link</a> to return to your deposition later if you close the page before it is complete.
<br><br>
If you wish to share access with collaborators, simply forward them this e-mail. Be aware that anyone you
share this e-mail with will have access to the full contents of your in-progress deposition and can make
changes to it.
<br><br>
Thank you,
<br>
BMRBDep System""" % (repo.metadata['deposition_nickname'], repo.metadata['creation_date'],
                     url_for('validate_user', token=token, _external=True),
                     configuration['server_http_root'] + '/entry/%s/saveframe/deposited_data_files/category' % uuid)

        mail.send(confirm_message)

    return jsonify({'status': 'unvalidated'})


@application.route('/deposition/validate_email/<token>')
def validate_user(token):
    """ Validate a user-email. """

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

    return redirect('%s/entry/%s/saveframe/deposited_data_files/category' %
                    (configuration['server_http_root'], deposition_id),
                    code=302)


@application.route('/deposition/new', methods=('POST',))
def new_deposition():
    """ Starts a new deposition. """

    request_info = request.form

    if not request_info or 'email' not in request_info:
        raise RequestError("Must specify user e-mail to start a session.")

    if 'deposition_nickname' not in request_info:
        raise RequestError("Must specify a nickname for the deposition.")

    uploaded_entry = None
    entry_bootstrap = False
    if 'nmrstar_file' in request.files and request.files['nmrstar_file'] and request.files['nmrstar_file'].filename:
        try:
            uploaded_entry = pynmrstar.Entry.from_string(request.files['nmrstar_file'].read())
        except (ValueError, TypeError) as e:
            raise RequestError("Invalid NMR-STAR file. Parse error: %s" % repr(e))
    # Check if they are bootstrapping from an existing entry - if so, make sure they didn't also upload a file
    if 'bootstrapID' in request_info and request_info['bootstrapID'] != 'null':
        if uploaded_entry:
            raise RequestError('Cannot create an entry from an uploaded file and existing entry.')
        try:
            uploaded_entry = pynmrstar.Entry.from_database(request_info['bootstrapID'])
        except IOError:
            raise RequestError('Invalid entry ID specified. No such entry exists, or is released.')
        entry_bootstrap = True

    author_email = request_info.get('email')
    author_orcid = request_info.get('orcid')
    if not author_orcid:
        author_orcid = None

    # Check the e-mail
    if not validate_email(author_email):
        raise RequestError("The e-mail you provided is not a valid e-mail. Please check the e-mail you "
                           "provided for typos.")
    elif not validate_email(author_email, check_mx=True, smtp_timeout=3):
        raise RequestError("The e-mail you provided is invalid. There is no e-mail server at '%s'. (Do you "
                           "have a typo in the part of your e-mail after the @?)" %
                           (author_email[author_email.index("@") + 1:]))
    elif not validate_email(author_email, verify=True, sending_email='webmaster@bmrb.wisc.edu', smtp_timeout=3):
        raise RequestError("The e-mail you provided is invalid. That e-mail address does not exist at that "
                           "server. (Do you have a typo in the e-mail address before the @?)")

    # Create the deposition
    deposition_id = str(uuid4())
    schema = pynmrstar.Schema()
    json_schema = get_schema(schema.version)
    entry_template = pynmrstar.Entry.from_template(entry_id=deposition_id, all_tags=True, default_values=True,
                                                   schema=schema)

    # Merge the entries
    if uploaded_entry:
        # Rename the saveframes in the uploaded entry before merging them
        for category in uploaded_entry.category_list:
            for x, saveframe in enumerate(uploaded_entry.get_saveframes_by_category(category)):
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
                new_saveframe = pynmrstar.Saveframe.from_template(category, saveframe.name, deposition_id, True, schema)
                frame_prefix_lower = saveframe.tag_prefix.lower()

                # Don't copy the tags from entry_information
                if saveframe.category != "entry_information":
                    for tag in saveframe.tags:
                        lower_tag = tag[0].lower()
                        if lower_tag not in ['sf_category', 'sf_framecode', 'id', 'entry_id', 'nmr_star_version',
                                             'original_nmr_star_version']:
                            fqtn = frame_prefix_lower + '.' + lower_tag
                            if fqtn in schema.schema:
                                new_saveframe.add_tag(tag[0], tag[1], update=True)

                for loop in saveframe.loops:
                    if loop.category == "_Upload_data":
                        continue
                    lower_tags = [_.lower() for _ in loop.tags]
                    tags_to_pull = [_ for _ in new_saveframe[loop.category].tags if _.lower() in lower_tags]
                    filtered_original_loop = loop.filter(tags_to_pull)
                    filtered_original_loop.add_missing_tags(schema=schema, all_tags=True)
                    new_saveframe[filtered_original_loop.category] = filtered_original_loop
                entry_template.add_saveframe(new_saveframe)
        entry_template.normalize()

    # Set the entry information tags
    entry_information = entry_template.get_saveframes_by_category('entry_information')[0]
    entry_information['NMR_STAR_version'] = schema.version
    entry_information['Original_NMR_STAR_version'] = schema.version

    # Suggest some default sample conditions
    sample_conditions = entry_template.get_loops_by_category('_Sample_condition_variable')[0]
    if sample_conditions.empty:
        sample_conditions.data = [[None for _ in range(len(sample_conditions.tags))] for _ in range(4)]
        sample_conditions['Type'] = ['temperature', 'pH', 'pressure', 'ionic strength']
        sample_conditions['Val'] = [None, None, '1', None]
        sample_conditions['Val_units'] = ['K', 'pH', 'atm', 'M']

    author_given = None
    author_family = None

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

    entry_saveframe = entry_template.get_saveframes_by_category("entry_information")[0]
    entry_saveframe['UUID'] = deposition_id

    # Update the loops with the data we have
    author_loop = pynmrstar.Loop.from_scratch()
    author_loop.add_tag(['_Entry_author.Given_name',
                         '_Entry_author.Middle_initials',
                         '_Entry_author.Family_name',
                         '_Entry_author.ORCID'])
    author_loop.add_data([author_given,
                          None,
                          author_family,
                          author_orcid])
    if not entry_saveframe['_Entry_author'].empty:
        for row in entry_saveframe['_Entry_author'].get_tag(['_Entry_author.Given_name',
                                                             '_Entry_author.Middle_initials',
                                                             '_Entry_author.Family_name',
                                                             '_Entry_author.ORCID']):
            author_loop.add_data(row)

    author_loop.add_missing_tags(all_tags=True, schema=schema)
    author_loop.sort_tags(schema=schema)
    entry_saveframe['_Entry_author'] = author_loop

    contact_loop = pynmrstar.Loop.from_scratch()
    contact_loop.add_tag(['_Contact_person.Given_name',
                          '_Contact_person.Middle_initials',
                          '_Contact_person.Family_name',
                          '_Contact_person.ORCID',
                          '_Contact_person.Email_address',
                          '_Contact_person.Role',
                          '_Contact_person.Organization_type'])
    contact_loop.add_data([author_given,
                           None,
                           author_family,
                           author_orcid,
                           author_email,
                           schema.schema['_contact_person.role']['default value'],
                           schema.schema['_contact_person.organization_type']['default value']])
    contact_loop.add_data([None, None, None, None, None, 'responsible scientist', 'academic'])
    # Merge the uploaded data
    if not entry_saveframe['_Contact_person'].empty:
        for row in entry_saveframe['_Contact_person'].get_tag(['_Contact_person.Given_name',
                                                               '_Contact_person.Middle_initials',
                                                               '_Contact_person.Family_name',
                                                               '_Contact_person.ORCID',
                                                               '_Contact_person.Email_address',
                                                               '_Contact_person.Role',
                                                               '_Contact_person.Organization_type']):
            contact_loop.add_data(row)
    contact_loop.add_missing_tags(all_tags=True, schema=schema)
    contact_loop.sort_tags(schema=schema)
    entry_saveframe['_Contact_person'] = contact_loop

    # Set the loops to have at least one row of data
    for saveframe in entry_template:

        # Add a "deleted" tag to use to track deletion status
        saveframe.add_tag('_Deleted', 'no')

        for loop in saveframe:
            if not loop.data:
                row_data = []
                for tag in loop.tags:
                    fqtn = (loop.category + '.' + tag).lower()
                    if schema.schema[fqtn]['default value'] not in ["?", '']:
                        row_data.append(schema.schema[fqtn]['default value'])
                    else:
                        row_data.append('.')
                loop.data = [row_data]

    # Set the entry_interview tags
    entry_interview = entry_template.get_saveframes_by_category('entry_interview')[0]
    for tag in json_schema['file_upload_types']:
        entry_interview[tag[2]] = "no"
    entry_interview['PDB_deposition'] = "no"
    entry_interview['BMRB_deposition'] = "yes"
    # Set the tag to store that this entry was bootstrapped
    if entry_bootstrap:
        entry_interview['Previous_BMRB_entry_used'] = request_info['bootstrapID']

    entry_meta = {'deposition_id': deposition_id,
                  'author_email': author_email,
                  'author_orcid': author_orcid,
                  'last_ip': request.environ['REMOTE_ADDR'],
                  'deposition_origination': {'request': dict(request.headers),
                                             'ip': request.environ['REMOTE_ADDR']},
                  'email_validated': False,
                  'schema_version': schema.version,
                  'entry_deposited': False,
                  'creation_date': datetime.datetime.utcnow().strftime("%I:%M %p on %B %d, %Y"),
                  'deposition_nickname': request_info['deposition_nickname'],
                  'deposition_from_file': True if uploaded_entry else False}
    if uploaded_entry:
        if entry_bootstrap:
            entry_meta['bootstrap_entry'] = request_info['bootstrapID']
        else:
            entry_meta['bootstrap_filename'] = request.files['nmrstar_file'].filename

    # Initialize the repo
    with depositions.DepositionRepo(deposition_id, initialize=True) as repo:
        # Manually set the metadata during object creation - never should be done this way elsewhere
        repo._live_metadata = entry_meta
        repo.write_entry(entry_template)
        repo.write_file('schema.json', json.dumps(json_schema), root=True)
        if uploaded_entry:
            if entry_bootstrap:
                repo.write_file('bootstrap_entry.str', str(uploaded_entry), root=True)
            else:
                request.files['nmrstar_file'].seek(0)
                repo.write_file('bootstrap_entry.str', request.files['nmrstar_file'].read(), root=True)
        repo.commit("Entry created.")

    # Send the validation e-mail
    send_validation_email(deposition_id)

    return jsonify({'deposition_id': deposition_id})


@application.route('/deposition/<uuid:uuid>/deposit', methods=('POST',))
def deposit_entry(uuid):
    """ Complete the deposition! """

    with depositions.DepositionRepo(uuid) as repo:
        if repo.metadata['entry_deposited']:
            raise RequestError('Entry already deposited, no changes allowed.')
        if not repo.metadata['email_validated']:
            raise RequestError('Please click confirm on the e-mail validation link you were sent prior to deposition.')
        repo.metadata['entry_deposited'] = True
        repo.commit('Deposition submitted!')

        # Ask them to confirm their e-mail
        message = Message("Your entry has been deposited!", recipients=[repo.metadata['author_email']])
        message.html = 'Thank you for your deposition! The NMR-STAR representation of your entry is attached. You ' + \
                       'will hear from our annotators in the next few days.'
        message.attach("%s.str" % uuid, "text/plain", str(repo.get_entry()))
        mail.send(message)

    return jsonify({'status': 'success'})


@application.route('/deposition/<uuid:uuid>/file/<filename>', methods=('GET', 'DELETE'))
def file_operations(uuid, filename):
    """ Either retrieve or delete a file. """

    if request.method == "GET":
        with depositions.DepositionRepo(uuid) as repo:
            return send_file(repo.get_file(filename, raw_file=True, root=False),
                             attachment_filename=secure_filename(filename))
    elif request.method == "DELETE":
        with depositions.DepositionRepo(uuid) as repo:
            if repo.metadata['entry_deposited']:
                raise RequestError('Entry already deposited, no changes allowed.')
            repo.delete_data_file(filename)
            repo.commit('Deleted file %s' % filename)
        return jsonify({'status': 'success'})


@application.route('/deposition/<uuid:uuid>/file', methods=('POST',))
def store_file(uuid):
    """ Stores a data file based on uuid. """

    file_obj = request.files.get('file', None)

    if not file_obj or not file_obj.filename:
        raise RequestError('No file uploaded!')

    # Store a data file
    with depositions.DepositionRepo(uuid) as repo:
        if repo.metadata['entry_deposited']:
            raise RequestError('Entry already deposited, no changes allowed.')

        filename = repo.write_file(file_obj.filename, file_obj.read())

        # Update the entry data
        if repo.commit("User uploaded file: %s" % filename):
            return jsonify({'filename': filename, 'changed': True})
        else:
            return jsonify({'filename': filename, 'changed': False})


@application.route('/deposition/<uuid:uuid>', methods=('GET', 'PUT'))
def fetch_or_store_deposition(uuid):
    """ Fetches or stores an entry based on uuid """

    # Store an entry
    if request.method == "PUT":
        try:
            entry = pynmrstar.Entry.from_json(request.get_json())
        except ValueError:
            raise RequestError("Invalid JSON uploaded. The JSON was not a valid NMR-STAR entry.")

        with depositions.DepositionRepo(uuid) as repo:
            if repo.metadata['entry_deposited']:
                raise RequestError('Entry already deposited, no changes allowed.')

            existing_entry = repo.get_entry()

            # If they aren't making any changes
            try:
                if existing_entry == entry:
                    return jsonify({'changed': False})
            except ValueError as err:
                raise RequestError(repr(err))

            if existing_entry.entry_id != entry.entry_id:
                raise RequestError("Refusing to overwrite entry with entry of different ID.")

            # Update the entry data
            repo.write_entry(entry)
            repo.commit("Entry updated.")

            return jsonify({'changed': True})

    # Load an entry
    elif request.method == "GET":

        with depositions.DepositionRepo(uuid) as repo:
            entry = repo.get_entry()
            schema_version = entry.get_tag('_Entry.NMR_STAR_version')[0]
            data_files = repo.get_data_file_list()
            email_validated = repo.metadata['email_validated']
            deposition_nickname = repo.metadata['deposition_nickname']
        try:
            schema = get_schema(schema_version)
        except RequestError:
            raise ServerError("Entry specifies schema that doesn't exist on the server: %s" % schema_version)

        entry = entry.get_json(serialize=False)
        entry['schema'] = schema
        entry['data_files'] = data_files
        entry['email_validated'] = email_validated
        entry['deposition_nickname'] = deposition_nickname

        return jsonify(entry)



