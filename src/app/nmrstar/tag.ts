import {Saveframe} from './saveframe';
import {Loop} from './loop';
import {Schema} from './schema';
import {Entry} from './entry';

export class Tag {
  name: string;
  value: string;

  valid: boolean;
  validationMessage: string;
  data_type: string;
  interfaceType: string;
  schemaValues: {};
  display: string;
  fullyQualifiedTagName: string;
  enums: Set<string>;
  parent?: Object;

  constructor(name: string, value: string, tag_prefix: string, schema: Schema) {
    this.name = name;
    if (['.', '?', '', null].indexOf(value) >= 0) {
      this.value = null;
    } else {
      this.value = value;
    }

    this.fullyQualifiedTagName = tag_prefix + '.' + this.name;
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
        'User full view': 'Y', 'Foreign Table': null, 'Sf pointer': null
      };
      this.enums = null;
      this.display = 'H';
    }

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
    const data_type_map = {
      'int': 'number', 'float': 'number', 'yyyy-mm-dd': 'date',
      'yyyy-mm-dd:hh:mm': 'datetime-local',
      'email': 'email', 'fax': 'tel', 'phone': 'tel'
    };
    this.data_type = data_type_map[dt];
    if (this.data_type === undefined) {
      this.data_type = 'string';
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

  updateTagStatus() {

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

    } else if (this.schemaValues['Sf pointer'] === 'Y') {
        // Check if we are a pointer, if so, enumerate the saveframes to point to
        if (this.schemaValues['Sf pointer'] === 'Y') {
          // Show this tag as a closed enum
          this.interfaceType = 'closed_enum';
          const frames_of_category: Saveframe[] = this.getEntry().getSaveframesByPrefix('_' + this.schemaValues['Foreign Table']);
          if (frames_of_category.length > 0) {
            this.enums = new Set();
            for (const sf of frames_of_category) {
              this.enums.add('$' + sf.name);
            }
          } else {
            console.log('Sf pointer set sto \'Y\' but no tags!', this);
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
      // TODO: This only works after updateVisibity() is called on this tag. Should be fixed after rewrite of conditional visiblity code
      // but may require some addition refactoring
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
        this.valid = false;
        this.validationMessage = 'Tag does not match one of the allowed options.';
      }
    }

    // Just return if we have no parent - prior to asking the parent for tags
    if (!this.parent) {
      return;
    }
  }

  updateCascade(): void {
    this.getEntry().refresh();
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

