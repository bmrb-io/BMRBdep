#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"

# Check if the initial setups need to happen
"${SCRIPT_DIR}"/install.sh

secret_key=$(cat ${SCRIPT_DIR}/BackEnd/bmrbdep/configuration.json | grep \"secret_key\" | cut -f4 -d\")
if [[ ${secret_key} == "CHANGE_ME" ]]; then
  echo 'Please change the secret key in the configuration first!'
  exit 1
fi
echo "Removing existing local docker image"
docker stop bmrbdep
docker rm bmrbdep

echo "Getting newest schema."
(
source "${SCRIPT_DIR}"/BackEnd/env/bin/activate
if ! "${SCRIPT_DIR}"/BackEnd/schema/schema_loader.py; then
  echo "Schema loader failed, quitting."
  exit 2
fi
)

echo "Compiling angular."
#(
#source "${SCRIPT_DIR}"/FrontEnd/node_env/bin/activate
#cd "${SCRIPT_DIR}"/FrontEnd || exit 2
#if ! npm run build.prod; then
#  echo "Angular build failed, quitting."
#  exit 3
#fi
#)

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


echo "Removing existing local docker image"
docker stop bmrbig
docker rm bmrbig


echo "Building the Docker container..."
if ! docker build -f ${SCRIPT_DIR}/Dockerfile -t bmrbig .; then
    echo "Docker build failed."
    exit 4
fi

deposition_dir=$(cat ${SCRIPT_DIR}/BackEnd/bmrbdep/configuration.json | grep \"repo_path\" | cut -f4 -d\")
output_dir=$(cat ${SCRIPT_DIR}/BackEnd/bmrbdep/configuration.json | grep \"output_path\" | cut -f4 -d\")
echo $output_dir

echo "Starting the docker container locally."

docker run -d --name bmrbig --restart=always --network host \
  -v /projects/BMRB/depositions/bmrbig/:/opt/wsgi/depositions \
  -v ${SCRIPT_DIR}/BackEnd/bmrbdep/configuration.json:/opt/wsgi/bmrbdep/configuration.json \
 bmrbig
