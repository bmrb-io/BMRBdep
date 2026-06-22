import logging
import socket

from flask import Blueprint, request, url_for, session, redirect, jsonify
from flask_mail import Message
from sqlalchemy import select, or_

from bmrbdep import application, RequestError, configuration, mail, ServerError, depositions
from bmrbdep.common import is_admin_email, filter_null_values
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


def _deposition_contact_emails(repo) -> list:
    """ Return the list of contact-person e-mail addresses for a deposition, with NMR-STAR null
    placeholders removed. Used to authorize a depositor against their own deposition. """

    try:
        contact_loop = repo.entry.get_loops_by_category("_Contact_Person")[0]
        return filter_null_values(contact_loop.get_tag('Email_address'))
    except Exception:
        return []


@application.get('/deposition/<uuid:uuid>/unlock-status')
def deposition_unlock_status(uuid):
    """ Report whether a deposited entry can still be unlocked by the depositor.

    A deposition is only unlockable while annotation has not yet begun, i.e. while the ETS status is
    still 'nd'. A None status (no BMRB ID assigned yet, or ETS mocked locally) is treated as
    unlockable so the flow works in development. """

    with depositions.DepositionRepo(uuid, read_only=True) as repo:
        deposited = bool(repo.metadata.get('entry_deposited'))
        ets_status = repo.get_ets_status() if deposited else None
        unlockable = deposited and (ets_status is None or ets_status.lower() == 'nd')

    return jsonify({'entry_deposited': deposited,
                    'ets_status': ets_status,
                    'unlockable': unlockable})


@application.post('/deposition/<uuid:uuid>/unlock')
def unlock_own_deposition(uuid):
    """ Allow a depositor authenticated by e-mail to re-open their own deposited entry for editing.

    This mirrors the administrator unlock, but is gated on the signed session e-mail being one of the
    deposition's contact persons rather than on administrator privilege. Unlocking is only permitted
    while the ETS status is still 'nd' (annotation has not yet begun). As with the admin path, only the
    metadata is mutated (entry.str is left untouched) and the assigned BMRB ID is retained so a
    subsequent re-deposit reuses the same number. """

    active_email = session.get('active_email')
    if not active_email:
        raise RequestError('You must be signed in via an e-mail access link to unlock a deposition. Use the '
                           '"Access my depositions" e-mail link, then try again.', status_code=403)

    with depositions.DepositionRepo(uuid) as repo:
        contact_emails = _deposition_contact_emails(repo)
        if active_email.strip().lower() not in {_.strip().lower() for _ in contact_emails}:
            logging.warning('Denied unlock of %s to %s (not a contact person)', uuid, active_email)
            raise RequestError('You can only unlock depositions that list your e-mail address as a contact person.',
                               status_code=403)

        if repo.metadata.get('entry_deposited'):
            ets_status = repo.get_ets_status()
            if ets_status is not None and ets_status.lower() != 'nd':
                raise RequestError('This deposition can no longer be unlocked because it has begun being processed '
                                   'by BMRB annotators. Please e-mail any further changes to help@bmrb.io.')
            # Flip the ETS status to 'unlk' (recording a logtable entry) before re-opening the entry.
            repo.set_ets_status('unlk', 'Deposition unlocked for editing by depositor')
            repo.metadata['entry_deposited'] = False
            repo.commit('Deposition unlocked by depositor %s' % active_email)

        return jsonify({'commit': repo.last_commit,
                        'entry_deposited': repo.metadata.get('entry_deposited', False)})

