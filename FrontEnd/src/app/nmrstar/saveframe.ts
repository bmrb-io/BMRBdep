import {Entry} from './entry';
import {Loop} from './loop';
import {checkTagIsRequired, checkValueIsNull, cleanValue, isMixedCase} from './nmrstar';
import {LoopTag, SaveframeTag, Tag} from './tag';
import {sprintf} from 'sprintf-js';

export function saveframeFromJSON(jdata: Object, parent: Entry): Saveframe {
  const test: Saveframe = new Saveframe(jdata['name'], jdata['category'], jdata['tag_prefix'], parent);
  test.addTags(jdata['tags']);
  for (const loopJSON of jdata['loops']) {
    const newLoop = new Loop(loopJSON['category'], loopJSON['tags'], loopJSON['data'], test);
    test.addLoop(newLoop);
  }
  return test;
}

export class Saveframe {
  name: string;
  category: string;
  tagPrefix: string;
  tags: SaveframeTag[];
  loops: Loop[];
  parent: Entry;
  display: string;
  valid: boolean;
  deleted: boolean;
  tagDict: {};
  schemaValues: {};
  saveframesInCategory: number;
  nextCategory: string;
  previousCategory: string;

  constructor(name: string, category: string, tagPrefix: string, parent: Entry, tags: SaveframeTag[] = [], loops: Loop[] = []) {
    this.name = name;
    this.category = category;
    this.tagPrefix = tagPrefix;
    this.tags = tags;
    this.loops = loops;
    this.parent = parent;
    this.tagDict = {};
    this.display = 'H';
    this.valid = true;
    this.deleted = false;
    this.saveframesInCategory = 0;
    this.nextCategory = null;
    this.previousCategory = null;
    if (this.parent.schema) {
      this.schemaValues = this.parent.schema.saveframeSchema[this.category];
    }
    // Add default values if a saveframe exists that the schema can't handle
    if (!this.schemaValues) {
      console.warn('Saveframe without category description:', this);
      this.schemaValues = {
        'ADIT replicable': false,
        'category_group_view_name': 'Unknown saveframe category.',
        'group_view_help': 'Unknown category - no help available.',
        'mandatory_number': 0
      };
    }

    for (const tag of this.tags) {
      this.tagDict[tag.fullyQualifiedTagName] = tag;
    }
  }

  log() {
    console.log(this);
  }

  clear(): void {
    // Copy the tags
    for (const tag of this.tags) {
      if (tag.name === 'Sf_framecode' || tag.name === 'Sf_category' || tag.name === '_Deleted') {
        continue;
      }
      tag.value = null;
      if (tag.schemaValues['default value'] !== '?') {
        tag.value = tag.schemaValues['default value'];
      }
    }

    // Copy the loops
    for (const loop of this.loops) {
      loop.clear();
    }
    this.refresh();
  }

  delete() {
    this.getTag('_Deleted').value = 'yes';
  }

  restore() {
    this.getTag('_Deleted').value = 'no';
  }

  duplicate(clearValues: boolean = false): Saveframe {
    let frameIndex = this.parent.getSaveframesByCategory(this.category).length + 1;
    let frameName = this.category + '_' + frameIndex;
    while (this.parent.getSaveframeByName(frameName)) {
      frameIndex += 1;
      frameName = this.category + '_' + frameIndex;
    }

    const newFrame = new Saveframe(frameName, this.category, this.tagPrefix, this.parent);

    // Copy the tags
    for (const tag of this.tags) {
      if (clearValues) {
        const newTag = newFrame.addTag(tag.name, null);
        if (newTag.schemaValues['default value'] !== '?') {
          newTag.value = newTag.schemaValues['default value'];
        }
      } else {
        newFrame.addTag(tag.name, tag.value);
      }
    }
    // Set the framecode and category regardless of clearValues argument
    newFrame.getTag('Sf_framecode').value = frameName;
    newFrame.getTag('Sf_category').value = this.category;
    // New saveframes should always require entering the label
    if (newFrame.getTag('Name')) {
      newFrame.getTag('Name').value = null;
    }

    // Copy the loops
    for (const loop of this.loops) {
      const nl = loop.duplicate(clearValues);
      newFrame.addLoop(nl);
    }

    newFrame.refresh();
    const myPosition = this.parent.saveframes.indexOf(this);
    this.parent.addSaveframe(newFrame, myPosition + 1);

    // The work is already done, as the new saveframe is inserted, but return it for reference
    return newFrame;
  }

  toJSON(): {} {
    return {category: this.category, name: this.name, tag_prefix: this.tagPrefix, tags: this.tags, loops: this.loops};
  }

  addTag(name: string, value: string): SaveframeTag {
    const newTag = new SaveframeTag(name, value, this);
    this.tags.push(newTag);
    this.tagDict[newTag.fullyQualifiedTagName] = newTag;
    return newTag;
  }

  addTags(tagList: string[][]): void {
    for (const tagPair of tagList) {
      if (tagPair[0]) {
        this.addTag(tagPair[0], tagPair[1]);
      } else {
        this.addTag(tagPair['name'], tagPair['value']);
      }
    }
  }

  addLoop(loop: Loop): void {
    this.loops.push(loop);
  }

  /*
   * Attempts to locate the tag within the saveframe. If not found, calls up
   * to the Entry to locate the first instance of it.
   * @param fqtn The fully qualified tag name.
   * @returns    The value of the queried tag, or null if not found
   */
  getTagValue(fqtn: string, fullEntry: boolean = false): string {
    if (fqtn in this.tagDict) {
      return this.tagDict[fqtn].value;
    }

    // Ask the parent entry to search the other saveframes if this is a full search
    // (The parent entry may call this method on us, in which case don't make an
    // infinite recursion)
    if (fullEntry) {
      return this.parent.getTagValue(fqtn, this);
    } else {
      return null;
    }
  }

  getTag(tagName: string): SaveframeTag {
    if (tagName in this.tagDict) {
      return this.tagDict[tagName];
    } else if ((this.tagPrefix + '.' + tagName) in this.tagDict) {
      return this.tagDict[this.tagPrefix + '.' + tagName];
    } else {
      return null;
    }
  }

  getLoopByPrefix(tagPrefix): Loop {
    for (const loop of this.loops) {
      if (loop.category === tagPrefix) {
        return loop;
      }
    }
    return null;
  }

  getID(): string {
    let entryIDTag = 'Entry_ID';
    if (this.category === 'entry_information') {
      entryIDTag = 'ID';
    }
    for (const tag of this.tags) {
      if (tag['name'] === entryIDTag) {
        return tag['value'];
      }
    }
  }

  // Sets the visibility of all tags in the saveframe
  setVisibility(rule): void {

    // Make sure this is a rule for the saveframe and not a rule for a child loop
    if (rule['Tag category'] === '*' || rule['Tag category'] === this.tagPrefix) {

      // If the rule applies to all tags in this saveframe
      if (rule['Tag'] === '*') {
        for (const tag of this.tags) {
          if (rule['Override view value'] === 'O') {
            tag.display = tag.schemaValues['User full view'];
          } else {
            tag.display = rule['Override view value'];
          }
        }
      } else {
        if (rule['Override view value'] === 'O') {
          this.tagDict[rule['Tag']].display = this.tagDict[rule['Tag']].schemaValues['User full view'];
        } else {
          if (this.tagDict[rule['Tag']] === undefined) {
            console.warn('Dictionary over-ride rule specifies non-existent tag: ' + rule['Conditional tag'], rule);
          } else {
            this.tagDict[rule['Tag']].display = rule['Override view value'];
          }
        }
      }
    }

    // Now set the visibility for the child loops
    for (const loop of this.loops) {
      if (rule['Tag category'] === '*' || rule['Tag category'] === loop.category) {
        loop.setVisibility(rule);
      }
    }
  }

  refresh(): void {

    // Determine if deleted
    this.deleted = this.getTag('_Deleted') && this.getTag('_Deleted').value === 'yes';

    // Update the tags
    for (const tag of this.tags) {
      tag.updateTagStatus();
    }
    for (const loop of this.loops) {
      loop.refresh();
    }

    // Update whether this saveframe has anything to display and is complete
    this.display = 'H';
    for (const tag of this.tags) {
      if (tag.display === 'Y') {
        this.display = 'Y';
        break;
      }
      if (this.display === 'H') {
        this.display = tag.display;
      }
    }
    for (const loop of this.loops) {
      if (loop.display === 'Y') {
        this.display = 'Y';
        break;
      }
      if (this.display === 'H') {
        this.display = loop.display;
      }
    }

    // Apply the special rules
    this.specialRules();

    // Update the validity value
    this.valid = true;
    // Deleted saveframes are always "valid"
    if (!this.deleted) {
      for (const tag of this.tags) {
        if (tag.display === 'Y' && !tag.valid) {
          this.valid = false;
          break;
        }
      }
      if (this.valid) {
        for (const loop of this.loops) {
          if (loop.display === 'Y' && !loop.valid) {
            this.valid = false;
            break;
          }
        }
      }
    }
  }

  checkEmpty() {

    // Check the tags
    for (const tag of this.tags) {
      if (!checkValueIsNull(tag.value)) {
        if (!checkTagIsRequired(tag)) {
          if (tag.display !== 'H') {
            return false;
          }
        }
      }
    }

    // Check the loops
    for (const loop of this.loops) {
      if (loop.display !== 'H' && !loop.checkEmpty()) {
        return false;
      }
    }

    return true;
  }

  print(): string {

    const mandatoryDisplay = this.category === 'entry_information' || this.category === 'deposited_data_files' ||
      this.category === 'entry_interview';

    // Skip if we have no data
    if (this.checkEmpty() && !mandatoryDisplay) {
      return '';
    }

    // Skip if we are deleted
    if (this.deleted) {
      return '';
    }

    let width = 0;

    for (const tag of this.tags) {
      if (tag.name.length > width) {
        width = tag.name.length;
      }
    }
    width += this.tagPrefix.length + 2;

    // Print the saveframe
    let returnString = sprintf('save_%s\n', this.name);
    const standardFormatString = sprintf('   %%-%ds %%s\n', width);
    const multiLineFormatString = sprintf('   %%-%ds\n;\n%%s;\n', width);

    for (const tag of this.tags) {
      // Don't show null tags
      if (checkValueIsNull(tag.value)) {
        continue;
      }

      // Don't show hidden tags, unless one of the special types
      if (!mandatoryDisplay && tag.display === 'H' && !checkTagIsRequired(tag)) {
        continue;
      }

      // Don't show "internal" tags
      if (tag.name.startsWith('_')) {
        continue;
      }

      const cleanedTag = cleanValue(tag.value);

      if (cleanedTag.indexOf('\n') === -1) {
        returnString += sprintf(standardFormatString, this.tagPrefix + '.' + tag.name, cleanedTag);
      } else {
        returnString += sprintf(multiLineFormatString, this.tagPrefix + '.' + tag.name, cleanedTag);
      }
    }

    for (const loop of this.loops) {
      returnString += loop.print();
    }

    return returnString + '\nsave_\n\n';
  }

  /* Special rules that aren't in the dictionary */
  specialRules(): void {

    // Validate some various things in the entity
    if (this.category === 'entity') {
      const polymerType = this.getTag('Polymer_type');
      const polymerCode = this.getTag('Polymer_seq_one_letter_code');
      const entityDetails = this.getTag('Details');
      const nonstandardMonomer = this.getTag('Nstd_monomer');

      // There must be an X in the sequence if non-standard monomer selected
      if (nonstandardMonomer && nonstandardMonomer.value === 'yes' && (!polymerCode.value.toUpperCase().includes('X'))) {
        polymerCode.valid = false;
        polymerCode.validationMessage = 'You specified there is a non-standard monomer, but didn\'t indicate it in the sequence' +
          ' using an \'X\'';
      }

      // There must a non-standard monomer if X in residue sequence
      if (polymerCode && polymerCode.value.toUpperCase().includes('X') && (nonstandardMonomer.value !== 'yes')) {
        nonstandardMonomer.valid = false;
        nonstandardMonomer.validationMessage = 'You specified there is a non-standard monomer with x/X in the polymer sequence, so this ' +
          'tag must be \'yes\'.';
      }

      // There must be details if there is a non-standard monomer
      if (nonstandardMonomer && nonstandardMonomer.value === 'yes' && checkValueIsNull(entityDetails.value)) {
        entityDetails.valid = false;
        entityDetails.validationMessage = 'You specified there is a non-standard monomer, but didn\'t provide any details.';
      }

      // There must be details if there is a non-standard residue code
      if (polymerCode && polymerCode.value.toUpperCase().includes('X') && checkValueIsNull(entityDetails.value)) {
        entityDetails.valid = false;
        entityDetails.validationMessage = 'You specified there is a non-standard monomer, but didn\'t provide any details.';
      }

      // If polymer type is not one of the standard three, require more details
      if (polymerType && (!checkValueIsNull(polymerType.value)) && checkValueIsNull(entityDetails.value) &&
        (!['polypeptide(L)', 'polyribonucleotide', 'polydeoxyribonucleotide'].includes(polymerType.value))) {
        entityDetails.valid = false;
        entityDetails.validationMessage = 'You specified a polymer type that requires more details.';
      }

      // If there are lower case letters, insist on non-standard tag
      if (polymerCode && isMixedCase(polymerCode.value) && nonstandardMonomer.value !== 'yes') {
        polymerCode.valid = false;
        polymerCode.validationMessage = 'Please use all upper or all lower case characters for standard residues. For non-standard ' +
          'residues, please indicate the non-standard residue using an x/X and provide details in the \'Other comments\' box.';
      }

    }

    // Check that at least one chemical shift reference is present
    if (this.category === 'chem_shift_reference') {
      let allNo = true;
      const tagsToCheck = ['_Chem_shift_reference.Proton_shifts_flag',
        '_Chem_shift_reference.Carbon_shifts_flag',
        '_Chem_shift_reference.Nitrogen_shifts_flag',
        '_Chem_shift_reference.Phosphorus_shifts_flag',
        '_Chem_shift_reference.Other_shifts_flag'
      ];
      for (const tag of tagsToCheck) {
        if (this.getTag(tag).value !== 'no') {
          allNo = false;
          break;
        }
      }
      if (allNo) {
        for (const tag of tagsToCheck) {
          this.getTag(tag).valid = false;
          this.getTag(tag).validationMessage = 'At least one chemical shift reference must be given.';
        }
      }


      // Update the chemical shift reference loop to be valid based on the chem shift reference saveframe
      const referenceLoop = this.getLoopByPrefix('_Chem_shift_ref');
      const updateTags = ['_Chem_shift_reference.Proton_shifts_flag',
        '_Chem_shift_reference.Carbon_shifts_flag',
        '_Chem_shift_reference.Nitrogen_shifts_flag',
        '_Chem_shift_reference.Phosphorus_shifts_flag'
      ];
      for (const tag of this.tags) {
        if (updateTags.indexOf(tag.fullyQualifiedTagName) >= 0) {

          // Don't apply the rules until they have either selected or unselected something
          if (tag.value === null) {
            continue;
          }

          let atomNumber = null;
          let atomName = null;
          let shiftRatio = null;
          if (tag.fullyQualifiedTagName === '_Chem_shift_reference.Proton_shifts_flag') {
            atomNumber = '1';
            atomName = 'H';
            shiftRatio = '1.000000000';
          }
          if (tag.fullyQualifiedTagName === '_Chem_shift_reference.Carbon_shifts_flag') {
            atomNumber = '13';
            atomName = 'C';
            shiftRatio = '0.251449530';
          }
          if (tag.fullyQualifiedTagName === '_Chem_shift_reference.Nitrogen_shifts_flag') {
            atomNumber = '15';
            atomName = 'N';
            shiftRatio = '0.101329118';
          }
          if (tag.fullyQualifiedTagName === '_Chem_shift_reference.Phosphorus_shifts_flag') {
            atomNumber = '31';
            atomName = 'P';
            shiftRatio = '0.404808636';
          }
          const atomNameCol = referenceLoop.tags.indexOf('Atom_type');
          const atomNumberCol = referenceLoop.tags.indexOf('Atom_isotope_number');

          const checkNullRow = (row: LoopTag[]): boolean => {
            let empty = true;
            for (const rowTag of row) {
              if (!(checkValueIsNull(rowTag.value))) {
                empty = false;
              }
            }
            return empty;
          };

          // They are adding reference data
          if (tag.value && tag.value.indexOf('yes') >= 0) {

            let dataRow = null;
            for (const row of referenceLoop.data) {
              if ((row[atomNameCol].value === atomName && row[atomNumberCol].value === atomNumber) || checkNullRow(row)) {
                dataRow = row;
              }
            }

            if (dataRow === null) {
              dataRow = referenceLoop.addRow();
            }

            dataRow[atomNameCol] = new LoopTag('Atom_type', atomName, referenceLoop);
            dataRow[atomNumberCol] = new LoopTag('Atom_isotope_number', atomNumber, referenceLoop);

            dataRow[atomNameCol].disabled = true;
            dataRow[atomNumberCol].disabled = true;

            // Add the IUPAC rules
            if (tag.value.indexOf('IUPAC') >= 0) {
              dataRow[referenceLoop.tags.indexOf('Indirect_shift_ratio')].value = shiftRatio;
              dataRow[referenceLoop.tags.indexOf('Indirect_shift_ratio')].disabled = true;
              dataRow[referenceLoop.tags.indexOf('Mol_common_name')].value = 'DSS';
              dataRow[referenceLoop.tags.indexOf('Mol_common_name')].disabled = true;
              dataRow[referenceLoop.tags.indexOf('Atom_group')].value = 'methyl protons';
              dataRow[referenceLoop.tags.indexOf('Atom_group')].disabled = true;
              dataRow[referenceLoop.tags.indexOf('Chem_shift_units')].value = 'ppm';
              dataRow[referenceLoop.tags.indexOf('Chem_shift_units')].disabled = true;
              dataRow[referenceLoop.tags.indexOf('Chem_shift_val')].value = '0.00';
              dataRow[referenceLoop.tags.indexOf('Chem_shift_val')].disabled = true;

              // C, N, and P ref_type is indirect
              if (tag.fullyQualifiedTagName === '_Chem_shift_reference.Proton_shifts_flag') {
                dataRow[referenceLoop.tags.indexOf('Ref_method')].value = 'internal';
                dataRow[referenceLoop.tags.indexOf('Ref_type')].value = 'direct';
              } else {
                dataRow[referenceLoop.tags.indexOf('Ref_method')].value = 'na';
                dataRow[referenceLoop.tags.indexOf('Ref_type')].value = 'indirect';
              }
              dataRow[referenceLoop.tags.indexOf('Ref_method')].disabled = true;
              dataRow[referenceLoop.tags.indexOf('Ref_type')].disabled = true;
            } else {
              dataRow[referenceLoop.tags.indexOf('Indirect_shift_ratio')].disabled = false;
              dataRow[referenceLoop.tags.indexOf('Mol_common_name')].disabled = false;
              dataRow[referenceLoop.tags.indexOf('Atom_group')].disabled = false;
              dataRow[referenceLoop.tags.indexOf('Chem_shift_units')].disabled = false;
              dataRow[referenceLoop.tags.indexOf('Chem_shift_val')].disabled = false;
              dataRow[referenceLoop.tags.indexOf('Ref_method')].disabled = false;
              dataRow[referenceLoop.tags.indexOf('Ref_type')].disabled = false;
            }
            // They are deleting the reference data
          } else {
            for (let loopRow = 0; loopRow < referenceLoop.data.length; loopRow++) {
              if (referenceLoop.data[loopRow][atomNameCol].value === atomName &&
                referenceLoop.data[loopRow][atomNumberCol].value === atomNumber) {
                referenceLoop.deleteRow(loopRow);
                if (referenceLoop.data.length === 0) {
                  referenceLoop.addRow();
                }
              }
            }
          }
        }
      }
      referenceLoop.refresh(false);
    }
  }
}
