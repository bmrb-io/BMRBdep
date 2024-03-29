import {Saveframe} from './saveframe';
import {Loop} from './loop';
import {Schema} from './schema';
import {Entry} from './entry';
import {checkValueIsNull} from './nmrstar';

export class Tag {
  name: string;
  value: string;

  valid: boolean;
  disabled: boolean;
  validationMessage: string;
  dataType: string;
  interfaceType: string;
  schemaValues: {};
  display: string;
  fullyQualifiedTagName: string;
  enums: Set<[string, string]>;
  frameLink: Array<[string, string]>;
  parent: Object;


  constructor(name: string, value: string, tagPrefix: string, schema: Schema) {
    this.name = name;
    if (checkValueIsNull(value)) {
      this.value = '';
    } else {
      this.value = value;
    }

    this.fullyQualifiedTagName = tagPrefix + '.' + this.name;
    this.schemaValues = schema.getTag(this.fullyQualifiedTagName);
    if (this.schemaValues) {
      this.enums = this.schemaValues['enumerations'] ? new Set(this.schemaValues['enumerations']) : new Set();
      this.display = this.schemaValues['User full view'];
    } else {
      if (this.name !== '_Deleted') {
        console.warn('Tag exists in entry but not in schema!', this.fullyQualifiedTagName);
      }
      this.schemaValues = {
        'Regex': new RegExp('^' + schema.dataTypes['any'] + '$'),
        'Tag': name + '.' + value, 'SFCategory': '?',
        'BMRB data type': 'any', 'Nullable': true,
        'Prompt': 'Tag not in dictionary', 'Interface': 'Tag not in dictionary',
        'default value': '?', 'Example': '?', 'ADIT category view name': 'Missing',
        'User full view': 'H', 'Foreign Table': null, 'Sf pointer': 'N'
      };
      // Don't show internal tags
      if (this.name.startsWith('_')) {
        this.schemaValues['User full view'] = 'H';
      }
      this.enums = null;
      this.display = 'H';
    }

    this.disabled = false;

    /* Will be updated with updateTagStatus */
    this.valid = true;
    this.validationMessage = null;

    // Determine the interface type and data type
    const dt = this.schemaValues['BMRB data type'];

    if (this.fullyQualifiedTagName === '_Contact_person.Country') {
      this.interfaceType = 'country';
    } else if (this.fullyQualifiedTagName === '_Contact_person.State_province') {
      this.interfaceType = 'state';
    } else if (this.name === 'Experiment_ID') {
      this.interfaceType = 'experiment_pointer';
    } else if (this.schemaValues['Sf pointer'] === 'Y') {
      // Show this tag as a closed enum
      this.interfaceType = 'sf_pointer';
    } else if (this.schemaValues['Enumeration ties']) {
      // 19 is the enumeration tie value of the files
      if (this.schemaValues['Enumeration ties'] === '19') {
        this.interfaceType = 'closed_enum';
      } else {
        if (this.schemaValues['Item enumeration closed'] === 'Y') {
          this.interfaceType = 'closed_enum';
        } else {
          this.interfaceType = 'open_enum';
        }
      }
    } else if (dt === 'yes_no') {
      this.interfaceType = 'yes_no';
    } else if (dt === 'text') {
      this.interfaceType = 'text';
    } else {
      if (this.schemaValues['enumerations']) {
        // There are enums, determine which type
        if (this.schemaValues['Item enumerated'] === 'Y') {
          if (this.schemaValues['Item enumeration closed'] === 'Y') {
            this.interfaceType = 'closed_enum';
          } else if (this.schemaValues['Item enumeration closed'] === 'N') {
            this.interfaceType = 'open_enum';
          } else {
            console.warn('Enum list and "Item enumerated"="Y" but no "Item enumeration closed" value: ' + this.fullyQualifiedTagName);
            this.interfaceType = 'open_enum';
          }
          // Enum list exists but not open or closed!?
        } else {
          console.warn('Enum list but no "Item enumerated" value: ' + this.fullyQualifiedTagName);
          this.interfaceType = 'open_enum';
        }
      } else {
        this.interfaceType = 'standard';
      }
    }

    // If this is a standard 'input' element, determine the data type
    const dataTypeMap = {
      'int': 'number', 'float': 'number', 'yyyy-mm-dd': 'date',
      'yyyy-mm-dd:hh:mm': 'datetime-local',
      'email': 'email', 'fax': 'tel', 'phone': 'tel'
    };
    this.dataType = dataTypeMap[dt];
    if (this.dataType === undefined) {
      this.dataType = 'string';
    }
  }

  log(): void {
    console.log(this);
  }

  toJSON(): {} {
    // Clone object to prevent accidentally performing modification on the original object

    if (!checkValueIsNull(this.value)) {
      return [this.name, this.value];
    } else {
      return [this.name, '.'];
    }

  }

  updateTagStatus(setDisabled = true): void {

    /* Check that the tag is valid
    * 1) Matches the data type regex
    * 2) Is not null unless null is allowed
    * 3) Is from the enum list if it a mandatory enum
    */

    /* Remove unicode
    if (!checkValueIsNull(this.value)) {
      this.value = this.value.replace(/[^\x00-\x7F]/g, '?');
    } */

    // Set tag enabled/disabled status based on the status of the entry
    if (setDisabled) {
      this.disabled = this.getEntry().deposited;
    }
    if (this.name === 'ID') {
      this.disabled = true;
    }

    let matchedPointer = false;

    if (this.name === 'Experiment_ID') {
      const experimentLoop: Loop = this.getEntry().getLoopsByCategory('_Experiment')[0];
      this.valid = false;

      this.frameLink = [];
      const IDIndex = experimentLoop.getTagIndex('ID');
      const nameTagIndex = experimentLoop.getTagIndex('Name');
      const sampleLabelIndex = experimentLoop.getTagIndex('Sample_label');
      const sampleConditionListIndex = experimentLoop.getTagIndex('Sample_condition_list_label');
      const spectrometerIndex = experimentLoop.getTagIndex('NMR_spectrometer_label');

      for (const row of experimentLoop.data) {
        const sampleFrame = this.getEntry().getSaveframeByName(row[sampleLabelIndex].value.slice(1));
        let sampleName: string;
        if (!sampleFrame) {
          sampleName = 'No sample selected';
        } else {
          sampleName = sampleFrame.tagDict['_Sample.Name'].value;
          if (checkValueIsNull(sampleName)) {
            sampleName = sampleFrame.getTag('Sf_framecode').value + +' (Unnamed)';
          }
        }

        const sampleConditionsFrame: Saveframe = this.getEntry().getSaveframeByName(row[sampleConditionListIndex].value.slice(1));
        let sampleConditionsName: string;
        if (!sampleConditionsFrame) {
          sampleConditionsName = 'No sample conditions selected';
        } else {
          if (sampleConditionsFrame.category !== 'sample_conditions') {
            throw new Error('There is an invalid pointer in your entry, pointing to a saveframe of type sample when it should point' +
              ' to a saveframe of type sample_conditions.');
          }
          sampleConditionsName = sampleConditionsFrame.tagDict['_Sample_condition_list.Name'].value;
          if (checkValueIsNull(sampleConditionsName)) {
            sampleConditionsName = sampleConditionsFrame.getTag('Sf_framecode').value + ' (Unnamed)';
          }
        }

        const spectrometerSaveframe: Saveframe = this.getEntry().getSaveframeByName(row[spectrometerIndex].value.slice(1));
        let spectrometerName: string;
        if (!spectrometerSaveframe) {
          spectrometerName = 'No spectrometer selected';
        } else {
          spectrometerName = spectrometerSaveframe.tagDict['_NMR_spectrometer.Name'].value;
          if (checkValueIsNull(spectrometerName)) {
            spectrometerName = spectrometerSaveframe.getTag('Sf_framecode').value + ' (Unnamed)';
          }
        }

        this.frameLink.push([row[IDIndex].value, row[nameTagIndex].value + ' - ' + sampleName + ' - ' + sampleConditionsName +
        ' - ' + spectrometerName]);

        // Check the validity of this tag in the process
        if (row[IDIndex].value === this.value) {
          matchedPointer = true;
        }
      }

      if (checkValueIsNull(this.value)) {
        // If null, the deselect needs to match our actual value
        this.frameLink.push([this.value, '']);
      } else if (this.display === 'N') {
        this.frameLink.push(['', 'Deselect option']);
      }

    } else if (this.schemaValues['Sf pointer'] === 'N') {
      if (this.schemaValues['Enumeration ties']) {
        // 19 is the special case that means the enumeration tie is for a file
        if (this.schemaValues['Enumeration ties'] === '19') {
          this.enums = this.getEntry().dataStore.getDataFileNamesByCategory(this.getParentSaveframe().category);
          // Add a "deselect" option for non-mandatory tags
          if (this.display !== 'Y') {
            this.enums.add(['', '']);
          }
        } else {
          const parentEntry: Entry = this.getEntry();
          let enumerationSet = parentEntry.enumerationTies[this.schemaValues['Enumeration ties']];
          if (!enumerationSet) {
            enumerationSet = new Set();
            parentEntry.enumerationTies[this.schemaValues['Enumeration ties']] = enumerationSet;
          }
          // Only add our value to the enumeration set if we have a value
          if (!checkValueIsNull(this.value)) {
            enumerationSet.add(this.value);
          }

          const temp = this.schemaValues['enumerations'] ? this.schemaValues['enumerations'] : [];
          this.enums = new Set();
          enumerationSet.forEach(item => this.enums.add([item, item]));
          temp.forEach(item => this.enums.add(item));
        }
      }

      // Add in the native enumerations
      if (this.schemaValues['enumerations']) {
        for (const enumeration of this.schemaValues['enumerations']) {
          this.enums.add(enumeration);
        }
      }

      // Correct capitalization on typed enumerations
      if (this.enums && this.value) {
        const lowerCaseValue = this.value.toLowerCase();
        for (const singleEnum of Array.from(this.enums)) {
          if (singleEnum[0].toLowerCase() === lowerCaseValue) {
            this.value = singleEnum[0];
          }
        }
      }

    } else if (this.schemaValues['Sf pointer'] === 'Y') {
      // Show this tag as a closed enum
      const parentEntry = this.getEntry();
      const framesOfCategory: Saveframe[] = parentEntry.getSaveframesByPrefix('_' + this.schemaValues['Foreign Table']);

      /* Special rules that aren't in the dictionary
      * This ensures that the assembly allows selecting a chem_comp. */
      if (this.fullyQualifiedTagName === '_Entity_assembly.Entity_label') {
        // Check that the chem comp isn't deleted
        const chemComps = parentEntry.getSaveframesByPrefix('_Chem_comp');
        for (const chemComp of chemComps) {
          if (!chemComp.deleted) {
            framesOfCategory.push(chemComp);
          }
        }
      }

      this.frameLink = [];
      for (const sf of framesOfCategory) {
        if (sf.deleted) {
          continue;
        }
        const nameTag = sf.tagDict[sf.tagPrefix + '.Name'];
        let displayName = null;
        if (nameTag) {
          displayName = nameTag.value;
        }
        if (checkValueIsNull(displayName)) {
          displayName = sf.name + ' (Unnamed)';
        }

        this.frameLink.push(['$' + sf.name, displayName]);
        if ('$' + sf.name === this.value) {
          matchedPointer = true;
        }
      }

      // Always add a "deselect" option
      if (checkValueIsNull(this.value)) {
        // If null, the deselect needs to match our actual value
        this.frameLink.push([this.value, '']);
        // If non-mandatory, just use empty string
      } else if (this.display === 'N') {
        this.frameLink.push(['', 'Deselect option']);
      }

      if (!matchedPointer && !checkValueIsNull(this.value)) {
        // Add an option for a value that became invalid
        this.frameLink.push([this.value, 'Invalid value selected: ' + this.value]);
      }
    }

    this.valid = true;
    this.validationMessage = '';

    // If null, make sure that null is allowed - no need to check regex.
    if (checkValueIsNull(this.value)) {
      if (this.display === 'Y') {
        this.valid = false;
        this.validationMessage = 'Tag must have a value.';
      }
      // Check enums are matched
    } else if (this.interfaceType === 'closed_enum') {
      if (this.enums.size === 0) {
        this.valid = false;
        this.validationMessage = 'There are currently no valid values for this tag.';
      } else {
        let found = false;
        this.enums.forEach(item => {
          if (item[0] === this.value) {
            found = true;
          }
        });
        if (!found) {
          this.valid = false;
          this.validationMessage = 'Value does not match one of the allowed options.';
        }
      }
    } else if (this.interfaceType === 'sf_pointer' || this.interfaceType === 'experiment_pointer') {
      // We have a value that doesn't exist...
      if (!matchedPointer) {
        // A non-null invalid value exists
        if (!checkValueIsNull(this.value)) {
          this.validationMessage = 'Invalid selected value. Have you deleted the data it referenced?';
          this.valid = false;
        }
      }
      // Check data type
    } else if (!this.schemaValues['Regex'].test(this.value)) {
      if (this.fullyQualifiedTagName !== '_Contact_person.State_province' && this.fullyQualifiedTagName !== '_Contact_person.Country') {
        this.valid = false;
        this.validationMessage = 'Value does not match specified data type.';
      }
    }
  }

  getEntry(): Entry {
    return null;
  }

  getParentSaveframe(): Saveframe {
    return null;
  }
}

export class SaveframeTag extends Tag {
  parent: Saveframe;

  constructor(name: string, value: string, parent: Saveframe) {
    super(name, value, parent.tagPrefix, parent.parent.schema);
    this.parent = parent;
  }

  getEntry(): Entry {
    return this.parent.parent;
  }

  getParentSaveframe(): Saveframe {
    return this.parent;
  }

}

export class LoopTag extends Tag {
  parent: Loop;

  constructor(name: string, value: string, parent: Loop) {
    super(name, value, parent.category, parent.parent.parent.schema);
    this.parent = parent;
  }

  getEntry(): Entry {
    return this.parent.parent.parent;
  }

  getParentSaveframe(): Saveframe {
    return this.parent.parent;
  }

}


/* Special rules that aren't in the dictionary */

