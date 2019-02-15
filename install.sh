#!/bin/bash

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

if [[ ! -d "${SCRIPT_DIR}/FrontEnd/node_env" ]]
then
  echo "node environment was not yet set up. Setting up now... (This only needs to happen once.)"
  ${SCRIPT_DIR}/FrontEnd/setup.sh
fi

if [[ ! -d "${SCRIPT_DIR}/BackEnd/env" ]]
then
  echo "python environment was not yet set up. Setting up now... (This only needs to happen once.)"
  ${SCRIPT_DIR}/BackEnd/setup.sh
fi


if [[ ! -f "${SCRIPT_DIR}/BackEnd/app/schema_data/3.2.1.21.json.zlib" ]]
then
    echo "Schemas not found. Generating local cache of schema versions. This may take ~10 minutes. (This only needs to happen once.)"
    source ${SCRIPT_DIR}/BackEnd/env/bin/activate
    ${SCRIPT_DIR}/BackEnd/app/schema_loader.py
    deactivate
fi

