import functools
import logging

from flask import Blueprint, request, session, jsonify
from sqlalchemy import select, or_

from bmrbdep import depositions
from bmrbdep.common import is_admin_email
from bmrbdep.database import Deposition, get_db_session
from bmrbdep.exceptions import RequestError

admin_endpoints = Blueprint('admin_endpoints', __name__)

# Cap search responses so a broad term (or a wildcard) can't return the entire table.
SEARCH_RESULT_LIMIT = 200


def require_admin(view_function):
    """ Gate a view behind administrator access.

    Admin status is derived from the signed session e-mail (set by the existing e-mail-access
    flow in user_endpoints) matching a configured admin address. This is the authoritative
    check - the frontend `admin` flag is only used to decide whether to show the UI. """

    @functools.wraps(view_function)
    def wrapper(*args, **kwargs):
        active_email = session.get('active_email')
        if not is_admin_email(active_email):
            logging.warning('Denied admin access to %s %s from %s (session e-mail: %s)',
                            request.method, request.path, request.remote_addr, active_email)
            raise RequestError('You do not have permission to access this resource.', status_code=403)
        # Audit log: every successful admin action is recorded.
        logging.warning('Admin action by %s: %s %s', active_email, request.method, request.path)
        return view_function(*args, **kwargs)

    return wrapper


@admin_endpoints.get('/deposition/admin/search')
@require_admin
def admin_search():
    """ Search all depositions by user e-mail, session UUID, or depositor name (a single combined
    term that is matched against any of those, plus the deposition nickname). """

    term = (request.args.get('q') or '').strip()
    if not term:
        raise RequestError('Please provide a search term.')

    with get_db_session() as db_session:
        # All conditions are parameterized by SQLAlchemy - the term is never interpolated into SQL.
        # `.contains` matches a substring of the stored JSON text, which is what we want for the
        # JSON list columns; `.ilike` is a case-insensitive substring match for the scalar columns.
        conditions = [
            Deposition.deposition_id.ilike(f'%{term}%'),
            Deposition.author_emails.contains(term),
            Deposition.author_names.contains(term),
            Deposition.nickname.ilike(f'%{term}%'),
        ]
        stmt = (select(Deposition)
                .where(or_(*conditions))
                .order_by(Deposition.creation_date.desc())
                .limit(SEARCH_RESULT_LIMIT))
        results = db_session.execute(stmt).scalars().all()

        return jsonify([{
            'deposition_id': dep.deposition_id,
            'nickname': dep.nickname,
            'author_emails': dep.author_emails or [],
            'author_orcids': dep.author_orcids or [],
            'author_names': dep.author_names or [],
            'bmrbnum': dep.bmrbnum,
            'creation_date': dep.creation_date.isoformat() if dep.creation_date else None,
            'email_validated': bool(dep.email_validated),
            'entry_deposited': bool(dep.entry_deposited),
        } for dep in results])


@admin_endpoints.post('/deposition/admin/deposition/<uuid:uuid>/unlock')
@require_admin
def admin_unlock_deposition(uuid):
    """ Re-open a deposited entry for editing by flipping entry_deposited back to False.

    Only the metadata is mutated (which writes submission_info.json), so this deliberately does
    not touch entry.str and therefore is not blocked by `raise_write_errors`. The assigned
    bmrbnum is intentionally retained so a subsequent re-deposit reuses the same BMRB ID. """

    with depositions.DepositionRepo(uuid) as repo:
        if repo.metadata.get('entry_deposited'):
            # Only allow unlock while annotation has not yet begun, i.e. the ETS status is still
            # 'nd'. A None status means there is nothing to check against (no BMRB ID, or ETS is
            # mocked locally), so we don't block in that case.
            ets_status = repo.get_ets_status()
            if ets_status is not None and ets_status.lower() != 'nd':
                raise RequestError("This deposition cannot be unlocked because its entry tracking status is "
                                   f"'{ets_status}', not 'nd'. Annotation has already begun; please contact "
                                   "an annotator.")
            # Flip the ETS status to 'unlk' (recording a logtable entry) before re-opening the entry.
            repo.set_ets_status('unlk', 'Deposition unlocked for editing')
            repo.metadata['entry_deposited'] = False
            repo.commit('Manual deposition unlock by administrator')
        return jsonify({'commit': repo.last_commit,
                        'entry_deposited': repo.metadata.get('entry_deposited', False)})


@admin_endpoints.post('/deposition/admin/deposition/<uuid:uuid>/validate-email')
@require_admin
def admin_validate_email(uuid):
    """ Manually mark a deposition's e-mail address as validated. No-op if already validated. """

    with depositions.DepositionRepo(uuid) as repo:
        if not repo.metadata.get('email_validated'):
            repo.metadata['email_validated'] = True
            repo.commit('E-mail manually validated by administrator')
        return jsonify({'commit': repo.last_commit,
                        'email_validated': repo.metadata.get('email_validated', False)})
