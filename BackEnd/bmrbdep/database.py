import glob
import logging
import os
import uuid
from datetime import datetime
from typing import Optional, List

from sqlalchemy import create_engine, String, Integer, Boolean, DateTime, JSON, select
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, Session

from bmrbdep import DepositionRepo
from bmrbdep.common import configuration


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

def init_db():
    """Create the database if it doesn't exist and populate it with the table"""
    entry_dir = configuration.get('repo_path')
    if not entry_dir:
        raise ValueError("repo_path not configured")
    
    if not os.path.exists(entry_dir):
        raise FileNotFoundError(f"Repository path does not exist: {entry_dir}")
    
    db_path = os.path.join(entry_dir, 'database.sqlite3')
    
    engine = create_engine(f'sqlite:///{db_path}')
    Base.metadata.create_all(engine)
    
    return engine

def rescan():
    """Iterate through repo_path and upsert deposition data into database"""
    entry_dir = configuration.get('repo_path')
    if not entry_dir:
        raise ValueError("repo_path not configured")
    
    engine = init_db()
    session = Session(engine)
    
    try:
        # Pattern: entry_dir/first_digit/second_digit/uuid/
        pattern = os.path.join(entry_dir, '*', '*', '*')
        
        logging.debug(f"Scanning entry directories with pattern: {pattern}")
        
        for repo_path in glob.glob(pattern):
            if os.path.isdir(repo_path):
                uuid_str = os.path.basename(repo_path)
                logging.debug(f"Processing directory: {repo_path} (UUID: {uuid_str})")
                
                try:
                    # Validate UUID format
                    uuid.UUID(uuid_str)
                    
                    # Load deposition data
                    with DepositionRepo(uuid_str) as deposition_repo:
                        json_data = deposition_repo.metadata
                        entry = deposition_repo.get_entry()

                        # Parse creation_date
                        creation_date = None
                        if 'creation_date' in json_data:
                            date_str = None
                            try:
                                # Parse format like "10:49 PM on October 06, 2019"
                                date_str = json_data['creation_date']
                                creation_date = datetime.strptime(date_str, "%I:%M %p on %B %d, %Y")
                            except ValueError as e:
                                logging.warning(f"Failed to parse creation_date '{date_str}' for {uuid_str}: {e}")

                        # Handle author emails and orcids as arrays
                        contact_loop = entry.get_loops_by_category("_Contact_Person")[0]
                        author_emails = list(set(contact_loop.get_tag('Email_address')))
                        author_orcids = list(set([_ for _ in contact_loop.get_tag('ORCID') if _ != "." and _ != "?" and _ is not None]))

                        # Check if deposition already exists
                        stmt = select(Deposition).where(Deposition.deposition_id == uuid_str)
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
                                deposition_id=uuid_str,
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
                    
                except ValueError as e:
                    # Skip invalid UUIDs
                    logging.debug(f"Skipping {uuid_str}: invalid UUID format - {e}")
                    continue
                except Exception as e:
                    # Log other errors but continue processing
                    logging.error(f"Error processing {uuid_str}: {e}")
                    continue
        
        session.commit()
        
    except Exception as e:
        session.rollback()
        logging.error(f"Database error during rescan: {e}")
        raise
    finally:
        session.close()
