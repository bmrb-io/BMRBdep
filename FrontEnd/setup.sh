#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

pip3 install nodeenv
python3 -m nodeenv ${DIR}/node_env
source ${DIR}/node_env/bin/activate
cd ${DIR}
npm install -g @angular/cli --silent
npm install --silent
cd -
#npm rebuild node-sass
