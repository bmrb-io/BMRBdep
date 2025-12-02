import logging
import socket

from flask import Blueprint, request, url_for, session
from flask_mail import Message

from bmrbdep import application, RequestError, configuration, mail, ServerError
from bmrbdep.helpers.tokens import get_email_token, verify_email_token

user_endpoints = Blueprint('user_endpoints', __name__)


@application.post('/deposition/request-email-access')
def send_email_access_token():
    """ Send the user an e-mail allowing them to access all their depositions. """

    recipient = request.form.get('email')
    if not recipient:
        raise RequestError('Invalid request, no e-mail address provided.')

    # Ask them to confirm their e-mail
    confirm_message = Message("BMRBdep Access Link",
                              recipients=[recipient],
                              bcc=configuration['smtp'].get('logging_emails', []),
                              reply_to=configuration['smtp']['reply_to_address'])

    confirm_message.html = f"""
        To gain access to all depositions that list {recipient} as a contact person, click 
        <a href="{url_for('activate_email_session', token=get_email_token(recipient), _external=True)}" target="BMRBDep">here</a>.
        <br><br>
        This link is valid for 1 hour and will create a session that will remain active for two weeks.
        <br><br>
        If you are using a shared computer, please ensure that you click the "End Session" button in the left panel
        menu when leaving the computer. (You can always return to it using the link above.) If you fail to do so,
        others who use your computer could access your depositions.
        <br><br>
        Thank you,
        <br>
        BMRBDep System"""

    try:
        mail.send(confirm_message)
    except socket.gaierror:
        if configuration['debug']:
            logging.warning('Invalid SMTP server configured!')
        else:
            raise ServerError('Server is mis-configured, please contact the administrator.')
    return {'status': 'sent'}


@application.get('/deposition/activate-email-session/<token>')
def activate_email_session(token: str):

    if not (email := verify_email_token(token)):
        raise RequestError('Invalid e-mail validation token.')

    session['active_email'] = email

    return {'status': 'success'}
