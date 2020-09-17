#!/usr/bin/env python3
import csv
import optparse
from datetime import datetime

from bmrbdep.common import list_all_depositions
from bmrbdep.depositions import DepositionRepo

# Specify some basic information about our command
opt = optparse.OptionParser(usage="usage: %prog", version="1.0",
                            description="Update the entries in the Redis database.")
opt.add_option("--file", action="store", dest="file_name", default='/tmp/entry_info.csv',
               help="Where to store the calculated information.")
opt.add_option("--verbose", action="store_true", dest="verbose", default=False, help="Be verbose")
# Parse the command line input
(options, cmd_input) = opt.parse_args()

output_file = open(options.file_name, 'w')
output_csv = csv.writer(output_file)
output_csv.writerow(['entry', 'deposition_time_minutes'])

for entry in list_all_depositions():
    with DepositionRepo(entry) as entry_repo:
        meta = entry_repo.metadata
        if 'deposition_date' in meta:

            # Fix the records with a bug
            if isinstance(meta['deposition_date'], list):
                meta['deposition_date'] = meta['deposition_date'][0]
                entry_repo.commit('Fix the deposition date within the metadata to not be inside of a list.')

            # Get the time delta
            deposition_date_time = datetime.strptime(meta['deposition_date'], "%I:%M %p on %B %d, %Y")
            creation_date_time = datetime.strptime(meta['creation_date'], "%I:%M %p on %B %d, %Y")

            deposition_time = int((deposition_date_time - creation_date_time).seconds / 60)
            output_csv.writerow([entry, deposition_time])

output_file.close()
