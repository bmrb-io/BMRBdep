#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"

# Check if the initial setups need to happen
#"${SCRIPT_DIR}"/install.sh

#secret_key=$(cat ${SCRIPT_DIR}/BackEnd/bmrbdep/configuration.json | grep \"secret_key\" | cut -f4 -d\")
#if [[ ${secret_key} == "CHANGE_ME" ]]; then
#  echo 'Please change the secret key in the configuration first!'
#  exit 1
#fi

user_id=`id -u`
if [[ $user_id != '17473' ]]; then
 echo "Must run this as bmrbsvc user (or apache on production)..."
 exit 1
fi
host=`hostname`

echo "Getting newest schema."
(
source "${SCRIPT_DIR}"/BackEnd/venv/bin/activate
if ! "${SCRIPT_DIR}"/BackEnd/schema/schema_loader.py; then
  echo "Schema loader failed, quitting."
  exit 2
fi
)

echo "Compiling angular."
source "${SCRIPT_DIR}"/FrontEnd/node_env/bin/activate
cd "${SCRIPT_DIR}"/FrontEnd || exit 2
if [[ $1 == "production" || $host == "bmrb-prod.cam.uchc.edu" ]]; then
  if ! npm run build.prod; then
    echo "Angular build failed, quitting."
    exit 3
  fi
else
  if ! npm run ng build --configuration=devprod; then
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

#echo "Renaming existing bmrbdep image so that we can build the new one..."
#docker rename bmrbdep bmrbdep_old

echo "Building the Docker container..."
if ! docker build -f ${SCRIPT_DIR}/Dockerfile -t bmrbdep .; then
    echo "Docker build failed."
    exit 4
fi

echo "Removing existing local docker image and starting the new one."
docker stop bmrbdep && docker rm bmrbdep

echo "Starting the docker container locally."
#sudo docker run -d --name bmrbdep -p 9001:9001 -p 9000:9000 --network host --restart=always -v ${deposition_dir}:/opt/wsgi/depositions -v ${SCRIPT_DIR}/BackEnd/bmrbdep/configuration.json:/opt/wsgi/bmrbdep/configuration.json bmrbdep

if [[ $1 == "production" || "$host" == "bmrb-prod.cam.uchc.edu" ]]; then
  docker run -d --name bmrbdep --restart=always --network host --user 17473:10144 \
    -v /projects/BMRB/depositions/bmrbdep:/opt/wsgi/depositions \
    -v ${SCRIPT_DIR}/BackEnd/bmrbdep/configuration_production.json:/opt/wsgi/bmrbdep/configuration.json \
   bmrbdep
else
  docker run -d --name bmrbdep --restart=always --network host --user 17473:10144 \
    -v /projects/BMRB/depositions/bmrbdep:/opt/wsgi/depositions \
    -v ${SCRIPT_DIR}/BackEnd/bmrbdep/configuration_development.json:/opt/wsgi/bmrbdep/configuration.json \
   bmrbdep
fi
