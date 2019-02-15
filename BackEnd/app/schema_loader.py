#!/usr/bin/env python3

import re
import os
import csv
import sys
import zlib
import optparse
import tempfile
from shutil import rmtree

import simplejson as json
import pynmrstar
from io import StringIO
from git import Git, Repo, GitCommandError

from common import root_dir

dictionary_dir = tempfile.mkdtemp()
Git(dictionary_dir).clone('https://github.com/uwbmrb/nmr-star-dictionary.git')
repo = Repo(os.path.join(dictionary_dir, 'nmr-star-dictionary'))

# Load the data types
dt_path = os.path.join(root_dir, "schema_data", "data_types.csv")
data_types = {x[0]: x[1] for x in csv.reader(open(dt_path, "rU"))}

validate_mode = False

data_type_mapping = {'Assigned_chem_shifts': 'assigned_chemical_shifts',
                     'Coupling_constants': 'coupling_constants',
                     'Auto_relaxation': 'auto_relaxation',
                     'Interatomic_distance': 'interatomic_distance',
                     'Chem_shift_anisotropy': 'chem_shift_anisotropy',
                     'Heteronucl_NOEs': 'heteronucl_NOEs',
                     'Heteronucl_T1_relaxation': 'heteronucl_T1_relaxation',
                     'Heteronucl_T2_relaxation': 'heteronucl_T2_relaxation',
                     'Heteronucl_T1rho_relaxation': 'heteronucl_T1rho_relaxation',
                     'Order_parameters': 'order_parameters',
                     'Dynamics_trajectory': None,
                     'Movie': None,
                     'Residual_dipolar_couplings': 'RDCs',
                     'H_exchange_rate': 'H_exch_rates',
                     'H_exchange_protection_factors': 'H_exch_protection_factors',
                     'Chem_rate_constants': 'chemical_rates',
                     'Spectral_peak_lists': 'spectral_peak_list',
                     'Dipole_dipole_couplings': None,
                     'Quadrupolar_couplings': None,
                     'Homonucl_NOEs': 'homonucl_NOEs',
                     'Dipole_dipole_relaxation': 'dipole_dipole_relaxation',
                     'DD_cross_correlation': 'dipole_dipole_cross_correations',
                     'Dipole_CSA_cross_correlation': 'dipole_CSA_cross_correlations',
                     'Binding_constants': 'binding_data',
                     'PKa_value_data_set': 'pH_param_list',
                     'D_H_fractionation_factors': 'D_H_fractionation_factors',
                     'Theoretical_chem_shifts': 'theoretical_chem_shifts',
                     'Spectral_density_values': 'spectral_density_values',
                     'Other_kind_of_data': 'other_data_types',
                     'Theoretical_coupling_constants': 'theoretical_coupling_constants',
                     'Theoretical_heteronucl_NOEs': 'theoretical_heteronucl_NOEs',
                     'Theoretical_T1_relaxation': 'theoretical_heteronucl_T1_relaxation',
                     'Theoretical_T2_relaxation': 'theoretical_heteronucl_T2_relaxation',
                     'Theoretical_auto_relaxation': 'theoretical_auto_relaxation',
                     'Theoretical_DD_cross_correlation': 'theoretical_dipole_dipole_cross_correlations',
                     'Timedomain_data': None,
                     'Molecular_interactions': None,
                     'Secondary_structure_orientations': 'secondary_structs',
                     'Metabolite_coordinates': None,
                     'Tensor': None,
                     'Mass_spec_data': None,
                     'Chem_shift_perturbation': 'chem_shift_perturbation',
                     'Chem_shift_isotope_effect': 'chem_shift_isotope_effect',
                     'Image_file': 'chem_comp'
                     }


def schema_emitter():
    """ Yields all the schemas in the SVN repo. """

    last_schema_version = None

    for commit in repo.iter_commits('master'):
        next_schema = load_schemas(commit)
        if next_schema is None:
            print("Reached old incompatible schemas.")
            return
        if next_schema[0] != last_schema_version:
            yield next_schema
        last_schema_version = next_schema[0]


def get_file(file_name, commit):
    """ Returns a file-like object. """

    return StringIO('\n'.join(repo.git.show('{}:{}'.format(commit.hexsha, file_name)).splitlines()))


def get_main_schema(commit):

    try:
        xmlschem_ann = csv.reader(get_file("xlschem_ann.csv", commit))
    except GitCommandError:
        return
    all_headers = next(xmlschem_ann)
    next(xmlschem_ann)
    next(xmlschem_ann)
    version = next(xmlschem_ann)[3]

    cc = ['Tag', 'Tag category', 'SFCategory', 'BMRB data type', 'Prompt', 'Interface',
          'default value', 'Example', 'User full view',
          'Foreign Table', 'Sf pointer', 'Item enumerated', 'Item enumeration closed', 'ADIT category view name',
          'Enumeration ties']
    # Todo: remove ADIT category view name once code is refactored

    header_idx = {x: all_headers.index(x) for x in cc}
    header_idx_list = [all_headers.index(x) for x in cc]

    res = {'version': version,
           'tags': {'headers': cc + ['enumerations'], 'values': {}},
           }

    for row in xmlschem_ann:
        res['tags']['values'][row[header_idx['Tag']]] = [row[x].replace("$", ",") for x in header_idx_list]

    return res


def get_data_file_types(rev):
    """ Returns the list of enabled data file [description, sf_category, entry_interview.tag_name. """

    try:
        enabled_types_file = csv.reader(get_file("adit_nmr_upload_tags.csv", rev))
    except GitCommandError:
        return

    pynmrstar.ALLOW_V2_ENTRIES = True
    types_description = pynmrstar.Entry.from_string(get_file('adit_interface_dict.txt', rev).read())

    interview_list = []
    data_mapping = {}

    for data_type in enabled_types_file:
        try:
            sf = types_description[data_type[1]]
            type_description = sf['_Adit_item_view_name'][0].strip()
            interview_tag = pynmrstar._format_tag(sf['_Tag'][0])
            # Try to get the data mapping from the dictionary if possible
            if len(data_type) > 2:
                if data_type[2] == "?":
                    sf_category = None
                else:
                    sf_category = data_type[2]
            else:
                sf_category = data_type_mapping.get(interview_tag, None)
            description = sf['_Description'][0]

            if interview_tag not in data_mapping:
                data_mapping[interview_tag] = [type_description, [sf_category], interview_tag, description]
                interview_list.append(interview_tag)
            else:
                data_mapping[interview_tag][1].append(sf_category)
        except Exception as e:
            if validate_mode:
                print('Something went wrong when loading the data types mapping.', repr(e))
            continue

    return [data_mapping[x] for x in interview_list]


def get_dict(fob, headers, number_fields, skip):
    """ Returns a dictionary with 'key' and 'value' set to point to the
    headers and the values."""

    csv_reader = csv.reader(fob)
    all_headers = next(csv_reader)
    for x in range(0, skip):
        next(csv_reader)

    def skip_end():
        for csv_row in csv_reader:
            if csv_row[0] != "TBL_END" and csv_row[0]:
                yield csv_row

    columns = [all_headers.index(x) for x in headers]
    values = [[row[x].replace("$", ",") for x in columns] for row in skip_end()]

    number_fields = [headers.index(x) for x in number_fields]
    for row in values:
        for i in number_fields:
            try:
                if row[i]:
                    row[i] = int(row[i])
                else:
                    row[i] = 0
            except ValueError:
                print(row)

    return {'headers': headers, 'values': values}


def load_schemas(rev):
    # Load the schemas into the DB

    res = get_main_schema(rev)
    if not res:
        return None

    res['data_types'] = data_types
    res['overrides'] = get_dict(get_file("adit_man_over.csv", rev),
                                ['Tag', 'Sf category', 'Tag category', 'Conditional tag', 'Override view value',
                                 'Override value', 'Order of operation'],
                                ['Order of operation'],
                                1)

    res['supergroup_descriptions'] = get_dict(get_file('adit_super_grp_o.csv', rev),
                                              ['super_group_ID', 'super_group_name', 'Description'],
                                              ['super_group_ID'],
                                              2)

    res['category_supergroups'] = get_dict(get_file("adit_cat_grp_o.csv", rev),
                                           ['category_super_group', 'saveframe_category', 'mandatory_number',
                                            'allowed_user_defined_framecode', 'category_group_view_name',
                                            'group_view_help', 'category_super_group_ID'],
                                           ['mandatory_number', 'category_super_group_ID'],
                                           2)

    # Check for outdated overrides
    if validate_mode:
        for override in res['overrides']['values']:
            if override[0] != "*" and override[0] not in res['tags']['values']:
                print("Override specifies invalid tag: %s" % override[0])

    sf_category_info = get_dict(get_file("adit_cat_grp_o.csv", rev),
                                ['saveframe_category', 'category_group_view_name', 'mandatory_number',
                                 'ADIT replicable', 'group_view_help'],
                                ['mandatory_number'],
                                2)

    res['saveframes'] = {'headers': sf_category_info['headers'][1:], 'values': {}}
    for sfo in sf_category_info['values']:
        res['saveframes']['values'][sfo[0]] = sfo[1:]

    # Load the enumerations
    try:
        enumerations = get_file('enumerations.txt', rev).read()
        enumerations = enumerations.replace('\x00', '').replace('\xd5', '')
        enumerations = re.sub('_Revision_date.*', '', enumerations)
        pynmrstar.ALLOW_V2_ENTRIES = True
        enum_entry = pynmrstar.Entry.from_string(enumerations)
        for saveframe in enum_entry:
            enums = [x.replace("$", ",") for x in saveframe[0].get_data_by_tag('_item_enumeration_value')[0]]
            try:
                res['tags']['values'][saveframe.name].append(enums)
            except KeyError:
                if validate_mode:
                    print("Enumeration for non-existent tag: %s" % saveframe.name)

    except ValueError as e:
        if validate_mode:
            print("Invalid enum file in version %s: %s" % (res['version'], str(e)))
    finally:
        pynmrstar.ALLOW_V2_ENTRIES = False

    res['file_upload_types'] = get_data_file_types(rev)

    return res['version'], res


if __name__ == "__main__":

    # Specify some basic information about our command
    optparser = optparse.OptionParser(description="Create local cache of NMR-STAR schemas.")
    optparser.add_option("--full", action="store_true", dest="full", default=False,
                         help="Create all schemas, not just the most recent one.")
    # Options, parse 'em
    (options, cmd_input) = optparser.parse_args()

    try:
        for schema in schema_emitter():
            with open(os.path.join(root_dir, 'schema_data', schema[0] + '.json.zlib'), 'wb') as schema_file:
                j = json.dumps(schema[1])
                schema_file.write(zlib.compress(j.encode('utf-8')))
            highest_schema = schema[0]
            print("Set schema: %s" % schema[0])
            if not options.full:
                # Make schemas at least up to the one specified in the install script
                if schema[0] == "3.2.1.21":
                    sys.exit(0)
    finally:
        rmtree(dictionary_dir)