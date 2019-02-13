#!/usr/bin/env python3

import os
import zlib
import simplejson as json

# Load the configuration file
root_dir = os.path.dirname(os.path.realpath(__file__))
configuration = json.loads(open(os.path.join(root_dir, 'configuration.json'), "r").read())


def get_schema(version):
    """ Return the schema from Redis. """

    try:
        with open(os.path.join(root_dir, 'schema_data', version + '.json.zlib'), 'rb') as schema_file:
            schema = json.loads(zlib.decompress(schema_file.read()))
    except IOError:
        raise RequestError("Invalid schema version.")

    return schema


class ServerError(Exception):
    """ Something is wrong with the server. """
    status_code = 500

    def __init__(self, message, status_code=None, payload=None):
        Exception.__init__(self)
        self.message = message
        if status_code is not None:
            self.status_code = status_code
        self.payload = payload

    def __repr__(self):
        return 'ServerError("%s")' % self.message

    def __str__(self):
        return self.message

    def to_dict(self):
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

    def __repr__(self):
        return 'RequestError("%s")' % self.message

    def __str__(self):
        return self.message

    def to_dict(self):
        """ Converts the payload to a dictionary."""
        rv = dict(self.payload or ())
        rv['error'] = self.message
        return rv
