#!/usr/bin/python3
import datetime
import logging
import os
import sqlite3
from typing import List, Dict, Union

import bmrbdep


class EntryDB:
    def __init__(self):
        """ Will create the DB if it doesn't exist. """

        self._db_path = os.path.join(bmrbdep.configuration['repo_path'], 'depositions.sqlite3')
        if not os.path.exists(self._db_path):
            logging.warning('Creating DB at %s for the first time since it doesn\'t exist', self._db_path)
            with sqlite3.connect(self._db_path) as conn:
                cur = conn.cursor()
                cur.execute("""
CREATE TABLE entrylog (bmrbig_id INTEGER PRIMARY KEY AUTOINCREMENT,
                       restart_id TEXT UNIQUE,
                       author_email TEXT,
                       submission_date DATE,
                       release_date DATE,
                       contact_person1 TEXT,
                       title TEXT,
                       bmrb_id TEXT,
                       pdb_id TEXT,
                       publication_doi TEXT
                       );""")
                cur.execute("CREATE INDEX restart_ids on entrylog (restart_id);")
                conn.commit()
                cur.close()

    def __enter__(self):
        self._connection = sqlite3.connect(self._db_path)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self._connection.close()

    def _run_command(self, query, args):
        cursor = self._connection.cursor()
        try:
            cursor.execute(query, args)
            return cursor.fetchall()
        except sqlite3.Error:
            raise bmrbdep.ServerError('Failed to access database!')
        finally:
            cursor.close()

    def create_or_update_entry_record(self, params):
        """ If assign is provided, will return the newly created ID."""

        if 'bmrbig_id' not in params:
            sql = """
INSERT INTO entrylog (submission_date, release_date, title, contact_person1,
author_email, restart_id, author_email, bmrb_id, pdb_id, publication_doi)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"""
            args = [params['submission_date'], params['release_date'],
                    params['title'], params['contact_person1'], params['author_email'],
                    params['restart_id'], params['author_email'],
                    params['bmrb_id'], params['pdb_id'], params['publication_doi']]
        else:
            sql = """
INSERT OR REPLACE INTO entrylog (bmrbig_id, submission_date, release_date, title, contact_person1,
author_email, restart_id, author_email, bmrb_id, pdb_id, publication_doi)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"""
            args = [params['bmrbig_id'][6:], params['submission_date'], params['release_date'],
                    params['title'], params['contact_person1'], params['author_email'],
                    params['restart_id'], params['author_email'],
                    params['bmrb_id'], params['pdb_id'], params['publication_doi']]

        try:
            self._run_command(sql, args)
            self._connection.commit()
            if 'bmrbig_id' not in params:
                res = self._run_command("SELECT bmrbig_id FROM entrylog WHERE restart_id = ?",
                                        [params['restart_id']])
                return 'bmrbig' + str(res[0][0])
        except sqlite3.Error:
            logging.exception('Could not assign an ID in the database!')
            self._connection.rollback()
            raise bmrbdep.ServerError('Could not create deposition. Please try again.')

    def get_released(self) -> List[Dict[str, any]]:
        sql = "SELECT bmrbig_id, release_date, title, bmrb_id, pdb_id, publication_doi, contact_person1, " \
              "restart_id FROM entrylog"
        res = self._run_command(sql, [])
        return [{'id': x[0], 'release_date': x[1], 'title': x[2], 'bmrb_id': x[3], 'pdb_id': x[4],
                 'doi': x[5], 'author': x[6], 'restart_id': x[7]} for x in res if
                datetime.datetime.strptime(x[1], "%Y-%m-%d").date() <= datetime.date.today()]

    def get_all(self) -> List[Dict[str, any]]:
        sql = "SELECT bmrbig_id, release_date, title, bmrb_id, pdb_id, publication_doi, contact_person1, " \
              "restart_id FROM entrylog"
        res = self._run_command(sql, [])
        return [{'id': x[0], 'release_date': x[1], 'title': x[2], 'bmrb_id': x[3], 'pdb_id': x[4],
                 'doi': x[5], 'author': x[6], 'restart_id': x[7]} for x in res]

    def get_id_from_released_entry(self, bmrbbig_id: int) -> Union[bool, Dict[str, any]]:
        """ Returns false if the entry isn't released. """
        sql = "SELECT restart_id, release_date FROM entrylog WHERE bmrbig_id = ?"
        results = self._run_command(sql, [bmrbbig_id])
        if len(results) == 0:
            return False
        if not datetime.datetime.strptime(results[0][1], "%Y-%m-%d").date() <= datetime.date.today():
            return False
        return results[0][0]

