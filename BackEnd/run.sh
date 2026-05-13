#!/bin/bash

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"

cd "${DIR}" || exit 1
export FLASK_APP=bmrbdep
export FLASK_DEBUG=1
uv run --project bmrbdep flask run --host=0.0.0.0 --port 9000
