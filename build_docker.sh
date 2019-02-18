#!/bin/bash

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

# Check if the initial setups need to happen
${SCRIPT_DIR}/install.sh

sudo docker stop bmrbdep
sudo docker rm bmrbdep

# Build the HTML
source ${SCRIPT_DIR}/FrontEnd/node_env/bin/activate
cd ${SCRIPT_DIR}/FrontEnd/
npm run build.prod
deactivate_node
cd ${SCRIPT_DIR}

if [[ $# -eq 0 ]]
  then
    sudo docker build -t bmrbdep .
    echo "Running in development mode."
    sudo docker run -d --name bmrbdep  -p 9000:9000 --restart=always -v /tmp/depositions:/opt/wsgi/depositions bmrbdep
  else
    sudo docker build --build-arg configfile=$1 -t bmrbdep .
    echo "Running with configuration file: $1"
fi
