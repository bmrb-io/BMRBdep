#!/usr/bin/env python3

import json
import logging
import os
import sqlite3
from datetime import date, datetime
from shutil import copy
from typing import List, BinaryIO

import flask
import pynmrstar
import unidecode
from filelock import Timeout, FileLock
from git import Repo, CacheError

from bmrbdep.common import configuration, secure_filename, residue_mappings, get_release, get_schema
from bmrbdep.exceptions import ServerError, RequestError
from bmrbdep.helpers.pubmed import update_citation_with_pubmed

if not os.path.exists(configuration['repo_path']):
    try:
        os.mkdir(configuration['repo_path'])
        logging.warning('The deposition root directory did not exist... creating it.')
    except FileExistsError:
        pass


class DepositionRepo:
    """ A class to interface with git repos for depositions.

    You *MUST* use the 'with' statement when using this class to ensure that
    changes are committed."""

    def __init__(self, uuid, initialize: bool = False):
        self._repo: Repo
        self._uuid = uuid
        self._initialize: bool = initialize
        self._modified_files: bool = False
        self._live_metadata: dict = {}
        self._original_metadata: dict = {}
        uuids = str(uuid)
        self._lock_path: str = os.path.join(configuration['repo_path'], uuids[0], uuids[1], uuids, '.git', 'api.lock')
        self._entry_dir: str = os.path.join(configuration['repo_path'], uuids[0], uuids[1], uuids)

        # To transition, first check the old entry path
        # TODO: Remove this after the transition to the new path structure
        if os.path.exists(os.path.join(configuration['repo_path'], uuids)):
            self._entry_dir = os.path.join(configuration['repo_path'], uuids)
            self._lock_path: str = os.path.join(configuration['repo_path'], uuids, '.git', 'api.lock')

        # Make sure the entry ID is valid, or throw an exception
        if not os.path.exists(self._entry_dir):
            if not self._initialize:
                raise RequestError('No deposition with that ID exists!', status_code=404)
            else:
                # Create the entry directory (and parent folders, where needed)
                first_parent = os.path.join(configuration['repo_path'], uuids[0])
                if not os.path.exists(first_parent):
                    os.mkdir(first_parent)
                second_parent = os.path.join(configuration['repo_path'], uuids[0], uuids[1])
                if not os.path.exists(second_parent):
                    os.mkdir(second_parent)
                os.mkdir(self._entry_dir)
                os.mkdir(os.path.join(self._entry_dir, '.git'))
                os.mkdir(os.path.join(self._entry_dir, 'data_files'))

                self._repo = Repo.init(self._entry_dir)
                with self._repo.config_writer() as config:
                    config.set_value("user", "name", "BMRBDep")
                    config.set_value("user", "email", "bmrbhelp@bmrb.wisc.edu")

        # Create the lock object
        self._lock_object: FileLock = FileLock(self._lock_path, timeout=10)

        if not self._initialize:
            self._repo = Repo(self._entry_dir)

    def __enter__(self):
        """ Get a session cookie to use for future requests. """

        try:
            self._lock_object.acquire()
        except Timeout:
            raise ServerError('Could not get a lock on the deposition directory. This is usually because another'
                              ' request is already in progress.')

        return self

    def __exit__(self, exc_type, exc_value, traceback):
        """ End the current session."""

        # If nothing changed the commit won't do anything
        try:
            self.commit("Repo closed with changes but without a manual commit... Potential software bug.")
            self._repo.close()
            self._repo.__del__()
        # Catches all git-related errors
        except CacheError as err:
            raise ServerError("An exception happened while closing the entry repository: %s" % err)
        finally:
            self._lock_object.release()

    @property
    def metadata(self) -> dict:
        """ Return the metadata dictionary. """

        if not self._live_metadata:
            self._live_metadata = json.loads(self.get_file('submission_info.json').read())
            self._original_metadata = self._live_metadata.copy()
        return self._live_metadata

    @property
    def last_commit(self) -> str:
        return self._repo.head.object.hexsha

    def deposit(self, final_entry: pynmrstar.Entry) -> int:
        """ Deposits an entry into ETS. """

        self.raise_write_errors()
        if not self.metadata['email_validated']:
            raise RequestError('You must validate your e-mail before deposition.')
        contact_emails: List[str] = final_entry.get_loops_by_category("_Contact_Person")[0].get_tag(['Email_address'])
        if self.metadata['author_email'] not in contact_emails:
            raise RequestError('At least one contact person must have the email of the original deposition creator.')
        existing_entry_id = self.get_entry().entry_id

        if existing_entry_id != final_entry.entry_id:
            raise RequestError('Invalid deposited entry. The ID must match that of this deposition.')

        logging.info('Depositing deposition %s' % final_entry.entry_id)

        # Determine which schema version the entry is using
        schema: pynmrstar.Schema = pynmrstar.Schema(get_schema(self.metadata['schema_version'], schema_format='xml'))

        # Add tags stripped by the deposition interface
        final_entry.add_missing_tags(schema=schema)

        # We'll use this to assign Experiment_name tags later
        experiment_names: dict = {}
        try:
            experiment_names = dict(final_entry.get_loops_by_category('_Experiment')[0].get_tag(['id', 'name']))
        except IndexError:
            pass

        # Assign the PubMed ID
        for citation in final_entry.get_saveframes_by_category('citations'):
            if citation['PubMed_ID'] and citation['PubMed_ID'] != ".":
                update_citation_with_pubmed(citation, schema=schema)

        for saveframe in final_entry:
            # Remove all unicode from the entry
            for tag in saveframe.tag_iterator():
                if isinstance(tag[1], str):
                    tag[1] = unidecode.unidecode(tag[1])
                    # In case only non-convertible unicode characters were there
                    if tag[1] == '':
                        tag[1] = None
            for loop in saveframe.loops:
                for row in loop.data:
                    for pos in range(0, len(row)):
                        if isinstance(row[pos], str):
                            row[pos] = unidecode.unidecode(row[pos])
                            # In case only non-convertible unicode characters were there
                            if row[pos] == '':
                                row[pos] = None

                # Set the "Experiment_name" tag from the "Experiment_ID" tag
                if 'Experiment_ID' in loop.tags:
                    name_tag_index = loop.tag_index('Experiment_name')
                    if name_tag_index is None:
                        loop.add_tag('Experiment_name', update_data=True)
                        name_tag_index = loop.tag_index('Experiment_name')
                    id_tag_index = loop.tag_index('Experiment_ID')
                    for row in loop.data:
                        if row[id_tag_index] in experiment_names:
                            row[name_tag_index] = experiment_names[row[id_tag_index]]

            # Calculate the tag _Assembly.Number_of_components
            if saveframe.category == 'assembly':
                saveframe.add_tag('_Assembly.Number_of_components', len(saveframe['_Entity_assembly'].data),
                                  update=True)

        # Tweak the middle initials
        for loop_cat in [final_entry.get_loops_by_category(x) for x in
                         ['_Contact_person', '_Entry_author', '_Citation_author']]:
            for loop in loop_cat:
                middle_initial_index = loop.tag_index('Middle_initials')
                first_initial_index = loop.tag_index('First_initial')
                for row in loop.data:
                    if middle_initial_index and row[middle_initial_index]:
                        row[middle_initial_index] = ".".join(row[middle_initial_index].replace(".", "")) + '.'
                    if first_initial_index and row[middle_initial_index]:
                        row[middle_initial_index] = ".".join(row[middle_initial_index].replace(".", "")) + '.'

        # Delete the chemcomps if there is no ligand
        try:
            organic_count = int(final_entry.get_tag('Assembly.Organic_ligands')[0])
        except (ValueError, IndexError, TypeError):
            organic_count = 1
        try:
            metal_count = int(final_entry.get_tag('Assembly.Metal_ions')[0])
        except (ValueError, IndexError, TypeError):
            metal_count = 1
        if metal_count + organic_count == 0:
            for saveframe in final_entry.get_saveframes_by_category('chem_comp'):
                del final_entry[saveframe]

        # Insert the loops for residue sequences
        for entity in final_entry.get_saveframes_by_category('entity'):
            polymer_code: str = entity['Polymer_seq_one_letter_code'][0]
            polymer_type: str = entity['Polymer_type'][0]
            if polymer_code and polymer_code != '.':
                polymer_code = polymer_code.strip().upper().replace(' ', '').replace('\n', '')
                comp_loop = pynmrstar.Loop.from_scratch('_Entity_comp_index')
                comp_loop.add_tag(['_Entity_comp_index.ID',
                                   '_Entity_comp_index.Auth_seq_ID',
                                   '_Entity_comp_index.Comp_ID',
                                   '_Entity_comp_index.Comp_label',
                                   '_Entity_comp_index.Entry_ID',
                                   '_Entity_comp_index.Entity_ID'])

                # For simple DNA, RNA, and proteins
                if polymer_type in residue_mappings:
                    for x, residue in enumerate(polymer_code):
                        comp_loop.data.append([x+1, None, residue_mappings[polymer_type].get(residue, 'X'), None, None,
                                               None])

                # If it is something else, it needs to be manually annotated
                else:
                    for x, residue in enumerate(polymer_code):
                        comp_loop.data.append([x+1, None, 'X', None, None, None])

                entity.add_loop(comp_loop)

                polymer_loop = pynmrstar.Loop.from_scratch('_Entity_poly_seq')
                polymer_loop.add_tag(['_Entity_poly_seq.Hetero',
                                      '_Entity_poly_seq.Mon_ID',
                                      '_Entity_poly_seq.Num',
                                      '_Entity_poly_seq.Comp_index_ID',
                                      '_Entity_poly_seq.Entry_ID',
                                      '_Entity_poly_seq.Entity_ID'])
                # For simple DNA, RNA, and proteins
                if polymer_type in residue_mappings:
                    for x, residue in enumerate(polymer_code):
                        polymer_loop.data.append([None, residue_mappings[polymer_type].get(residue, 'X'), x+1, x+1,
                                                  None, None])
                # If it is something else, it needs to be manually annotated
                else:
                    for x, residue in enumerate(polymer_code):
                        polymer_loop.data.append([x + 1, None, 'X', None, None, None])
                entity.add_loop(polymer_loop)

        # Calculate the values needed to insert into ETS
        today_str: str = date.today().isoformat()
        today_date: datetime = datetime.now()

        # Set the accession and submission date
        entry_saveframe: pynmrstar.saveframe = final_entry.get_saveframes_by_category('entry_information')[0]
        entry_saveframe['Submission_date'] = today_str
        entry_saveframe['Accession_date'] = today_str

        # Do final entry normalization
        final_entry.normalize(schema=schema)

        params = {'source': 'Author',
                  'submit_type': 'Dep',
                  'status': 'nd',
                  'lit_search_required': 'N',
                  'submission_date': today_str,
                  'accession_date': today_str,
                  'last_updated': today_str,
                  'molecular_system': entry_saveframe['Title'][0],
                  'onhold_status': 'RELEASE NOW',
                  'restart_id': final_entry.entry_id
                  }

        contact_loop: pynmrstar.Loop = final_entry.get_loops_by_category("_Contact_Person")[0]
        params['author_email'] = ",".join(contact_loop.get_tag(['Email_address']))
        contact_people = [', '.join(x) for x in contact_loop.get_tag(['Family_name', 'Given_name'])]
        params['contact_person1'] = contact_people[0]
        try:
            params['contact_person2'] = contact_people[1]
        except IndexError:
            params['contact_person2'] = None

        # Make sqlite database for now
        database_path = os.path.join(configuration['repo_path'], 'depositions.sqlite3')
        if not os.path.exists(database_path):
            with sqlite3.connect(os.path.join(configuration['repo_path'], 'depositions.sqlite3')) as conn:
                cur = conn.cursor()
                cur.execute("""
    CREATE TABLE entrylog (bmrbnum INTEGER PRIMARY KEY AUTOINCREMENT,
                           restart_id TEXT UNIQUE,
                           author_email TEXT,
                           submission_date DATE,
                           contact_person1 TEXT,
                           contact_person2 TEXT,
                           molecular_system TEXT);""")
                cur.execute("CREATE INDEX restart_ids on entrylog (restart_id);")
                conn.commit()

        with sqlite3.connect(os.path.join(configuration['repo_path'], 'depositions.sqlite3')) as conn:
            cur = conn.cursor()

            # Create the deposition record
            insert_query = """
INSERT INTO entrylog (submission_date, molecular_system, contact_person1, contact_person2, author_email,
                      restart_id, author_email)
VALUES (?, ?, ?, ?, ?, ?, ?)"""

            try:
                cur.execute(insert_query, [params['submission_date'], params['molecular_system'],
                                           params['contact_person1'], params['contact_person2'],
                                           params['author_email'], params['restart_id'],
                                           params['author_email']])
                conn.commit()
                cur.execute("SELECT bmrbnum FROM entrylog WHERE restart_id = ?", [params['restart_id']])
                final_entry.entry_id = cur.fetchone()[0]
            except sqlite3.IntegrityError:
                logging.exception('This entry has already been deposited!')
                conn.rollback()
                raise ServerError('This entry has already been deposited! Please contact us.')
            except sqlite3.Error:
                logging.exception('Could not assign an ID in the database!')
                conn.rollback()
                raise ServerError('Could not create deposition. Please try again.')

        # Assign the BMRB ID in all the appropriate places in the entry
        for saveframe in final_entry.frame_list:
            for tag in saveframe.tags:
                fqtn: str = (saveframe.tag_prefix + "." + tag[0]).lower()
                try:
                    tag_schema = schema.schema[fqtn]
                    if tag_schema['entryIdFlg'] == 'Y':
                        tag[1] = final_entry.entry_id
                except KeyError:
                    pass

            for loop in saveframe.loops:
                for tag in loop.tags:
                    fqtn = (loop.category + "." + tag).lower()
                    try:
                        tag_schema = schema.schema[fqtn]
                        if tag_schema['entryIdFlg'] == 'Y':
                            loop[tag] = [final_entry.entry_id] * len(loop[tag])
                    except KeyError:
                        pass
        final_entry.get_saveframes_by_category('entry_information')[0]['ID'] = str(final_entry.entry_id)

        # Write the final deposition to disk
        self.write_file('deposition.str', str(final_entry).encode(), root=True)
        self.metadata['entry_deposited'] = True
        self.metadata['deposition_date'] = datetime.utcnow().strftime("%I:%M %p on %B %d, %Y"),
        self.metadata['bmrbnum'] = final_entry.entry_id
        self.metadata['server_version_at_deposition'] = get_release()
        self.commit('Deposition submitted!')

        # Data out
        entry_saveframe = final_entry.get_saveframes_by_category('entry_information')[0]
        if entry_saveframe['Release_privacy'][0] == 'public':
            output_dir = os.path.join(configuration['output_path'], str(final_entry.entry_id))
            os.mkdir(output_dir)
            contact_loop = entry_saveframe['_Contact_person']
            del entry_saveframe['_Contact_person']
            final_entry.write_to_file(os.path.join(output_dir, f"{final_entry.entry_id}.str"))
            entry_saveframe.add_loop(contact_loop)
            for data_file in os.listdir(os.path.join(self._entry_dir, 'data_files')):
                try:
                    os.link(os.path.join(self._entry_dir, "data_files", data_file), os.path.join(output_dir, data_file))
                except OSError:
                    copy(os.path.join(self._entry_dir, "data_files", data_file), os.path.join(output_dir, data_file))

        # Return the assigned BMRB ID
        return final_entry.entry_id

    def get_entry(self) -> pynmrstar.Entry:
        """ Return the NMR-STAR entry for this entry. """

        entry_location = os.path.join(self._entry_dir, 'entry.str')

        try:
            return pynmrstar.Entry.from_file(entry_location)
        except Exception as e:
            raise ServerError('Error loading an entry!\nError: %s\nEntry location:%s' % (repr(e), entry_location))

    def write_entry(self, entry: pynmrstar.Entry) -> None:
        """ Save an entry in the standard place. """

        self.raise_write_errors()
        self.write_file('entry.str', str(entry).encode(), root=True)

    def get_file(self, filename: str, root: bool = True) -> BinaryIO:
        """ Returns the current version of a file from the repo. """

        secured_filename: str = secure_filename(filename)
        if not root:
            secured_filename = os.path.join('data_files', secured_filename)
        try:
            return open(os.path.join(self._entry_dir, secured_filename), "rb")
        except IOError:
            raise RequestError('No file with that name saved for this entry.')

    def get_data_file_list(self) -> List[str]:
        """ Returns the list of data files associated with this deposition. """

        return os.listdir(os.path.join(self._entry_dir, 'data_files'))

    def delete_data_file(self, filename: str) -> bool:
        """ Delete a data file by name."""

        self.raise_write_errors()
        secured_filename = secure_filename(filename)
        try:
            os.unlink(os.path.join(self._entry_dir, 'data_files', secured_filename))
        except FileNotFoundError:
            return False
        self._modified_files = True
        return True

    def raise_write_errors(self):
        """ Raises an error if the entry may not be edited. This could happen if it is already deposited, or the email
        has not been validated."""

        if not self._initialize:
            if self.metadata['entry_deposited']:
                raise RequestError('Entry already deposited, no changes allowed.')

    def write_file(self, filename: str, data: bytes, root: bool = False) -> str:
        """ Adds (or overwrites) a file to the repo. Returns the name of the written file. """

        # The submission info file should always be writeable
        if filename != 'submission_info.json':
            self.raise_write_errors()

        secured_filename: str = secure_filename(filename)
        file_path: str = secured_filename
        if not root:
            file_path = os.path.join('data_files', secured_filename)

        with open(os.path.join(self._entry_dir, file_path), "wb") as fo:
            fo.write(data)

        self._modified_files = True

        return secured_filename

    def commit(self, message: str) -> bool:
        """ Commits the changes to the repository with a message. """

        # Check if the metadata has changed
        if self._live_metadata != self._original_metadata:
            self.write_file('submission_info.json',
                            json.dumps(self._live_metadata, indent=2, sort_keys=True).encode(),
                            root=True)
            self._original_metadata = self._live_metadata.copy()

        # No recorded changes
        if not self._modified_files:
            return False

        # See if they wrote the same value to an existing file
        if not self._repo.untracked_files and not [item.a_path for item in self._repo.index.diff(None)]:
            return False

        # Store the IP of the user making the change
        try:
            self.metadata['last_ip'] = flask.request.environ['REMOTE_ADDR']
        except RuntimeError:
            pass

        # Add the changes, commit
        self._repo.git.add(all=True)
        self._repo.git.commit(message=message)
        self._modified_files = False
        return True
