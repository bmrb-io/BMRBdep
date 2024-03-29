#!/usr/bin/env python3

import json
import logging
import os
import pathlib
import shutil
from datetime import date, datetime
from typing import List, BinaryIO, Optional

import flask
import psycopg2
import pynmrstar
import unidecode
from dateutil.relativedelta import relativedelta
from filelock import Timeout, FileLock, BaseFileLock
from git import Repo, CacheError

from bmrbdep.common import configuration, residue_mappings, get_release, get_schema, secure_full_path
from bmrbdep.exceptions import ServerError, RequestError
from bmrbdep.helpers.pubmed import update_citation_with_pubmed
from bmrbdep.helpers.star_tools import upgrade_chemcomps_and_create_entities_where_needed

if not os.path.exists(configuration['repo_path']):
    try:
        os.mkdir(configuration['repo_path'])
        logging.warning('The deposition root directory did not exist... creating it.')
    except FileExistsError:
        pass


class DepositionRepo:
    """ A class to interface with git repos for depositions.

    You *MUST* use the 'with' statement when using this class to ensure that
    changes are committed. Whenever making changes to the repo that are conditional on the state in the
    repository, perform all logic within a single `with` statement to ensure consistent state. Opening the
    repo multiple times to perform actions based on values from a previous opening may not longer be correct
    due to changes made in another process.

    Be aware that if you use the read_only mode, you MUST NOT perform any operations
    that change the state of the repository as a result of what you found. For example, opening a repo
    read only to check if the repo needs a change, closing the repo, opening it with write access, and then
    making a change IS NOT ACCEPTABLE. Checking the current state to get the contents of a file or calculate a
    statistic is acceptable. Furthermore, read_only mode does not allow performing any git related action, so
    you cannot use .last_commit.
    """

    def __init__(self, uuid, initialize: bool = False, read_only: bool = False):
        self._repo: Repo
        self._uuid = uuid
        self._initialize: bool = initialize
        self._read_only: bool = read_only
        self._modified_files: bool = False
        self._live_metadata: dict = {}
        self._original_metadata: dict = {}
        uuids = str(uuid)
        self._lock_path: str = os.path.join(configuration['repo_path'], uuids[0], uuids[1], uuids, '.git', 'api.lock')
        self._entry_dir: str = os.path.join(configuration['repo_path'], uuids[0], uuids[1], uuids)

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
                    config.set_value("user", "email", "help@bmrb.io")

        # Create the lock object
        self._lock_object: BaseFileLock = FileLock(self._lock_path, timeout=360)

        if not self._initialize and not self._read_only:
            self._repo = Repo(self._entry_dir)

    def __enter__(self):
        """ Get a session cookie to use for future requests. """

        if not self._read_only:
            try:
                self._lock_object.acquire()
            except Timeout:
                raise ServerError('Could not get a lock on the deposition directory. This is usually because another'
                                  ' request is already in progress.')

        return self

    def __exit__(self, exc_type, exc_value, traceback):
        """ End the current session."""

        if not self._read_only:
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
        else:
            if self._live_metadata != self._original_metadata:
                raise ServerError("Metadata edited for a deposition that was opened read-only! These changes have not"
                                  " been saved.")

    @property
    def metadata(self) -> dict:
        """ Return the metadata dictionary. """

        if not self._live_metadata:
            self._live_metadata = json.loads(self.get_file('submission_info.json').read())
            self._original_metadata = self._live_metadata.copy()
        return self._live_metadata

    @property
    def last_commit(self) -> str:
        if not self._repo:
            raise ServerError("Cannot access this attribute when repo opened read only.")
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

        # Generate any necessary entities from chemcomps
        upgrade_chemcomps_and_create_entities_where_needed(final_entry, schema=schema)

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
                  'molecular_system': final_entry['entry_information_1']['Title'][0],
                  'onhold_status': 'Pub',
                  'restart_id': final_entry.entry_id
                  }

        # Dep_release_code_nmr_exptl was wrongly used in place of Release_request in dictionary versions < 3.2.8.1
        try:
            release_status: str = final_entry['entry_information_1']['Dep_release_code_nmr_exptl'][0].upper()
        except (KeyError, ValueError):
            release_status = final_entry['entry_information_1']['Release_request'][0].upper()

        if release_status == 'RELEASE NOW':
            params['onhold_status'] = today_date.strftime("%m/%d/%y")
        elif release_status == 'HOLD FOR 4 WEEKS':
            params['onhold_status'] = (today_date + relativedelta(weeks=4)).strftime("%m/%d/%y")
        elif release_status == 'HOLD FOR 8 WEEKS':
            params['onhold_status'] = (today_date + relativedelta(weeks=+8)).strftime("%m/%d/%y")
        elif release_status == 'HOLD FOR 6 MONTHS':
            params['onhold_status'] = (today_date + relativedelta(months=+6)).strftime("%m/%d/%y")
        elif release_status == 'HOLD FOR 1 YEAR':
            params['onhold_status'] = (today_date + relativedelta(years=+1)).strftime("%m/%d/%y")
        elif release_status == 'HOLD FOR PUBLICATION':
            params['onhold_status'] = 'Pub'
        else:
            raise ServerError('Invalid release code.')

        contact_loop: pynmrstar.Loop = final_entry.get_loops_by_category("_Contact_Person")[0]
        params['author_email'] = ",".join(contact_loop.get_tag(['Email_address']))
        contact_people = [', '.join(x) for x in contact_loop.get_tag(['Family_name', 'Given_name'])]
        params['contact_person1'] = contact_people[0]
        params['contact_person2'] = contact_people[1]

        ranges = configuration['ets']['deposition_ranges']
        if len(ranges) == 0:
            raise ServerError('Server configuration error.')

        # If they have already deposited, just keep the same BMRB ID
        bmrbnum = self.metadata.get('bmrbnum', None)
        if configuration['debug'] and configuration['ets']['host'] == 'CHANGE_ME' and not bmrbnum:
            bmrbnum = 999999
        if bmrbnum:
            params['bmrbnum'] = bmrbnum
        else:
            try:
                conn = psycopg2.connect(user=configuration['ets']['user'], host=configuration['ets']['host'],
                                        database=configuration['ets']['database'])
                cur = conn.cursor()
            except psycopg2.OperationalError:
                logging.exception('Could not connect to ETS database. Is the server down, or the configuration wrong?')
                raise ServerError('Could not connect to entry tracking system. Please contact us.')

            try:
                # Determine which bmrbnum to use - one range at a time
                bmrbnum: Optional[int] = None
                for id_range in ranges:
                    # Get the existing IDs from ETS
                    bmrb_sql: str = 'SELECT bmrbnum FROM entrylog WHERE bmrbnum >= %s AND bmrbnum <= %s;'
                    cur.execute(bmrb_sql, [id_range[0], id_range[1]])

                    # Calculate the list of valid IDs
                    existing_ids: set = set([_[0] for _ in cur.fetchall()])
                    ids_in_range: set = set(range(id_range[0], id_range[1]))
                    assignable_ids = sorted(list(ids_in_range.difference(existing_ids)))

                    # A valid ID has been found in this range
                    if len(assignable_ids) > 0:
                        bmrbnum = assignable_ids[0]
                        break
                    else:
                        logging.warning('No valid IDs found in range %d to %d. Continuing to next range...' %
                                        (id_range[0], id_range[1]))

                if not bmrbnum:
                    logging.exception('No valid IDs remaining in any of the ranges!')
                    raise ServerError('Could not find a valid BMRB ID to assign. Please contact us.')

                params['bmrbnum'] = bmrbnum

                # Create the deposition record
                insert_query = """
INSERT INTO entrylog (depnum, bmrbnum, status, submission_date, accession_date, onhold_status, molecular_system,
                      contact_person1, contact_person2, submit_type, source, lit_search_required, author_email,
                      restart_id, last_updated, nmr_dep_code)
  VALUES (nextval('depnum_seq'), %(bmrbnum)s, %(status)s, %(submission_date)s, %(accession_date)s, %(onhold_status)s,
                             %(molecular_system)s, %(contact_person1)s, %(contact_person2)s, %(submit_type)s,
                             %(source)s, %(lit_search_required)s, %(author_email)s, %(restart_id)s, %(last_updated)s,
                             %(restart_id)s)"""
                cur.execute(insert_query, params)
                log_sql = """
INSERT INTO logtable (logid,depnum,actdesc,newstatus,statuslevel,logdate,login)
  VALUES (nextval('logid_seq'),currval('depnum_seq'),'NEW DEPOSITION','nd',1,now(),'')"""
                cur.execute(log_sql)
                conn.commit()
            except psycopg2.IntegrityError:
                logging.exception('Could not assign the chosen BMRB ID - it was already assigned.')
                conn.rollback()
                raise ServerError('Could not create deposition. Please try again.')

        # Assign the BMRB ID in all the appropriate places in the entry
        final_entry.entry_id = bmrbnum

        # Write the final deposition to disk
        self.write_file('deposition.str', str(final_entry).encode(), root=True)
        self.metadata['entry_deposited'] = True
        self.metadata['deposition_date'] = datetime.utcnow().strftime("%I:%M %p on %B %d, %Y")
        self.metadata['bmrbnum'] = bmrbnum
        self.metadata['server_version_at_deposition'] = get_release()
        self.commit('Deposition submitted!')

        # Return the assigned BMRB ID
        return bmrbnum

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

    def get_file(self, path: str, root: bool = True) -> BinaryIO:
        """ Returns the current version of a file from the repo. """

        secured_path, secured_filename = secure_full_path(path)
        if not secured_filename:
            raise RequestError('Cannot access directories, just files.')
        try:
            if root:
                return open(os.path.join(self._entry_dir, secured_filename), "rb")
            else:
                return open(os.path.join(self._entry_dir, 'data_files', secured_path, secured_filename), 'rb')
        except IOError:
            raise RequestError('No file with that name saved for this entry.')

    def get_data_file_list(self) -> List[str]:
        """ Returns the list of data files associated with this deposition. """

        return os.listdir(os.path.join(self._entry_dir, 'data_files'))

    def delete_data_file(self, path: str) -> bool:
        """ Delete a data file by name."""

        self.raise_write_errors()

        secured_path, secured_filename = secure_full_path(path)
        data_file_path = os.path.join(self._entry_dir, 'data_files', secured_path, secured_filename)

        try:
            if os.path.isfile(data_file_path):
                os.unlink(data_file_path)
            elif os.path.isdir(data_file_path):
                os.rmdir(data_file_path)
        except FileNotFoundError:
            return False
        except OSError:
            raise RequestError('You must first remove any files in a directory before removing the directory itself.')
        self._modified_files = True
        return True

    def raise_write_errors(self):
        """ Raises an error if the entry may not be edited. This could happen if it is already deposited, or the email
        has not been validated."""

        if not self._initialize:
            if self.metadata['entry_deposited']:
                raise RequestError('Entry already deposited, no changes allowed.')
        if self._read_only:
            raise ServerError('Cannot write to a deposition opened read-only!')

    def write_file(self, filename: str,
                   data: Optional[bytes] = None,
                   source_path: Optional[str] = None,
                   root: bool = False) \
            -> str:
        """ Adds (or overwrites) a file to the repo. Returns the name of the written file. """

        # The submission info file should always be writeable
        if filename != 'submission_info.json':
            self.raise_write_errors()
        else:
            # Even if the submission file, it can't be written if opened read-only
            if self._read_only:
                raise ServerError('Cannot write to a deposition opened read-only!')

        # This ensures that no hijinks in the file names or issues with OS file names exist
        file_path, file_name = secure_full_path(filename)

        if root:
            full_path: str = os.path.join(self._entry_dir, file_name)
        else:
            full_path = os.path.join(self._entry_dir, 'data_files', file_path, file_name)

        # Make the directory if it doesn't exist
        if not os.path.exists(os.path.dirname(full_path)):
            pathlib.Path(os.path.dirname(full_path)).mkdir(parents=True, exist_ok=True)

        # Write the data, depending on how we got it
        if data and not source_path:
            with open(full_path, "wb") as fo:
                fo.write(data)
        elif source_path and not data:
            shutil.copy(source_path, full_path)
        else:
            raise ValueError('Cannot provide both data and source_path, please only provide one.')
        # Make sure the permissions of the written file are correct
        os.chmod(full_path, 0o644)

        self._modified_files = True

        if root:
            return file_name
        else:
            return os.path.join(file_path, file_name)

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
