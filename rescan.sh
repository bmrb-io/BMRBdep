#!/bin/bash
# Script to initialize the database using bmrbdep.database.init_db()

cd /opt/wsgi
source /opt/venv/bin/activate
python -c "from bmrbdep.database import rescan; rescan()"
