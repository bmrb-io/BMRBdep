import re
import pynmrstar


def _sort_saveframes(sort_list: list) -> list:
    """ Sort the given iterable in the way that humans expect.

    Via: https://stackoverflow.com/questions/2669059/how-to-sort-alpha-numeric-set-in-python"""

    def convert(text):
        return int(text) if text.isdigit() else text

    def alphanum_key(key):
        return [convert(c) for c in re.split('([0-9]+)', key.name)]

    return sorted(sort_list, key=alphanum_key)


def merge_entries(template_entry: pynmrstar.Entry, existing_entry: pynmrstar.Entry, new_schema: pynmrstar.Schema):
    # Rename the saveframes in the uploaded entry before merging them
    for category in existing_entry.category_list:
        for x, saveframe in enumerate(_sort_saveframes(existing_entry.get_saveframes_by_category(category))):
            # Set the "Name" tag if it isn't already set
            if (saveframe.tag_prefix + '.name').lower() in new_schema.schema:
                try:
                    saveframe.add_tag('Name', saveframe['sf_framecode'][0].replace("_", " "), update=False)
                except ValueError:
                    pass
            new_name = "%s_%s" % (saveframe.category, x + 1)
            if saveframe.name != new_name:
                existing_entry.rename_saveframe(saveframe.name, new_name)

    for category in existing_entry.category_list:
        delete_saveframes = template_entry.get_saveframes_by_category(category)
        for saveframe in delete_saveframes:
            if saveframe.category == "entry_interview":
                continue
            del template_entry[saveframe]
        for saveframe in existing_entry.get_saveframes_by_category(category):
            # Don't copy over the entry interview at all
            if saveframe.category == "entry_interview":
                continue
            new_saveframe = pynmrstar.Saveframe.from_template(category, name=saveframe.name,
                                                              entry_id=template_entry.entry_id,
                                                              default_values=True, schema=new_schema, all_tags=True)
            frame_prefix_lower = saveframe.tag_prefix.lower()

            # Don't copy the tags from entry_information
            if saveframe.category != "entry_information":
                for tag in saveframe.tags:
                    lower_tag = tag[0].lower()
                    if lower_tag not in ['sf_category', 'sf_framecode', 'id', 'entry_id', 'nmr_star_version',
                                         'original_nmr_star_version', 'atomic_coordinate_file_name',
                                         'atomic_coordinate_file_syntax', 'constraint_file_name']:
                        fqtn = frame_prefix_lower + '.' + lower_tag
                        if fqtn in new_schema.schema:
                            new_saveframe.add_tag(tag[0], tag[1], update=True)

            for loop in saveframe.loops:
                # Don't copy the experimental data loops
                if loop.category == "_Upload_data" in loop.tags:
                    continue
                lower_tags = [_.lower() for _ in loop.tags]
                tags_to_pull = [_ for _ in new_saveframe[loop.category].tags if _.lower() in lower_tags]
                filtered_original_loop = loop.filter(tags_to_pull)
                filtered_original_loop.add_missing_tags(schema=new_schema, all_tags=True)
                new_saveframe[filtered_original_loop.category] = filtered_original_loop

            template_entry.add_saveframe(new_saveframe)

    # Strip off any loop Entry_ID tags from the original entry
    for saveframe in template_entry.frame_list:
        for loop in saveframe:
            for tag in loop.tags:
                fqtn = (loop.category + "." + tag).lower()
                try:
                    tag_schema = new_schema.schema[fqtn]
                    if tag_schema['Natural foreign key'] == '_Entry.ID':
                        loop[tag] = [None] * len(loop[tag])
                except KeyError:
                    pass


def generate_entity_from_chemcomp(entry: pynmrstar.Entry, schema: pynmrstar.Schema) -> None:
    """ Generates an entity saveframe for each chem comp saveframe. """

    need_linking = []

    linked_items = entry.get_tag('_Entity_assembly.Entity_label')
    for linked_item in linked_items:
        # Remove the '$' from the beginning of the tag
        linked_saveframe = entry.get_saveframe_by_name(linked_item[1:])
        if linked_saveframe.category == 'chem_comp':
            need_linking.append(linked_saveframe)

    entity_assembly_loop = entry.get_loops_by_category('_Entity_assembly')[0]

    next_entity: int = max([int(x.name.split('_')[-1]) for x in entry.get_saveframes_by_category('entity')]) + 1
    for x, saveframe in enumerate(need_linking):
        if 'PDB_code' in saveframe and saveframe['PDB_code']:
            try:
                chemcomp_entry = pynmrstar.Entry.from_database('chemcomp_' + saveframe['PDB_code'][0].upper())
            except IOError:
                saveframe['Note_to_annotator'] = 'Attempted to automatically look up the chem_comp and entity' \
                                                 ' from the PDB_code, but it isn\'t valid. Please rectify.'
                continue

            chemcomp_saveframe = chemcomp_entry.get_saveframes_by_category('chem_comp')[0]
            chemcomp_saveframe['Paramagnetic'] = saveframe['Paramagnetic'][0]
            chemcomp_saveframe['Aromatic'] = saveframe['Aromatic'][0]
            if 'details' in saveframe:
                chemcomp_saveframe['Details'] = saveframe['Details'][0]

            new_entity = chemcomp_entry.get_saveframes_by_category('entity')[0]
            new_entity['Paramagnetic'] = saveframe['Paramagnetic'][0]

            # Replace the existing saveframes with the new ones (first rename, to preserve the links)
            entry.rename_saveframe(saveframe.name, chemcomp_saveframe.name)
            entry[saveframe.name] = chemcomp_saveframe
            entry.add_saveframe(new_entity)

        else:
            new_entity = pynmrstar.Saveframe.from_template('entity', name='entity_%s' % next_entity, schema=schema,
                                                           all_tags=False, entry_id=entry.entry_id)
            new_entity.loops = []
            new_entity['Name'] = saveframe['Name'][0]
            new_entity['Paramagnetic'] = saveframe['Paramagnetic'][0]
            new_entity['Type'] = 'non-polymer'
            new_entity['Ambiguous_conformational_states'] = 'no'
            new_entity['Nstd_chirality'] = 'no'
            new_entity['Nstd_linkage'] = 'no'
            new_entity['Thiol_state'] = 'not available'
            new_entity.add_missing_tags(schema=schema)

            comp_index_loop: pynmrstar.Loop = pynmrstar.Loop.from_scratch('_Entity_comp_index')
            comp_index_loop.add_tag(['ID', 'Comp_ID', 'Comp_label', 'Entry_ID'])
            comp_index_loop.add_data([1, saveframe['ID'][0], '$' + saveframe['Sf_framecode'][0], entry.entry_id])
            comp_index_loop.add_missing_tags(schema=schema)
            new_entity['_Entity_comp_index'] = comp_index_loop

            entry.add_saveframe(new_entity)
            next_entity += 1

        # Update the entity_assembly loop to point to the entity rather than the chem_comp
        entity_list = entity_assembly_loop['Entity_label']
        entity_list[x] = "$" + new_entity.name
        entity_assembly_loop['Entity_label'] = entity_list
