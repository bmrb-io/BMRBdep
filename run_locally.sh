#!/bin/bash

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

# Kill everything on script exit
trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT

# Run flask
${SCRIPT_DIR}/BackEnd/run.sh &

# Run angular
source ${SCRIPT_DIR}/FrontEnd/node_env/bin/activate
cd ${SCRIPT_DIR}/FrontEnd/
ng serve
