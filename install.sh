#!/bin/bash

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

if [[ ! -d "${SCRIPT_DIR}/BackEnd/env" ]]
then
  echo "python environment was not yet set up. Setting up now... (This only needs to happen once.)" | tee -a ${SCRIPT_DIR}/installation.log
  python3 -m venv ${SCRIPT_DIR}/BackEnd/env
  source ${SCRIPT_DIR}/BackEnd/env/bin/activate
  pip3 install --upgrade pip | tee -a ${SCRIPT_DIR}/installation.log
  pip3 install -r ${SCRIPT_DIR}/BackEnd/app/requirements.txt | tee -a ${SCRIPT_DIR}/installation.log
  deactivate
fi

if [[ ! -d "${SCRIPT_DIR}/FrontEnd/node_env" ]]
then
  echo "node environment was not yet set up. Setting up now... (This only needs to happen once.)" | tee -a ${SCRIPT_DIR}/installation.log
  source ${SCRIPT_DIR}/BackEnd/env/bin/activate
  pip3 install nodeenv==1.3.3 | tee -a ${SCRIPT_DIR}/installation.log
  python3 -m nodeenv ${SCRIPT_DIR}/FrontEnd/node_env | tee -a ${SCRIPT_DIR}/installation.log
  deactivate
  source ${SCRIPT_DIR}/FrontEnd/node_env/bin/activate
  cd ${SCRIPT_DIR}/FrontEnd
  npm install -g @angular/cli --silent | tee -a ${SCRIPT_DIR}/installation.log
  npm install --silent | tee -a ${SCRIPT_DIR}/installation.log
  deactivate_node
  cd -
fi

if [[ ! -f "${SCRIPT_DIR}/FrontEnd/src/environments/versions.ts" ]]
then
  echo "No git release versions file. creating one now... (This only needs to happen once.)" | tee -a ${SCRIPT_DIR}/installation.log
  source ${SCRIPT_DIR}/FrontEnd/node_env/bin/activate
  cd ${SCRIPT_DIR}/FrontEnd/
  npm run prebuild.prod | tee -a ${SCRIPT_DIR}/installation.log
  cd -
  deactivate_node
fi

if [[ ! -f "${SCRIPT_DIR}/BackEnd/app/configuration.json" ]]
then
  echo "No configuration file found. Copying example configuration file (which will work for local testing) to ${SCRIPT_DIR}/BackEnd/app/configuration.json. You should edit this file before deployment." | tee -a ${SCRIPT_DIR}/installation.log
  cp ${SCRIPT_DIR}/BackEnd/app/example_config.json ${SCRIPT_DIR}/BackEnd/app/configuration.json
fi

if [[ ! -f "${SCRIPT_DIR}/BackEnd/app/schema_data/3.2.1.21.json.zlib" ]]
then
    echo "Schemas not found. Generating local cache of schema versions... (This only needs to happen once.)" | tee -a ${SCRIPT_DIR}/installation.log
    source ${SCRIPT_DIR}/BackEnd/env/bin/activate
    ${SCRIPT_DIR}/BackEnd/app/schema_loader.py 2>&1 | tee -a ${SCRIPT_DIR}/installation.log
    deactivate
fi
