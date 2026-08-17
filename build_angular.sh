#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"

# Check if the initial setups need to happen
#"${SCRIPT_DIR}"/install.sh

#secret_key=$(cat ${SCRIPT_DIR}/BackEnd/bmrbdep/configuration.json | grep \"secret_key\" | cut -f4 -d\")
#if [[ ${secret_key} == "CHANGE_ME" ]]; then
#  echo 'Please change the secret key in the configuration first!'
#  exit 1
#fi

if [[ ! -f "${SCRIPT_DIR}/.env" ]]; then
  echo "No .env file found at ${SCRIPT_DIR}/.env; cannot determine build mode."
  exit 1
fi

read_env_var() {
  grep -E "^[[:space:]]*$1[[:space:]]*=" "${SCRIPT_DIR}/.env" | tail -n 1 | cut -d= -f2- | tr -d '[:space:]"'"'"
}

ENVIRONMENT=$(read_env_var ENVIRONMENT)
if [[ "${ENVIRONMENT}" != "production" && "${ENVIRONMENT}" != "development" ]]; then
  echo "ENVIRONMENT in .env must be 'production' or 'development' (got: '${ENVIRONMENT}')."
  exit 1
fi

required_uid=$(read_env_var UID)
if [[ -n "${required_uid}" && "$(id -u)" != "${required_uid}" ]]; then
  echo "Must run this as UID ${required_uid} (as specified in .env)."
  exit 1
fi

echo "Getting newest schema."
if ! (cd "${SCRIPT_DIR}"/BackEnd/bmrbdep && ./.venv/bin/python "${SCRIPT_DIR}"/BackEnd/schema/schema_loader.py); then
  echo "Schema loader failed, quitting."
  exit 2
fi

echo "Compiling angular (${ENVIRONMENT})."
source "${SCRIPT_DIR}"/FrontEnd/node_env/bin/activate
cd "${SCRIPT_DIR}"/FrontEnd || exit 2
if ! npm install --no-save; then
  echo "npm install failed, quitting."
  exit 3
fi
if [[ "${ENVIRONMENT}" == "production" ]]; then
  if ! npm run build.prod; then
    echo "Angular build failed, quitting."
    exit 3
  fi
else
  if ! npm run build.devprod; then
    echo "Angular build failed, quitting."
    exit 3
  fi
fi
cd "${SCRIPT_DIR}"

echo "Writing out git version to file..."
# https://gist.github.com/dciccale/5560837
function parse_git_dirty() {
  git diff --quiet --ignore-submodules HEAD 2>/dev/null; [[ $? -eq 1 ]] && echo "*"
}
function parse_git_branch() {
  git branch --no-color 2> /dev/null | sed -e '/^[^*]/d' -e "s/* \(.*\)/\1$(parse_git_dirty)/"
}
function parse_git_hash() {
  git rev-parse --short HEAD 2> /dev/null | sed "s/\(.*\)/@\1/"
}
echo "$(parse_git_branch)$(parse_git_hash)" > "${SCRIPT_DIR}"/version.txt

