#!/usr/bin/env python3
import datetime
import os
import sqlite3
import subprocess

dd = '/projects/BMRB/depositions/bmrbig/production'

# First prepare the "for release" bmrbig directory
with sqlite3.connect(os.path.join(dd, 'depositions.sqlite3')) as conn:
    cur = conn.cursor()
    sql = "SELECT bmrbig_id, release_date, title, bmrb_id, pdb_id, publication_doi, contact_person1, " \
          "restart_id FROM entrylog"
    res = cur.execute(sql, [])
    released = [{'id': x[0], 'release_date': x[1], 'title': x[2], 'bmrb_id': x[3], 'pdb_id': x[4],
                 'doi': x[5], 'author': x[6], 'restart_id': x[7]} for x in res if
                datetime.datetime.strptime(x[1], "%Y-%m-%d").date() <= datetime.date.today()]

    for entry in released:
        cmd = ['/usr/bin/rsync', '-aqh', '--delete', '--exclude', '.git',
               os.path.join(dd, f"{entry['restart_id'][0]}/{entry['restart_id'][1]}/{entry['restart_id']}/data_files/"),
               os.path.join(dd, 'released', f"bmrbig{entry['id']}")]
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        result.check_returncode()
        if result.stderr:
            print(result.stderr.decode())
        if result.stdout:
            print(result.stdout.decode())
