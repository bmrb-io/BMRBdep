#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"

cd "${SCRIPT_DIR}" || exit
git pull
cd FrontEnd || exit
source node_env/bin/activate
npm install
deactivate_node

cd "${SCRIPT_DIR}/BackEnd" || exit
source env/bin/activate
pip3 install -r bmrbdep/requirements.txt
deactivate