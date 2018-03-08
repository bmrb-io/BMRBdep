import { Saveframe } from './saveframe';
import { Loop } from './loop';
import { Schema } from './schema';

export class Tag {
  name: string;
  value: string;

  valid: boolean;
  validation_message: string;
  data_type: string;
  interface_type: string;
  schema_values: {};
  overrides: string[][];
  display: string;
  fqtn: string;
  enums: string[];
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
    this.schema_values['Regex'] = new RegExp(schema.data_types[this.schema_values['BMRB data type']]);
    this.enums = schema.enumerations[this.fqtn];
    this.overrides = schema.override_dict[this.fqtn];
    this.display = this.schema_values['User full view'];

    /* Will be updated with updateTagStatus */
    this.valid = true;
    this.validation_message = null;
    this.data_type = '';
    this.interface_type = '';
    this.updateTagStatus();
  }

  log() {
    console.log(this);
  }

  toJSON(key) {
    // Clone object to prevent accidentally performing modification on the original object
    const cloneObj = { ...this as Tag };

    delete cloneObj.valid;
    delete cloneObj.schema_values;
    delete cloneObj.overrides;
    delete cloneObj.fqtn;
    delete cloneObj.enums;
    delete cloneObj.parent;
    delete cloneObj.interface_type;
    delete cloneObj.data_type;
    delete cloneObj.validation_message;
    delete cloneObj.display;

    return cloneObj;
  }

  updateTagStatus() {
    const dt = this.schema_values['BMRB data type'];

    if (dt === 'yes_no') {
      this.interface_type = 'yes_no';
    } else if (dt === 'text') {
      this.interface_type = 'text';
    } else {
      if (this.enums) {
        // There are enums, determine which type
        if (this.enums[1] === 'Y') {
          if (this.enums[0] === 'Y') {
            this.interface_type = 'closed_enum';
          } else if (this.enums[0] === 'N') {
            this.interface_type = 'open_enum';
          } else {
            console.log('No enum spec for tag: ' + this.fqtn);
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
    const dtmap = {'int': 'number', 'float': 'number', 'yyyy-mm-dd': 'date',
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

    this.valid = true;
    // If null, make sure that null is allowed - no need to check regex.
    if (!this.value) {
      if (!this.schema_values['Nullable']) {
        this.valid = false;
        this.validation_message = 'Tag must have a value.';
      }
    // Check data type
    } else if (!this.schema_values['Regex'].test(this.value)) {
      this.valid = false;
      this.validation_message = 'Tag does not match specified data type.';
    // Check enums are matched
    } else if (this.interface_type === 'closed_enum') {
        if (this.enums[2].indexOf(this.value) < 0) {
          this.valid = false;
          this.validation_message = 'Tag does not match one of the allowed options.';
      }
    }
  }

  updateCascade() {
    return null;
  }
}

export class SaveframeTag extends Tag {
  parent: Saveframe;

  constructor(name: string, value: string, parent: Saveframe) {
     super(name, value, parent.tag_prefix, parent.parent.schema);
     this.parent = parent;
  }

  updateTagStatus() {
    // First do the standard updates
    super.updateTagStatus();

    // Just return if we have no parent
    if (!this.parent) { return; }

    // Determine if this tag is being displayed
    this.display = this.schema_values['User full view'];
    if (!this.overrides) { return; }

    // Check the overrides
    for (const or of this.overrides) {
      const ct_val = this.parent.getTagValue(or[0], true);

      // For * just check if there is *a* value TODO: category based - check if existence of loop/sf
      if (or[2] === '*') {
        if (ct_val !== null) {
          this.display = or[1];
        }
      } else {
        // Check the regex
        if (new RegExp('^' + or[2] + '$').test(ct_val)) {
          this.display = or[1];
          // console.log('Set tag ' + this.fqtn + ' to ' + or[1] + ' because ' +
          //               or[0] + ' has value ' + or[2] + ' - it has value ' + ct_val);
        }
      }
    }
  }

  updateCascade() {
    this.parent.parent.refresh();
  }
}

export class LoopTag extends Tag {
  parent: Loop;
  constructor(name: string, value: string, parent: Loop) {
     super(name, value, parent.category, parent.parent.parent.schema);
     this.parent = parent;
  }

  updateTagStatus() {
    super.updateTagStatus();

    if (!this.parent) { return; }
    // Determine if this tag is being displayed
    this.display = this.schema_values['User full view'];
    const or = this.overrides;
    if (or) {
      
    }
  }

  updateCascade() {
    this.parent.parent.parent.refresh();
  }
}

