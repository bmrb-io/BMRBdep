#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

pip3 install nodeenv
python3 -m nodeenv ${DIR}/node_env
source ${DIR}/node_env/bin/activate
npm install -g @angular/cli
npm install
#npm rebuild node-sass
