#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.13"
# dependencies = ["nodeenv"]
# ///
"""Run nodeenv via uv so install.sh doesn't need a persistent Python venv."""
import runpy
import sys

sys.argv[0] = "nodeenv"
runpy.run_module("nodeenv", run_name="__main__")
