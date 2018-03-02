import { Saveframe } from './saveframe';
import { Loop } from './loop';
import { Schema } from './schema';

class Tag {
  name: string;
  value: string;

  valid: boolean;
  data_type: string;
  interface_type: string;
  schema_values: {};
  fqtn: string;
  enums: string[];
  schema: Schema;
  parent?: Object;

  constructor(name: string, value: string) {
    this.name = name;
    if (['.', '?', '', null].indexOf(value) >= 0) {
      this.value = null;
    } else {
      this.value = value;
    }

    /* Will be updated with updateTagStatus */
    this.valid = true;
    this.schema_values = {};
    this.fqtn = '';
    this.enums = [];
    this.data_type = '';
  }

  toJSON(key) {
    // Clone object to prevent accidentally performing modification on the original object
    const cloneObj = { ...this as Tag };

    delete cloneObj.valid;
    delete cloneObj.schema_values;
    delete cloneObj.fqtn;
    delete cloneObj.enums;
    delete cloneObj.parent;
    delete cloneObj.interface_type;
    delete cloneObj.data_type;
    delete cloneObj.schema;

    return cloneObj;
  }

  updateTagStatus(tag_prefix) {
    this.fqtn = tag_prefix + '.' + this.name;
    this.schema_values = this.schema.getTag(this.fqtn);
    this.enums = this.schema.enumerations[this.fqtn];

    const dt = this.schema_values['BMRB data type'];

    if (dt === 'yes_no') {
      this.interface_type = 'yes_no';
    } else {
      if (this.enums) {
        // There are enums, determine which type
        if (this.enums[1] === 'Y') {
          if (this.enums[0] === 'Y') {
            this.interface_type = 'closed_enum';
          } else if (this.enums[0] === 'N') {
            this.interface_type = 'open_enum';
          }
        // Enum list exists but not open or closed!?
        } else {
          console.log('enum list but no ' + this.enums, this);
        }
      } else {
        this.interface_type = 'standard';
      }
    }

    // If this is a standard 'input' element, determine the data type
    const dtmap = {'int': 'number', 'yyyy-mm-dd': 'date',
                   'yyyy-mm-dd:hh:mm': 'datetime-local',
                   'email': 'email', 'fax': 'tel', 'phone': 'tel'};
    this.data_type = dtmap[dt];
    if (this.data_type === undefined) {
      this.data_type = 'string';
    }
    
     /* Check that the tag is valid
     * 1) Matches the data type regex
     * 2) Is not null unless null is allowed
     * 3) Is from the enum list if it a mandatory enum
     */
    this.valid = this.schema.checkDatatype(this.fqtn, this.value);
    if ((!this.schema_values['Nullable']) && (!this.value)) {
      this.valid = false;
    }
    if (this.interface_type === 'closed_enum') {
      if (this.enums[2].indexOf(this.value) < 0) {
        this.valid = false;
      }
    }
  }
}

export class SaveframeTag extends Tag {
  parent: Saveframe;

  constructor(name: string, value: string, parent: Saveframe) {
     super(name, value);
     this.parent = parent;
     this.schema = this.parent.parent.schema;
  }
}

export class LoopTag extends Tag {
  parent: Loop;
  constructor(name: string, value: string, parent: Loop) {
     super(name, value);
     this.parent = parent;
     this.schema = this.parent.parent.parent.schema;
  }
}

