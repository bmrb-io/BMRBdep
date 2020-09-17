#!/usr/bin/env python3
import csv
import logging
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

logging.basicConfig()
logger = logging.getLogger()
if options.verbose:
    logger.setLevel(logging.INFO)
else:
    logger.setLevel(logging.WARNING)

output_file = open(options.file_name, 'w')
output_csv = csv.writer(output_file)
output_csv.writerow(['entry', 'deposition_time_minutes'])

for entry in list_all_depositions():
    logging.info('Calculating stats for entry: %s' % entry)
    with DepositionRepo(entry) as entry_repo:
        if 'deposition_date' in entry_repo.metadata:

            # Fix the records with a bug
            if isinstance(entry_repo.metadata['deposition_date'], list):
                logging.warning("Fixing bug in deposition_date in submission_info file for entry %s" % entry)
                entry_repo.metadata['deposition_date'] = entry_repo.metadata['deposition_date'][0]
                entry_repo.commit('Fix the deposition date within the metadata to not be inside of a list.')

            # Get the time delta
            deposition_date_time = datetime.strptime(entry_repo.metadata['deposition_date'], "%I:%M %p on %B %d, %Y")
            creation_date_time = datetime.strptime(entry_repo.metadata['creation_date'], "%I:%M %p on %B %d, %Y")

            deposition_time = int((deposition_date_time - creation_date_time).seconds / 60)
            output_csv.writerow([entry, deposition_time])

output_file.close()
