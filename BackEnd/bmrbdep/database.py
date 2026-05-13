import logging
import os
from contextlib import contextmanager
from datetime import datetime
from typing import Optional, List

from sqlalchemy import create_engine, String, Integer, Boolean, DateTime, JSON, select
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

from bmrbdep.common import configuration, list_all_depositions, ServerError
from bmrbdep.depositions import DepositionRepo


class Base(DeclarativeBase):
    pass

class Deposition(Base):
    __tablename__ = 'depositions'

    deposition_id: Mapped[str] = mapped_column(String, primary_key=True)
    author_emails: Mapped[Optional[List]] = mapped_column(JSON)
    author_orcids: Mapped[Optional[List]] = mapped_column(JSON)
    bmrbnum: Mapped[Optional[int]] = mapped_column(Integer)
    creation_date: Mapped[Optional[datetime]] = mapped_column(DateTime)
    nickname: Mapped[Optional[str]] = mapped_column(String)
    email_validated: Mapped[Optional[bool]] = mapped_column(Boolean)
    entry_deposited: Mapped[Optional[bool]] = mapped_column(Boolean)
    schema_version: Mapped[Optional[str]] = mapped_column(String)

# Global engine and session factory
_engine = None
_SessionFactory = None

def get_engine():
    """Get or create the database engine"""
    global _engine
    if _engine is None:
        entry_dir = configuration.get('repo_path')
        if not entry_dir:
            raise ServerError("repo_path not configured")

        if not os.path.exists(entry_dir):
            raise ServerError(f"Repository path does not exist: {entry_dir}")

        db_path = os.path.join(entry_dir, 'database.sqlite3')
        _engine = create_engine(f'sqlite:///{db_path}')

    return _engine

def get_session_factory():
    """Get or create the session factory"""
    global _SessionFactory
    if _SessionFactory is None:
        _SessionFactory = sessionmaker(bind=get_engine())
    return _SessionFactory

@contextmanager
def get_db_session():
    """Context manager for database sessions"""
    SessionFactory = get_session_factory()
    session = SessionFactory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()

def init_db():
    """Create the database if it doesn't exist and populate it with the table"""
    engine = get_engine()
    Base.metadata.create_all(engine)
    return engine

def rescan():
    """Iterate through repo_path and upsert deposition data into the database"""
    entry_dir = configuration.get('repo_path')
    if not entry_dir:
        raise ValueError("repo_path not configured")

    init_db()

    with get_db_session() as session:
        # Get current deposition IDs from the filesystem
        current_deposition_ids = set(list_all_depositions())

        for deposition_id in current_deposition_ids:
            logging.debug(f"Processing deposition: {deposition_id}")

            try:
                # Load deposition data
                with DepositionRepo(deposition_id) as deposition_repo:
                    json_data = deposition_repo.metadata
                    entry = deposition_repo.entry

                    # Parse creation_date
                    creation_date = None
                    if 'creation_date' in json_data:
                        date_str = None
                        try:
                            # Parse format like "10:49 PM on October 06, 2019"
                            date_str = json_data['creation_date']
                            creation_date = datetime.strptime(date_str, "%I:%M %p on %B %d, %Y")
                        except ValueError as e:
                            logging.warning(f"Failed to parse creation_date '{date_str}' for {deposition_id}: {e}")

                    # Handle author emails and orcids as arrays
                    contact_loop = entry.get_loops_by_category("_Contact_Person")[0]
                    author_emails = contact_loop.get_tag('Email_address')
                    author_orcids = [_ for _ in contact_loop.get_tag('ORCID') if _ != "." and _ != "?" and _ is not None]

                    # Check if the deposition already exists
                    stmt = select(Deposition).where(Deposition.deposition_id == deposition_id)
                    existing = session.execute(stmt).scalar_one_or_none()

                    if existing:
                        # Update existing record
                        existing.author_emails = author_emails
                        existing.author_orcids = author_orcids
                        existing.bmrbnum = json_data.get('bmrbnum')
                        existing.creation_date = creation_date
                        existing.nickname = json_data.get('deposition_nickname')
                        existing.email_validated = json_data.get('email_validated', False)
                        existing.entry_deposited = json_data.get('entry_deposited', False)
                        existing.schema_version = json_data.get('schema_version')
                    else:
                        deposition = Deposition(
                            deposition_id=deposition_id,
                            author_emails=author_emails,
                            author_orcids=author_orcids,
                            bmrbnum=json_data.get('bmrbnum'),
                            creation_date=creation_date,
                            nickname=json_data.get('deposition_nickname'),
                            email_validated=json_data.get('email_validated', False),
                            entry_deposited=json_data.get('entry_deposited', False),
                            schema_version=json_data.get('schema_version')
                        )
                        session.add(deposition)

                # Commit after each deposition to avoid long-running transactions
                session.commit()
            except Exception as e:
                logging.error(f"Error processing {deposition_id}: {e}")
                session.rollback()
                continue

        # Remove depositions from database that are no longer in the filesystem
        stmt = select(Deposition.deposition_id)
        db_deposition_ids = set(session.execute(stmt).scalars().all())

        depositions_to_remove = db_deposition_ids - current_deposition_ids
        if depositions_to_remove:
            logging.info(f"Removing {len(depositions_to_remove)} depositions no longer found in filesystem")
            for deposition_id in depositions_to_remove:
                stmt = select(Deposition).where(Deposition.deposition_id == deposition_id)
                deposition_to_delete = session.execute(stmt).scalar_one_or_none()
                if deposition_to_delete:
                    session.delete(deposition_to_delete)
                    logging.debug(f"Removed deposition: {deposition_id}")
            session.commit()
