#!/bin/bash

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

sudo docker stop bmrbdep
sudo docker rm bmrbdep

# Build the HTML
source ${SCRIPT_DIR}/FrontEnd/node_env/bin/activate
cd ${SCRIPT_DIR}/FrontEnd/
ng build --prod --configuration=production --output-path=release
deactivate_node
cd ${SCRIPT_DIR}

if [[ $# -eq 0 ]]
  then
    sudo docker build -t bmrbdep .
    echo "Running in development mode."
  else
    sudo docker build --build-arg configfile=$1 -t bmrbdep .
    echo "Running with configuration file: $1"
fi


sudo docker run -d --name bmrbdep  -p 9000:9000 --restart=always bmrbdep

#-v /zfs/git/bayesexplorer/app/uploads:/opt/wsgi/uploads
