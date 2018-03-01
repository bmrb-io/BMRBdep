import { Saveframe } from './saveframe';
import { Loop } from './loop';

class Tag {
  name: string;
  value: string;

  valid: boolean;
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

