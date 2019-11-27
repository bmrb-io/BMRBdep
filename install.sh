#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"

if [[ "$#" -gt 1 ]]; then
    echo "Illegal number of parameters. Usage: install.sh [--upgrade]"
fi
if [[ "$#" -eq 1 ]]; then
    if [[ "$1" != "--update" ]]; then
        echo "Illegal parameter. Usage: install.sh [--upgrade]"
    fi
fi

if [[ ! -d "${SCRIPT_DIR}/BackEnd/env" ]]; then
    echo "python environment was not yet set up. Setting up now... (This only needs to happen once.)" | tee -a "${SCRIPT_DIR}"/installation.log
    python3 -m venv "${SCRIPT_DIR}"/BackEnd/env
    source "${SCRIPT_DIR}"/BackEnd/env/bin/activate
    pip3 install --upgrade pip | tee -a "${SCRIPT_DIR}"/installation.log
    pip3 install -r "${SCRIPT_DIR}"/BackEnd/bmrbdep/requirements.txt | tee -a "${SCRIPT_DIR}"/installation.log
    deactivate
fi

if [[ "$1" == "--update" ]]; then
    echo "Updating requirements in virtualenv..." | tee -a "${SCRIPT_DIR}"/installation.log
    source "${SCRIPT_DIR}"/BackEnd/env/bin/activate
    pip3 install -r "${SCRIPT_DIR}"/BackEnd/bmrbdep/requirements.txt | tee -a "${SCRIPT_DIR}"/installation.log
    deactivate
fi

if [[ ! -d "${SCRIPT_DIR}/FrontEnd/node_env" ]]; then
    echo "node environment was not yet set up. Setting up now... (This only needs to happen once.)" | tee -a "${SCRIPT_DIR}"/installation.log
    source "${SCRIPT_DIR}"/BackEnd/env/bin/activate
    python3 -m nodeenv "${SCRIPT_DIR}"/FrontEnd/node_env | tee -a "${SCRIPT_DIR}"/installation.log
    deactivate
    source "${SCRIPT_DIR}"/FrontEnd/node_env/bin/activate
    cd "${SCRIPT_DIR}"/FrontEnd || exit 1
    npm install -g @angular/cli --silent | tee -a "${SCRIPT_DIR}"/installation.log
    npm install --silent | tee -a "${SCRIPT_DIR}"/installation.log
    deactivate_node
    cd - || exit 1
fi
if [[ "$1" == "--update" ]]; then
    echo "Updating node environment..."
    source "${SCRIPT_DIR}"/FrontEnd/node_env/bin/activate
    cd "${SCRIPT_DIR}"/FrontEnd
    npm install --silent | tee -a "${SCRIPT_DIR}"/installation.log
    deactivate_node
    cd -
fi

if [[ ! -f "${SCRIPT_DIR}/FrontEnd/src/environments/versions.ts" ]] || [[ "$1" == "--update" ]]; then
  echo "Creating git release file..." | tee -a "${SCRIPT_DIR}"/installation.log
  source "${SCRIPT_DIR}"/FrontEnd/node_env/bin/activate
  cd "${SCRIPT_DIR}"/FrontEnd/ || exit 3
  npm run prebuild.prod | tee -a "${SCRIPT_DIR}"/installation.log
  cd - || exit 4
  deactivate_node
fi

if [[ ! -f "${SCRIPT_DIR}/BackEnd/bmrbdep/configuration.json" ]]; then
  echo "No configuration file found. Copying example configuration file (which will work for local testing) to ${SCRIPT_DIR}/BackEnd/bmrbdep/configuration.json. You should edit this file before deployment." | tee -a "${SCRIPT_DIR}"/installation.log
  cp "${SCRIPT_DIR}"/BackEnd/bmrbdep/example_config.json "${SCRIPT_DIR}"/BackEnd/bmrbdep/configuration.json
fi

if [[ ! -f "${SCRIPT_DIR}/BackEnd/bmrbdep/schema_data/last_commit" ]] || [[ "$1" == "--update" ]]; then
  source "${SCRIPT_DIR}"/BackEnd/env/bin/activate
  echo "Generating/updating schemas..." | tee -a "${SCRIPT_DIR}"/installation.log
  "${SCRIPT_DIR}"/BackEnd/bmrbdep/schema_loader.py --force 2>&1 | tee -a "${SCRIPT_DIR}"/installation.log
  deactivate
fi
