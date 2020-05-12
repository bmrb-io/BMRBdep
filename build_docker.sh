#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"

# Check if the initial setups need to happen
"${SCRIPT_DIR}"/install.sh


echo "Getting newest schema."
(
source "${SCRIPT_DIR}"/BackEnd/env/bin/activate
if ! "${SCRIPT_DIR}"/BackEnd/schema/schema_loader.py; then
  echo "Schema loader failed, quitting."
  exit
fi
)

echo "Compiling angular."
(
source "${SCRIPT_DIR}"/FrontEnd/node_env/bin/activate
cd "${SCRIPT_DIR}"/FrontEnd || exit 2
if [[ $1 == "production" ]]; then
  if ! npm run build.prod; then
    echo "Angular build failed, quitting."
    exit
  fi
else
  if ! ng build --configuration devprod; then
    echo "Angular build failed, quitting."
    exit
  fi
fi
)

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
echo "$(parse_git_branch)$(parse_git_hash)" > "${SCRIPT_DIR}"/BackEnd/bmrbdep/version.txt

echo "Removing existing local docker image"
sudo docker stop bmrbdep
sudo docker rm bmrbdep

echo "Building the Docker container..."
if ! sudo docker build -f ${SCRIPT_DIR}/Dockerfile -t bmrbdep .; then
    echo "Docker build failed."
    exit 2
fi

deposition_dir=$(cat ${SCRIPT_DIR}/BackEnd/bmrbdep/configuration.json | grep repo_path | cut -f4 -d\")

if [[ $1 != "production" ]]; then
  echo "Starting the docker container locally."
  sudo docker run -d --name bmrbdep -p 9001:9001 --restart=always -v ${deposition_dir}:/opt/wsgi/depositions -v ${SCRIPT_DIR}/BackEnd/bmrbdep/configuration.json:/opt/wsgi/bmrbdep/configuration.json bmrbdep
fi