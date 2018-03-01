import { Saveframe } from './saveframe';
import { Loop } from './loop';

class Tag {
  name: string;
  value: string;

  valid: boolean;
  data_type: string;
  schema_values: {};
  fqtn: string;
  enums: string[];
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

    return cloneObj;
  }
}

export class SaveframeTag extends Tag {
  parent: Saveframe;
  constructor(name: string, value: string, parent: Saveframe) {
     super(name, value);
     this.parent = parent;
  }

  updateTagStatus(tag_prefix) {
    this.fqtn = tag_prefix + '.' + this.name;
    this.valid = this.parent.parent.schema.checkDatatype(this.fqtn, this.value);
    this.schema_values = this.parent.parent.schema.getTag(this.fqtn);
    this.enums = this.parent.parent.schema.enumerations[this.fqtn];
    
    const dt = this.schema_values['BMRB data type'];
    console.log('Testing type for tag ' + this.fqtn + ' '+ dt);
    this.data_type = 'string';
    if (dt === 'int') {
      this.data_type = 'number';
    } else if (dt === 'yyyy-mm-dd') {
      this.data_type = 'date';
    } else if (dt === 'yyyy-mm-dd:hh:mm') {
      this.data_type = 'datetime-local';
    } else if (dt === 'email') {
      this.data_type = 'email';
    } else if ((dt === 'fax') || (dt === 'phone')) {
      this.data_type = 'tel';
    }
  }

}

export class LoopTag extends Tag {
  parent: Loop;
  constructor(name: string, value: string, parent: Loop) {
     super(name, value);
     this.parent = parent;
  }

  updateTagStatus(tag_prefix) {
    this.fqtn = tag_prefix + '.' + this.name;
    this.valid = this.parent.parent.parent.schema.checkDatatype(this.fqtn, this.value);
    this.schema_values = this.parent.parent.parent.schema.getTag(this.fqtn);
    this.enums = this.parent.parent.parent.schema.enumerations[this.fqtn];
  }

}

