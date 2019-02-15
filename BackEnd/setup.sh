#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

python3 -m venv ${DIR}/env
source ${DIR}/env/bin/activate
pip3 install -r app/requirements.txt
