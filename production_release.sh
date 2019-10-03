#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"

echo "Getting newest schema."
source "${SCRIPT_DIR}"/BackEnd/schema_venv/bin/activate
if ! "${SCRIPT_DIR}"/BackEnd/app/schema_loader.py; then
  echo "Schema loader failed, quitting."
  exit
fi
deactivate

echo "Compiling angular."
source "${SCRIPT_DIR}"/FrontEnd/node_env/bin/activate
cd "${SCRIPT_DIR}"/FrontEnd || exit 1
if ! npm run build.prod; then
  echo "Angular build failed, quitting."
  exit
fi
cd dist || exit 2
tar -czvf ../release.tgz ./* .htaccess
scp ../release.tgz web@blenny:/tmp/
cd ..
rm -rfv release.tgz
cd "${SCRIPT_DIR}" || exit 3

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
echo "$(parse_git_branch)$(parse_git_hash)" > "${SCRIPT_DIR}"/BackEnd/app/version.txt

echo "Building docker instance..."
if ! "${SCRIPT_DIR}"/build_docker.sh production.conf; then
  echo "Building docker instance failed, quitting."
  exit
fi

echo "Deploying Angular..."
echo "cd /websites/bmrbdep/bmrbdep_shared/html; rm -fv /websites/bmrbdep/bmrbdep_shared/html/*; tar -xzvf /tmp/release.tgz" | ssh web@blenny

echo "Deploying docker instance..."
sudo docker tag bmrbdep pike.bmrb.wisc.edu:5000/bmrbdep
sudo docker push pike.bmrb.wisc.edu:5000/bmrbdep

echo "sudo docker pull pike.bmrb.wisc.edu:5000/bmrbdep; sudo docker stop bmrbdep; sudo docker rm bmrbdep; sudo docker run -d --name bmrbdep -p 9000:9000 --restart=always -v /depositions:/opt/wsgi/depositions -v /websites/bmrbdep/bmrbdep_shared/configuration.json:/opt/wsgi/configuration.json pike.bmrb.wisc.edu:5000/bmrbdep" | ssh web@blenny
echo "sudo docker pull pike.bmrb.wisc.edu:5000/bmrbdep; sudo docker stop bmrbdep; sudo docker rm bmrbdep; sudo docker run -d --name bmrbdep -p 9000:9000 --restart=always -v /depositions:/opt/wsgi/depositions -v /websites/bmrbdep/bmrbdep_shared/configuration.json:/opt/wsgi/configuration.json pike.bmrb.wisc.edu:5000/bmrbdep" | ssh web@herring
