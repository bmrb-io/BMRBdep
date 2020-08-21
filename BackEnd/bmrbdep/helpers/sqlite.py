#!/usr/bin/python3
import datetime
import os
import sqlite3

from bmrbdep import configuration, ServerError


class EntryDB:
    def __init__(self):
        pass

    def __enter__(self):
        self._connection = sqlite3.connect(os.path.join(configuration['repo_path'], 'depositions.sqlite3'))
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self._connection.close()

    def run_command(self, query, args):
        cursor = self._connection.cursor()
        try:
            cursor.execute(query, args)
            return cursor.fetchall()
        except sqlite3.Error:
            raise ServerError('Failed to access database!')
        finally:
            cursor.close()

    def get_released(self):
        sql = "SELECT bmrbig_id, release_date, title, bmrb_id, pdb_id, publication_doi, contact_person1 FROM entrylog"
        res = self.run_command(sql, [])
        return [{'id': x[0], 'release_date': x[1], 'title': x[2], 'bmrb_id': x[3], 'pdb_id': x[4],
                 'doi': x[5], 'author': x[6]} for x in res if
                datetime.datetime.strptime(x[1], "%Y-%m-%d").date() <= datetime.date.today()]

    def get_id_from_released_entry(self, bmrbbig_id: int):
        """ Returns false if the entry isn't released. """
        sql = "SELECT restart_id, release_date FROM entrylog WHERE bmrbig_id = ?"
        results = self.run_command(sql, [bmrbbig_id])
        if len(results) == 0:
            return False
        if not datetime.datetime.strptime(results[0][1], "%Y-%m-%d").date() <= datetime.date.today():
            return False
        return results[0][0]

