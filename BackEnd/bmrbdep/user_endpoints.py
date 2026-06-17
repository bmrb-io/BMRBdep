import logging
import socket

from flask import Blueprint, request, url_for, session, redirect
from flask_mail import Message
from sqlalchemy import select, or_

from bmrbdep import application, RequestError, configuration, mail, ServerError
from bmrbdep.common import is_admin_email
from bmrbdep.database import Deposition, get_db_session
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

    session.permanent = True
    session['active_email'] = email
    return redirect('/my-depositions', code=302)


@application.get('/deposition/authorized-depositions')
def get_authorized_depositions():
    """ Return the list of depositions the user can access based on their session. """

    active_email = session.get('active_email')
    orcid_id = session.get('orcid_id')

    # If neither credential is present, return an empty array
    if not active_email and not orcid_id:
        return []

    # Fetch entries the user has access to
    with get_db_session() as db_session:
        conditions = []

        if active_email:
            conditions.append(Deposition.author_emails.contains(active_email))

        if orcid_id:
            conditions.append(Deposition.author_orcids.contains(orcid_id))

        stmt = select(Deposition).where(or_(*conditions))
        depositions = db_session.execute(stmt).scalars().all()

        # Return list of dictionaries with deposition_id, nickname, and authorization reason
        result = []
        for dep in depositions:
            auth_reasons = []

            if active_email and active_email in (dep.author_emails or []):
                auth_reasons.append('email')

            if orcid_id and orcid_id in (dep.author_orcids or []):
                auth_reasons.append('orcid')

            result.append({
                'deposition_id': dep.deposition_id,
                'nickname': dep.nickname,
                'authorized_via': auth_reasons,
                'entry_deposited': dep.entry_deposited,
                'bmrbnum': dep.bmrbnum if dep.entry_deposited else None
            })

        return result


@application.get('/deposition/session-info')
def get_session_info():
    """ Return identifying credentials present in the current session, if any.

    Used by the frontend to disambiguate "no depositions match your credentials"
    from "no credentials are present" — both look like an empty list to
    /authorized-depositions. """

    result = {}
    if email := session.get('active_email'):
        result['email'] = email
        if is_admin_email(email):
            result['admin'] = True
    if orcid := session.get('orcid_id'):
        result['orcid'] = orcid
    return result


@application.post('/deposition/end-session')
def end_session():
    """ Clear all session state. """

    session.clear()
    return {'status': 'success'}

