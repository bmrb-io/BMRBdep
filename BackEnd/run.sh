#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

source ${DIR}/env/bin/activate
cd ${DIR}/app
export FLASK_APP=bmrbdep.py
export FLASK_DEBUG=1
flask run --host=0.0.0.0 --port 9000