#!/bin/bash

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

if [[ ! -d "${SCRIPT_DIR}/FrontEnd/node_env" ]]
then
  echo "node environment was not yet set up. Setting up now... (This only needs to happen once.)" | tee -a ${SCRIPT_DIR}/installation.log
  ${SCRIPT_DIR}/FrontEnd/setup.sh 2>&1 | tee -a ${SCRIPT_DIR}/installation.log
fi

if [[ ! -d "${SCRIPT_DIR}/BackEnd/env" ]]
then
  echo "python environment was not yet set up. Setting up now... (This only needs to happen once.)" | tee -a ${SCRIPT_DIR}/installation.log
  ${SCRIPT_DIR}/BackEnd/setup.sh 2>&1 | tee -a ${SCRIPT_DIR}/installation.log
fi

if [[ ! -f "${SCRIPT_DIR}/BackEnd/app/configuration.json" ]]
then
  echo "No configuration file found. Copying example configuration file (which will work for local testing) to ${SCRIPT_DIR}/BackEnd/app/configuration.json. You should edit this file before deployment." | tee -a ${SCRIPT_DIR}/installation.log
  cp ${SCRIPT_DIR}/BackEnd/app/example_config.json ${SCRIPT_DIR}/BackEnd/app/configuration.json
fi

if [[ ! -f "${SCRIPT_DIR}/BackEnd/app/schema_data/3.2.1.21.json.zlib" ]]
then
    echo "Schemas not found. Generating local cache of schema versions. This may take ~10 minutes. (This only needs to happen once.)" | tee -a ${SCRIPT_DIR}/installation.log
    source ${SCRIPT_DIR}/BackEnd/env/bin/activate
    ${SCRIPT_DIR}/BackEnd/app/schema_loader.py 2>&1 | tee -a ${SCRIPT_DIR}/installation.log
    deactivate
fi
