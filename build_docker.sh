#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"

# Check if the initial setups need to happen
"${SCRIPT_DIR}"/install.sh

echo "Removing existing local docker image"
docker stop bmrbdep
docker rm bmrbdep

# We're going to make a special directory with just the docker build context
mkdir -p ${SCRIPT_DIR}/docker_build/
rm -rf ${SCRIPT_DIR}/docker_build/*
cp -rp ${SCRIPT_DIR}/wsgi.conf ${SCRIPT_DIR}/BackEnd/bmrbdep ${SCRIPT_DIR}/BackEnd/schema/schema_data ${SCRIPT_DIR}/FrontEnd/dist ${SCRIPT_DIR}/docker_build
find ${SCRIPT_DIR}/docker_build -name __pycache__ -print0 | xargs -0 rm -rf

rm -rf ${SCRIPT_DIR}/docker_build
echo "Compiling angular."
(
source "${SCRIPT_DIR}"/FrontEnd/node_env/bin/activate
cd "${SCRIPT_DIR}"/FrontEnd || exit 2
if ! npm run build.prod; then
  echo "Angular build failed, quitting."
  exit 3
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
docker stop bmrbig
docker rm bmrbig


echo "Building the Docker container..."
if ! docker build -f ${SCRIPT_DIR}/Dockerfile -t bmrbig .; then
    echo "Docker build failed."
    exit 4
fi

echo "Starting the docker container locally."
docker run -d --name bmrbig --net="host" -p 9001:9001 -p 9000:9000 --restart=always -v /bmrbig/depositions:/opt/wsgi/depositions -v /bmrbig/released:/opt/wsgi/released -v ${SCRIPT_DIR}/BackEnd/bmrbdep/configuration.json:/opt/wsgi/bmrbdep/configuration.json bmrbig
