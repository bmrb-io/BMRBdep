#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"

if [[ $1 == "production" ]]; then
    echo "Production release..."
    HOST="blenny"
else
    echo "Development release..."
    HOST="manta"
fi

cd ${SCRIPT_DIR}
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$BRANCH" != "master" ]] && [[ $1 == "production" ]]; then
  echo 'Deploying to production only allowed from master.';
  exit 1;
fi

echo "Building docker instance..."
if [[ $1 == "production" ]]; then
    if ! "${SCRIPT_DIR}"/build_docker.sh production; then
      echo "Building docker instance failed, quitting."
      exit
    fi
else
  if ! "${SCRIPT_DIR}"/build_docker.sh; then
      echo "Building docker instance failed, quitting."
      exit
    fi
fi

echo "Copying the web files into place..."
cd dist && tar -czvf ../release.tgz ./* .htaccess && scp ../release.tgz web@${HOST}:/tmp/ && cd .. && rm -rfv release.tgz && cd "${SCRIPT_DIR}" || exit 3

echo "Deploying docker instance..."
sudo docker tag bmrbdep pike.bmrb.wisc.edu:5000/bmrbdep
sudo docker push pike.bmrb.wisc.edu:5000/bmrbdep

if [[ $1 == "production" ]]; then
    echo "Deploying Angular..."
    echo "cd /websites/bmrbdep/bmrbdep_shared/html; rm -fv /websites/bmrbdep/bmrbdep_shared/html/*; tar -xzvf /tmp/release.tgz" | ssh web@blenny
    echo "sudo docker pull pike.bmrb.wisc.edu:5000/bmrbdep; sudo docker stop bmrbdep; sudo docker rm bmrbdep; sudo docker run -d --name bmrbdep -p 9000:9000 --restart=always -v /depositions:/opt/wsgi/depositions -v /websites/bmrbdep/bmrbdep_shared/configuration.json:/opt/wsgi/bmrbdep/configuration.json pike.bmrb.wisc.edu:5000/bmrbdep" | ssh web@blenny
    echo "sudo docker pull pike.bmrb.wisc.edu:5000/bmrbdep; sudo docker stop bmrbdep; sudo docker rm bmrbdep; sudo docker run -d --name bmrbdep -p 9000:9000 --restart=always -v /depositions:/opt/wsgi/depositions -v /websites/bmrbdep/bmrbdep_shared/configuration.json:/opt/wsgi/bmrbdep/configuration.json pike.bmrb.wisc.edu:5000/bmrbdep" | ssh web@herring
else
    echo "Deploying Angular..."
    echo "cd /websites/bmrbdep/html; rm -fv /websites/bmrbdep/html/*; tar -xzvf /tmp/release.tgz" | ssh web@manta
    echo "sudo docker pull pike.bmrb.wisc.edu:5000/bmrbdep; sudo docker stop bmrbdep; sudo docker rm bmrbdep; sudo docker run -d --name bmrbdep -p 9000:9000 --restart=always -v /websites/bmrbdep/configuration.json:/opt/wsgi/bmrbdep/configuration.json -v /bmrbdep/depositions:/opt/wsgi/depositions pike.bmrb.wisc.edu:5000/bmrbdep" | ssh manta
fi

echo "Don't forget to update the schema version in the remote configuration if necessary."