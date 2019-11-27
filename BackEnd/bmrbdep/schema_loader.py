#!/usr/bin/env python3

import csv
import io
import optparse
import os
import re
import sys
import zlib
from io import StringIO

import pynmrstar
import simplejson as json
from git import Git, Repo, GitCommandError

root_dir: str = os.path.dirname(os.path.realpath(__file__))

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
                     'DD_cross_correlation': 'dipole_dipole_cross_correlations',
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
                     'Tensor': 'tensor',
                     'Mass_spec_data': None,
                     'Chem_shift_perturbation': 'chem_shift_perturbation',
                     'Chem_shift_isotope_effect': 'chem_shift_isotope_effect',
                     'Image_file': 'chem_comp'
                     }


def schema_emitter(validate_mode=False, small_molecule=False):
    """ Yields all the schemas in the SVN repo. """

    last_schema_version = None

    for commit in repo.iter_commits('nmr-star-development'):
        next_schema = load_schemas(commit, validate_mode=validate_mode, small_molecule=small_molecule)
        if next_schema is None:
            continue
        if next_schema[0] != last_schema_version:
            yield next_schema
        last_schema_version = next_schema[0]


def get_file(file_name, commit):
    """ Returns a file-like object. """

    try:
        file_contents = StringIO('\n'.join(repo.git.show('{}:{}'.format(commit.hexsha, file_name)).splitlines()))
    except GitCommandError as err:
        if ("Path '" + file_name + "' does not exist") in str(err):
            file_name = 'NMR-STAR/internal_106_distribution/%s' % file_name
            try:
                file_contents = StringIO(
                    '\n'.join(repo.git.show('{}:{}'.format(commit.hexsha, file_name)).splitlines()))
            except GitCommandError:
                return None
        else:
            return None

    return file_contents


def get_main_schema(commit, small_molecule=False):
    try:
        xmlschem_ann = csv.reader(get_file("xlschem_ann.csv", commit))
    except GitCommandError:
        return None, None
    if xmlschem_ann is None:
        return None, None
    whole_schema = [next(xmlschem_ann), next(xmlschem_ann), next(xmlschem_ann), next(xmlschem_ann)]
    version = whole_schema[3][3]

    cc = ['Tag', 'Tag category', 'SFCategory', 'BMRB data type', 'Prompt', 'Interface',
          'default value', 'Example', 'User full view',
          'Foreign Table', 'Sf pointer', 'Item enumerated', 'Item enumeration closed', 'ADIT category view name',
          'Enumeration ties']
    if small_molecule:
        cc.append('Metabolites')

    # Todo: remove ADIT category view name once code is refactored

    header_idx = {x: whole_schema[0].index(x) for x in cc}
    header_idx_list = [whole_schema[0].index(x) for x in cc]

    res = {'version': version,
           'tags': {'headers': cc + ['enumerations'], 'values': {}},
           }

    for row in xmlschem_ann:
        if small_molecule:
            if row[header_idx['Metabolites']] == 'B' or row[header_idx['Metabolites']] == 'S':
                res['tags']['values'][row[header_idx['Tag']]] = [row[x].replace("$", ",") for x in header_idx_list]
                whole_schema.append(row)
        else:
            res['tags']['values'][row[header_idx['Tag']]] = [row[x].replace("$", ",") for x in header_idx_list]
            whole_schema.append(row)

    return res, whole_schema


def get_data_file_types(rev, validate_mode=False):
    """ Returns the list of enabled data file [description, sf_category, entry_interview.tag_name. """

    try:
        enabled_types_file = get_file("adit_nmr_upload_tags.csv", rev)
    except GitCommandError:
        return
    if enabled_types_file is None:
        return None
    else:
        enabled_types_file = csv.reader(enabled_types_file)

    types_description = get_file('adit_interface_dict.txt', rev)
    if types_description is None:
        return None
    else:
        types_description = pynmrstar.Entry.from_string(types_description.read())

    interview_list = []
    data_mapping = {}

    for data_type in enabled_types_file:
        try:
            sf = types_description[data_type[1]]
            type_description = sf['Adit_item_view_name'][0].strip()
            interview_tag = pynmrstar.utils.format_tag(sf['Tag'][0])
            # Try to get the data mapping from the dictionary if possible
            if len(data_type) > 2:
                if data_type[2] == "?":
                    sf_category = None
                else:
                    sf_category = data_type[2]
            else:
                sf_category = data_type_mapping.get(interview_tag, None)
            description = sf['Description'][0]

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
    for x in range(skip):
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


def load_schemas(rev, validate_mode=False, small_molecule=False):
    # Load the schemas into the DB

    result, xl_schema = get_main_schema(rev, small_molecule=small_molecule)
    if not result:
        return None

    result['data_types'] = data_types

    override = get_file("adit_man_over.csv", rev)
    if not override:
        return None
    result['overrides'] = get_dict(override,
                                   ['Tag', 'Sf category', 'Tag category', 'Conditional tag', 'Override view value',
                                    'Override value', 'Order of operation'],
                                   ['Order of operation'],
                                   1)

    result['supergroup_descriptions'] = get_dict(get_file('adit_super_grp_o.csv', rev),
                                                 ['super_group_ID', 'super_group_name', 'Description'],
                                                 ['super_group_ID'],
                                                 2)

    result['category_supergroups'] = get_dict(get_file("adit_cat_grp_o.csv", rev),
                                              ['category_super_group', 'saveframe_category', 'mandatory_number',
                                               'allowed_user_defined_framecode', 'category_group_view_name',
                                               'group_view_help', 'category_super_group_ID'],
                                              ['mandatory_number', 'category_super_group_ID'],
                                              2)

    # Check for outdated overrides
    if validate_mode:
        for override in result['overrides']['values']:
            if override[0] != "*" and override[0] not in result['tags']['values'] and not sm:
                print("Override specifies invalid tag: %s" % override[0])

    sf_category_info = get_dict(get_file("adit_cat_grp_o.csv", rev),
                                ['saveframe_category', 'category_group_view_name', 'mandatory_number',
                                 'ADIT replicable', 'group_view_help'],
                                ['mandatory_number'],
                                2)

    result['saveframes'] = {'headers': sf_category_info['headers'][1:], 'values': {}}
    for sfo in sf_category_info['values']:
        result['saveframes']['values'][sfo[0]] = sfo[1:]

    # Load the enumerations
    try:
        enumerations = get_file('enumerations.txt', rev).read()
        # This makes it not choke on the fact there are no tags
        enumerations = enumerations.replace("loop_", "_dummy.dummy dummy loop_")
        enum_entry = pynmrstar.Entry.from_string(enumerations)
        for saveframe in enum_entry:
            # Skip the initial saveframe
            if '_Item_enumeration' not in saveframe:
                continue
            enums = [x.replace("$", ",") for x in saveframe['_Item_enumeration'].get_tag('Value')]
            try:
                result['tags']['values'][saveframe.name].append(enums)
            except KeyError:
                if validate_mode and not sm:
                    print("Enumeration for non-existent tag: %s" % saveframe.name)

    except pynmrstar.exceptions.ParsingError as e:
        if validate_mode:
            print("Invalid enum file in version %s: %s" % (result['version'], str(e)))

    result['file_upload_types'] = get_data_file_types(rev, validate_mode=validate_mode)

    return result['version'], result, xl_schema


if __name__ == "__main__":

    # Specify some basic information about our command
    optparser = optparse.OptionParser(description="Create local cache of NMR-STAR schemas.")
    optparser.add_option("--full", action="store_true", dest="full", default=False,
                         help="Create all schemas, not just the most recent one.")
    optparser.add_option("--validate", action="store_true", dest="validate", default=False,
                         help="Validate the schemas as they are loaded.")
    optparser.add_option("--force", action="store_true", dest="force", default=False,
                         help="Always generate at least the most recent schema, regardless of the commit file.")
    # Options, parse 'em
    (options, cmd_input) = optparser.parse_args()

    # Do some standard initialization
    dt_path = os.path.join(root_dir, "schema_data", "data_types.csv")
    dictionary_dir = os.path.join(root_dir, 'nmr-star-dictionary')

    # Pull changes
    if not os.path.exists(dictionary_dir):
        Git(root_dir).clone('https://github.com/uwbmrb/nmr-star-dictionary.git')
    repo = Repo(dictionary_dir)
    repo.remotes.origin.pull()
    most_recent_commit = repo.commit()

    # Quit early if there aren't any new commits
    last_commit_file = os.path.join(root_dir, "schema_data", 'last_commit')
    if os.path.exists(last_commit_file) and open(last_commit_file, 'r').read() == str(most_recent_commit) and \
            not options.force and not options.full:
        print('Schemas already up to date according to git commit stored.')
        sys.exit(0)

    # Check out the development branch
    repo.git.checkout('nmr-star-development')

    # Load the data types
    data_types = {x[0]: x[1] for x in csv.reader(open(dt_path, "r"))}

    try:
        for sm in [True, False]:
            one_overwritten = False
            if sm:
                print("Loading small molecule schemas.")
            else:
                print("Loading macromolecule schemas.")
            for schema in schema_emitter(validate_mode=options.validate, small_molecule=sm):

                if sm:
                    web_schema_location = os.path.join(root_dir, 'schema_data', schema[0] + '-sm.json.zlib')
                    xml_schema_location = os.path.join(root_dir, 'schema_data', schema[0] + '-sm.xml')
                else:
                    web_schema_location = os.path.join(root_dir, 'schema_data', schema[0] + '.json.zlib')
                    xml_schema_location = os.path.join(root_dir, 'schema_data', schema[0] + '.xml')

                if os.path.exists(web_schema_location):
                    if one_overwritten and not options.full:
                        break
                    else:
                        print("Overwriting the most recent schema to ensure it is the newest one.")
                    one_overwritten = True

                # Write out the web schema
                with open(web_schema_location, 'wb') as schema_file:
                    j = json.dumps(schema[1])
                    schema_file.write(zlib.compress(j.encode('utf-8')))

                # Write out the pynmrstar input file XML
                with open(xml_schema_location, 'w') as schema_file:
                    output = io.StringIO()
                    csv.writer(output).writerows(schema[2])
                    schema_file.write(output.getvalue())

                highest_schema = schema[0]
                print("Set schema: %s" % schema[0])
                if not options.full:
                    # Make schemas at least up to the oldest one in use (check depositions manually before updating!)
                    if schema[0] == "3.2.1.43":
                        break

        # Write out the commit at the end to ensure success
        open(last_commit_file, 'w').write(str(most_recent_commit))
    finally:
        pass
