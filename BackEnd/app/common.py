#!/usr/bin/env python3

import os
import zlib
import simplejson as json
from typing import Union, TextIO

# Load the configuration file
import werkzeug.utils

root_dir: str = os.path.dirname(os.path.realpath(__file__))
configuration: dict = json.loads(open(os.path.join(root_dir, 'configuration.json'), "r").read())

residue_mappings = {'polypeptide(L)': {'P': 'PRO', 'G': 'GLY', 'A': 'ALA', 'R': 'ARG', 'N': 'ASN',
                                       'D': 'ASP', 'C': 'CYS', 'Q': 'GLN', 'E': 'GLU', 'H': 'HIS',
                                       'I': 'ILE', 'L': 'LEU', 'K': 'LYS', 'M': 'MET', 'F': 'PHE',
                                       'S': 'SER', 'T': 'THR', 'W': 'TRP', 'Y': 'TYR', 'V': 'VAL',
                                       'U': 'SEC'},
                    'polyribonucleotide': {'A': 'A', 'C': 'C', 'G': 'G', 'T': 'T', 'U': 'U'},
                    'polydeoxyribonucleotide': {'A': 'DA', 'C': 'DC', 'G': 'DG', 'T': 'DT', 'U': 'DU'}}


def get_schema(version: str, schema_format: str = "json") -> Union[dict, TextIO]:
    """ Return the schema from disk. """

    try:
        if schema_format == "json":
            with open(os.path.join(root_dir, 'schema_data', version + '.json.zlib'), 'rb') as schema_file:
                schema = json.loads(zlib.decompress(schema_file.read()).decode())
        elif schema_format == "xml":
            return open(os.path.join(root_dir, 'schema_data', version + '.xml'), 'r')
        else:
            raise ServerError('Attempted to load invalid schema type.')
    except IOError:
        raise RequestError("Invalid schema version.")

    return schema


def get_release():
    """ Returns the git branch and last commit that were present during the last release. """

    return open(os.path.join(root_dir, 'version.txt'), 'r').read().strip()


def secure_filename(filename: str) -> str:
    """ Wraps werkzeug secure_filename but raises an error if the filename comes out empty. """

    filename = werkzeug.utils.secure_filename(filename)
    if not filename:
        raise RequestError('Invalid upload file name. Please rename the file and try again.')
    return filename


class ServerError(Exception):
    """ Something is wrong with the server. """
    status_code = 500

    def __init__(self, message, status_code=None, payload=None):
        Exception.__init__(self)
        self.message = message
        if status_code is not None:
            self.status_code = status_code
        self.payload = payload

    def __repr__(self) -> str:
        return 'ServerError("%s")' % self.message

    def __str__(self) -> str:
        return self.message

    def to_dict(self) -> dict:
        """ Converts the payload to a dictionary."""
        rv = dict(self.payload or ())
        rv['error'] = self.message
        return rv


class RequestError(Exception):
    """ Something is wrong with the request. """
    status_code = 400

    def __init__(self, message, status_code=None, payload=None):
        Exception.__init__(self)
        self.message = message
        if status_code is not None:
            self.status_code = status_code
        self.payload = payload

    def __repr__(self) -> str:
        return 'RequestError("%s")' % self.message

    def __str__(self) -> str:
        return self.message

    def to_dict(self) -> dict:
        """ Converts the payload to a dictionary."""
        rv = dict(self.payload or ())
        rv['error'] = self.message
        return rv
