#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"

# Check if the initial setups need to happen
"${SCRIPT_DIR}"/install.sh

sudo docker stop bmrbdep
sudo docker rm bmrbdep

# We're going to make a special directory with just the docker build context
mkdir -p ${SCRIPT_DIR}/docker_build/
rm -rf ${SCRIPT_DIR}/docker_build/*
cp -r ${SCRIPT_DIR}/wsgi.conf ${SCRIPT_DIR}/BackEnd/bmrbdep ${SCRIPT_DIR}/BackEnd/schema/schema_data ${SCRIPT_DIR}/FrontEnd/dist ${SCRIPT_DIR}/docker_build
find ${SCRIPT_DIR}/docker_build -name __pycache__ -print0 | xargs -0 rm -rf

if [[ $# -eq 0 ]]; then
  if ! sudo docker build -f ${SCRIPT_DIR}/Dockerfile -t bmrbdep ${SCRIPT_DIR}/docker_build; then
    echo "Docker build failed."
    exit 2
  fi
  echo "Running in development mode."
  sudo docker run -d --name bmrbdep -p 4444:9001 --restart=always -v /opt/wsgi/depositions:/opt/wsgi/depositions -v ${SCRIPT_DIR}/BackEnd/bmrbdep/configuration.json:/opt/wsgi/bmrbdep/configuration.json bmrbdep
else
  if ! sudo docker build --build-arg configfile="$1" -t bmrbdep ${SCRIPT_DIR}/docker_build; then
    echo "Docker build failed."
    exit 3
  fi
  echo "Building with configuration file: $1"
fi

rm -rf ${SCRIPT_DIR}/docker_build