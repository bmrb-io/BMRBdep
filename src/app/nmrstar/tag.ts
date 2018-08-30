import {Saveframe} from './saveframe';
import {Loop} from './loop';
import {Schema} from './schema';
import {Entry} from './entry';

export class Tag {
  name: string;
  value: string;

  valid: boolean;
  validation_message: string;
  data_type: string;
  interface_type: string;
  schema_values: {};
  display: string;
  fqtn: string;
  enums: Set<string>;
  parent?: Object;

  constructor(name: string, value: string, tag_prefix: string, schema: Schema) {
    this.name = name;
    if (['.', '?', '', null].indexOf(value) >= 0) {
      this.value = null;
    } else {
      this.value = value;
    }

    this.fqtn = tag_prefix + '.' + this.name;
    this.schema_values = schema.getTag(this.fqtn);
    if (this.schema_values) {
      this.enums = this.schema_values['enumerations'] ? new Set(this.schema_values['enumerations']) : new Set();
      this.display = this.schema_values['User full view'];
    } else {
      this.schema_values = {'Regex': new RegExp('^' + schema.data_types['any'] + '$'),
                            'Tag': name + '.' + value, 'SFCategory': '?',
                            'BMRB data type': 'any', 'Nullable': true,
                            'Prompt': 'Tag not in dictionary', 'Interface': 'Tag not in dictionary',
                            'default value': '?', 'Example': '?', 'ADIT category view name': 'Missing',
                            'User full view': 'Y', 'Foreign Table': null, 'Sf pointer': null};
      this.enums = null;
      this.display = 'H';
    }

    /* Will be updated with updateTagStatus */
    this.valid = true;
    this.validation_message = null;

    // Determine the interface type and data type
    const dt = this.schema_values['BMRB data type'];

    if ((this.schema_values['Enumeration ties']) && (this.schema_values['Sf pointer'] !== 'Y')) {
      // 19 is the enumeration tie value of the files
      if (this.schema_values['Enumeration ties'] === '19') {
        this.interface_type = 'closed_enum';
      } else {
        this.interface_type = 'open_enum';
      }
    } else if (dt === 'yes_no') {
      this.interface_type = 'yes_no';
    } else if (dt === 'text') {
      this.interface_type = 'text';
    } else {
      if (this.schema_values['enumerations']) {
        // There are enums, determine which type
        if (this.schema_values['Item enumerated'] === 'Y') {
          if (this.schema_values['Item enumeration closed'] === 'Y') {
            this.interface_type = 'closed_enum';
          } else if (this.schema_values['Item enumeration closed'] === 'N') {
            this.interface_type = 'open_enum';
          } else {
            console.log('Enum list and "Item enumerated"="Y" but no "Item enumeration closed" value: ' + this.fqtn);
            this.interface_type = 'open_enum';
          }
          // Enum list exists but not open or closed!?
        } else {
          console.log('Enum list but no "Item enumerated" value: ' + this.fqtn);
          this.interface_type = 'open_enum';
        }
      } else {
        this.interface_type = 'standard';
      }
    }

    // If this is a standard 'input' element, determine the data type
    const data_type_map = {'int': 'number', 'float': 'number', 'yyyy-mm-dd': 'date',
      'yyyy-mm-dd:hh:mm': 'datetime-local',
      'email': 'email', 'fax': 'tel', 'phone': 'tel'};
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

    if ((this.schema_values['Enumeration ties']) && (this.schema_values['Sf pointer'] !== 'Y')) {
      // 19 is the special case that means the enumeration tie is for a file
      if (this.schema_values['Enumeration ties'] === '19') {
        this.enums = this.getEntry().dataStore.getDataFileNamesByCategory(this.getParentSaveframe().category);
      } else {
        const parentEntry: Entry = this.getEntry();
        let enumerationSet = parentEntry.enumeration_ties[this.schema_values['Enumeration ties']];
        if (!enumerationSet) {
          enumerationSet = new Set();
          parentEntry.enumeration_ties[this.schema_values['Enumeration ties']] = enumerationSet;
        }
        // Only add our value to the enumeration set if we have a value
        if (this.value) {
          enumerationSet.add(this.value);
        }
        this.enums = enumerationSet;
      }
    }

    this.valid = true;
    this.validation_message = '';

    // If null, make sure that null is allowed - no need to check regex.
    if (!this.value) {
      // TODO: This only works after updateVisibity() is called on this tag. Should be fixed after rewrite of conditional visiblity code
      // but may require some addition refactoring
      if (this.display === 'Y') {
        this.valid = false;
        this.validation_message = 'Tag must have a value.';
      }
    // Check data type
    } else if (!this.schema_values['Regex'].test(this.value)) {
      this.valid = false;
      this.validation_message = 'Tag does not match specified data type.';
    // Check enums are matched
    } else if (this.interface_type === 'closed_enum') {
        if (!this.enums.has(this.value)) {
          this.valid = false;
          this.validation_message = 'Tag does not match one of the allowed options.';
        }
    }

    // Just return if we have no parent - prior to asking the parent for tags
    if (!this.parent) { return; }

    // Check if we are a pointer, if so, enumerate the saveframes to point to
    if (this.schema_values['Sf pointer'] === 'Y') {
      // Show this tag as a closed enum
      this.interface_type = 'closed_enum';
      const frames_of_category: Saveframe[] = this.getEntry().getSaveframesByPrefix('_' + this.schema_values['Foreign Table']);
      if (frames_of_category.length > 0) {
        this.enums = new Set();
        for (const sf of frames_of_category) {
          this.enums.add('$' + sf.name);
        }
      } else {
        console.log('Sf pointer set to \'Y\' but no tags!', this);
        this.enums = new Set(['No saveframes of category ' + this.schema_values['Foreign Table'] +
                                     ' found in entry. Please create at least one.']);
        this.valid = false;
      }
      if (!this.enums.has(this.value)) {
        this.valid = false;
        this.validation_message = 'Tag must have a value.';
        this.value = null;
      }
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
     super(name, value, parent.tag_prefix, parent.parent.schema);
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

