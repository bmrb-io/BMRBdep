#!/bin/bash

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

# Kill everything on script exit
trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT

# Check if the initial setups need to happen
${SCRIPT_DIR}/install.sh

# Run flask
${SCRIPT_DIR}/BackEnd/run.sh &

# Run angular
source ${SCRIPT_DIR}/FrontEnd/node_env/bin/activate
cd ${SCRIPT_DIR}/FrontEnd/
echo "Please open http://localhost:4200 in your browser when Angular is done compiling."
ng serve
