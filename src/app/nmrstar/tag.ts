import {Saveframe} from './saveframe';
import {Loop} from './loop';
import {Schema} from './schema';
import {Entry} from './entry';
import {environment} from '../../environments/environment';

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
  enums: Set<string>;
  parent?: Object;

  constructor(name: string, value: string, tagPrefix: string, schema: Schema) {
    this.name = name;
    if (['.', '?', '', null].indexOf(value) >= 0) {
      this.value = null;
    } else {
      this.value = value;
    }

    this.fullyQualifiedTagName = tagPrefix + '.' + this.name;
    this.schemaValues = schema.getTag(this.fullyQualifiedTagName);
    if (this.schemaValues) {
      this.enums = this.schemaValues['enumerations'] ? new Set(this.schemaValues['enumerations']) : new Set();
      this.display = this.schemaValues['User full view'];
    } else {
      this.schemaValues = {
        'Regex': new RegExp('^' + schema.dataTypes['any'] + '$'),
        'Tag': name + '.' + value, 'SFCategory': '?',
        'BMRB data type': 'any', 'Nullable': true,
        'Prompt': 'Tag not in dictionary', 'Interface': 'Tag not in dictionary',
        'default value': '?', 'Example': '?', 'ADIT category view name': 'Missing',
        'User full view': 'Y', 'Foreign Table': null, 'Sf pointer': 'N'
      };
      this.enums = null;
      this.display = 'H';
    }

    this.disabled = false;

    /* Will be updated with updateTagStatus */
    this.valid = true;
    this.validationMessage = null;

    // Determine the interface type and data type
    const dt = this.schemaValues['BMRB data type'];

    if ((this.schemaValues['Enumeration ties']) && (this.schemaValues['Sf pointer'] !== 'Y')) {
      // 19 is the enumeration tie value of the files
      if (this.schemaValues['Enumeration ties'] === '19') {
        this.interfaceType = 'closed_enum';
      } else {
        this.interfaceType = 'open_enum';
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
            console.log('Enum list and "Item enumerated"="Y" but no "Item enumeration closed" value: ' + this.fullyQualifiedTagName);
            this.interfaceType = 'open_enum';
          }
          // Enum list exists but not open or closed!?
        } else {
          console.log('Enum list but no "Item enumerated" value: ' + this.fullyQualifiedTagName);
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

    if (this.value !== null && this.value !== '') {
      return [this.name, this.value];
    } else {
      return [this.name, '.'];
    }

  }

  updateTagStatus(): void {

    /* Check that the tag is valid
    * 1) Matches the data type regex
    * 2) Is not null unless null is allowed
    * 3) Is from the enum list if it a mandatory enum
    */

    // Remove unicode
    if (this.value) {
      this.value = this.value.replace(/[^\x00-\x7F]/g, '?');
    }

    if (this.schemaValues['Sf pointer'] === 'N') {
      if (this.schemaValues['Enumeration ties']) {
        // 19 is the special case that means the enumeration tie is for a file
        if (this.schemaValues['Enumeration ties'] === '19') {
          this.enums = this.getEntry().dataStore.getDataFileNamesByCategory(this.getParentSaveframe().category);
        } else {
          const parentEntry: Entry = this.getEntry();
          let enumerationSet = parentEntry.enumerationTies[this.schemaValues['Enumeration ties']];
          if (!enumerationSet) {
            enumerationSet = new Set();
            parentEntry.enumerationTies[this.schemaValues['Enumeration ties']] = enumerationSet;
          }
          // Only add our value to the enumeration set if we have a value
          if (this.value) {
            enumerationSet.add(this.value);
          }

          const temp = this.schemaValues['enumerations'] ? this.schemaValues['enumerations'] : [];
          this.enums = new Set(function*() { yield* enumerationSet; yield* temp; }());
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
          if (singleEnum.toLowerCase() === lowerCaseValue) {
            this.value = singleEnum;
          }
        }
      }

    } else if (this.schemaValues['Sf pointer'] === 'Y') {
        // Check if we are a pointer, if so, enumerate the saveframes to point to
        if (this.schemaValues['Sf pointer'] === 'Y') {
          // Show this tag as a closed enum
          this.interfaceType = 'closed_enum';
          const framesOfCategory: Saveframe[] = this.getEntry().getSaveframesByPrefix('_' + this.schemaValues['Foreign Table']);
          if (framesOfCategory.length > 0) {
            this.enums = new Set();
            for (const sf of framesOfCategory) {
              this.enums.add('$' + sf.name);
            }
          } else {
            if (environment.debug) {
              console.warn('Sf pointer set to \'Y\' but no tags!', this);
            }
            this.enums = new Set(['No saveframes of category ' + this.schemaValues['Foreign Table'] +
            ' found in entry. Please create at least one.']);
            this.valid = false;
          }
          if (!this.enums.has(this.value)) {
            this.valid = false;
            this.validationMessage = 'Tag must have a value.';
            this.value = null;
          }
        }
    } else {
        console.error('What is this "sf pointer" value?', this.schemaValues['Sf pointer'], this);
    }


    this.valid = true;
    this.validationMessage = '';

    // If null, make sure that null is allowed - no need to check regex.
    if (!this.value) {
      if (this.display === 'Y') {
        this.valid = false;
        this.validationMessage = 'Tag must have a value.';
      }
      // Check data type
    } else if (!this.schemaValues['Regex'].test(this.value)) {
      this.valid = false;
      this.validationMessage = 'Tag does not match specified data type.';
      // Check enums are matched
    } else if (this.interfaceType === 'closed_enum') {
      if (!this.enums.has(this.value)) {
        if (this.enums.size === 0 && this.fullyQualifiedTagName !== '_Upload_data.Data_file_name') {
          this.value = null;
        } else {
          this.valid = false;
          this.validationMessage = 'Tag does not match one of the allowed options.';
        }
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

  updateTagStatus(): void {
    super.updateTagStatus();

    // Copy the value of Name to Sf_framecode if such a tag exists
    if (this.name === 'Name' && this.value) {
      const parentSaveframe = this.getParentSaveframe();
      if (parentSaveframe.tagDict[parentSaveframe.tagPrefix + '.Sf_framecode']) {
        parentSaveframe.tagDict[parentSaveframe.tagPrefix + '.Sf_framecode'].value = this.value;
      }
    }
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

  updateTagStatus(): void {
    super.updateTagStatus();
  }

}


/* Special rules that aren't in the dictionary */

