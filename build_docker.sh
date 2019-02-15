#!/bin/bash

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

# Check if the initial setups need to happen
${SCRIPT_DIR}/install.sh

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


sudo docker run -d --name bmrbdep  -p 9000:9000 --restart=always -v /zfs/git/depositions:/opt/wsgi/depositions bmrbdep

#docker tag bmrbdep pike.bmrb.wisc.edu:5000/bmrbdep.001
#docker push pike.bmrb.wisc.edu:5000/bmrbdep.001


#docker pull pike.bmrb.wisc.edu:5000/bmrbdep.001
#sudo docker stop bmrbdep
#sudo docker rm bmrbdep
#docker run -d --name bmrbdep -p 9000:9000 --restart=always -v /websites/bmrbdep/depositions:/opt/wsgi/depositions pike.bmrb.wisc.edu:5000/bmrbdep.001
