#!/usr/bin/env python3

import os
import pathlib
import zlib
from io import StringIO
from typing import Union, TextIO, Tuple, Iterable, List, Optional

import simplejson as json
import werkzeug.utils

from bmrbdep.exceptions import ServerError, RequestError

root_dir: str = os.path.dirname(os.path.realpath(__file__))
with open(os.path.join(root_dir, 'configuration.json'), "r") as _config_file:
    configuration: dict = json.loads(_config_file.read())

# If we are running in docker, ignore the 'repo_path' and use the standard location
try:
    with open('/proc/self/cgroup', 'r') as _cgroup_file:
        in_docker = '/docker' in _cgroup_file.read()
    if in_docker or os.path.exists('/.dockerenv'):
        configuration['repo_path'] = '/opt/wsgi/depositions'
except IOError:
    pass

residue_mappings = {'polypeptide(L)': {'P': 'PRO', 'G': 'GLY', 'A': 'ALA', 'R': 'ARG', 'N': 'ASN',
                                       'D': 'ASP', 'C': 'CYS', 'Q': 'GLN', 'E': 'GLU', 'H': 'HIS',
                                       'I': 'ILE', 'L': 'LEU', 'K': 'LYS', 'M': 'MET', 'F': 'PHE',
                                       'S': 'SER', 'T': 'THR', 'W': 'TRP', 'Y': 'TYR', 'V': 'VAL',
                                       'U': 'SEC'},
                    'polyribonucleotide': {'A': 'A', 'C': 'C', 'G': 'G', 'T': 'T', 'U': 'U'},
                    'polydeoxyribonucleotide': {'A': 'DA', 'C': 'DC', 'G': 'DG', 'T': 'DT', 'U': 'DU'}}


def filter_null_values(values: Iterable[Optional[str]]) -> List[str]:
    """ Filters NMR-STAR null placeholders ("." and "?") and None out of a list of tag values. """

    return [_ for _ in values if _ != "." and _ != "?" and _ is not None]


def format_contact_names(given_family_pairs: Iterable[Iterable[Optional[str]]]) -> List[str]:
    """ Turns a list of (Given_name, Family_name) pairs (as returned by
    `loop.get_tag(['Given_name', 'Family_name'])`) into a list of "Given Family" strings,
    dropping NMR-STAR null placeholders and entries that come out empty. """

    names: List[str] = []
    for pair in given_family_pairs:
        parts = [p.strip() for p in filter_null_values(list(pair)) if p and p.strip()]
        if parts:
            names.append(" ".join(parts))
    return names


def is_admin_email(email: Optional[str]) -> bool:
    """ Returns whether the given e-mail address belongs to a configured administrator.

    The comparison is case-insensitive and whitespace-insensitive on both sides so that the
    session e-mail and the configured admin list don't have to match byte-for-byte. """

    if not email:
        return False
    normalized = email.strip().lower()
    admins = configuration.get('admin_emails') or []
    return normalized in {str(_).strip().lower() for _ in admins}


def get_schema(version: str, schema_format: str = "json") -> Union[dict, TextIO]:
    """ Return the schema from disk. """

    # When running locally
    schema_dir = os.path.join(root_dir, '..', 'schema', 'schema_data')
    if not os.path.exists(schema_dir):
        schema_dir = os.path.join(root_dir, '..', 'schema_data')
        if not os.path.exists(schema_dir):
            raise IOError("No schema directory found: %s" % schema_dir)

    try:
        if schema_format == "json":
            with open(os.path.join(schema_dir, version + '.json.zlib'), 'rb') as schema_file:
                schema = json.loads(zlib.decompress(schema_file.read()).decode())
        elif schema_format == "xml":
            # pynmrstar (the consumer) reads but never closes a passed file object, so read the
            # content here within a context manager and hand it a StringIO to avoid leaking the handle.
            with open(os.path.join(schema_dir, version + '.xml'), 'r') as xml_file:
                return StringIO(xml_file.read())
        else:
            raise ServerError('Attempted to load invalid schema type.')
    except IOError:
        raise RequestError("Invalid schema version.")

    return schema


def get_release():
    """ Returns the git branch and last commit that were present during the last release. """

    with open(os.path.join(root_dir, 'version.txt'), 'r') as version_file:
        return version_file.read().strip()


def secure_filename(filename: str) -> str:
    """ Wraps werkzeug secure_filename but raises an error if the filename comes out empty. """

    filename = werkzeug.utils.secure_filename(filename)
    if not filename:
        raise RequestError('Invalid upload file name. Please rename the file and try again.')
    return filename


def secure_full_path(path: str) -> Tuple[str, str]:
    """ Takes a path, secures each component, reassembles them,
        and returns (secure_path, secure_file_name)."""

    # This ensures that no hijinks in the file names or issues with OS file names exist
    joined_path_elements = [secure_filename(_) for _ in pathlib.Path(os.path.dirname(path)).parts if _]
    if joined_path_elements:
        file_path = os.path.join(*joined_path_elements)
    else:
        file_path = ''
    file_name: str = secure_filename(os.path.basename(path))

    return file_path, file_name

def list_all_depositions() -> Iterable[str]:
    repo = configuration['repo_path']

    for level1 in os.scandir(repo):
        if not level1.is_dir() or len(level1.name) != 1:
            continue
        for level2 in os.scandir(level1.path):
            if not level2.is_dir():
                continue
            for level3 in os.scandir(level2.path):
                if level3.is_dir():
                    yield level3.name
