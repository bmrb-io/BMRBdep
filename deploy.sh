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


echo "Getting newest schema."
source "${SCRIPT_DIR}"/BackEnd/env/bin/activate
if ! "${SCRIPT_DIR}"/BackEnd/schema/schema_loader.py; then
  echo "Schema loader failed, quitting."
  exit
fi
deactivate

echo "Compiling angular."
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

cd dist && tar -czvf ../release.tgz ./* .htaccess && scp ../release.tgz web@${HOST}:/tmp/ && cd .. && rm -rfv release.tgz && cd "${SCRIPT_DIR}" || exit 3

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

echo "Building docker instance..."
if ! "${SCRIPT_DIR}"/build_docker.sh production.conf; then
  echo "Building docker instance failed, quitting."
  exit
fi

echo "Deploying docker instance..."
sudo docker tag bmrbig pike.bmrb.wisc.edu:5000/bmrbig
sudo docker push pike.bmrb.wisc.edu:5000/bmrbig


echo "Deploying Angular..."
#echo "cd /websites/bmrbdep/html; rm -fv /websites/bmrbdep/html/*; tar -xzvf /tmp/release.tgz" | ssh web@manta
echo "sudo docker pull pike.bmrb.wisc.edu:5000/bmrbig; sudo docker stop bmrbig; sudo docker rm bmrbig; sudo docker run -d --name bmrbig -p 9007:9000 --restart=always -v /websites/bmrbig/configuration.json:/opt/wsgi/bmrbdep/configuration.json -v /websites/bmrbig/depositions:/opt/wsgi/depositions -v /websites/bmrbig/released:/opt/wsgi/released pike.bmrb.wisc.edu:5000/bmrbig" | ssh web@blenny


echo "Don't forget to update the schema version in the remote configuration if necessary."