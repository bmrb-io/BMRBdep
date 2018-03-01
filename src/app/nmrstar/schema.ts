interface TagDataMap {
    [tag: string]: {};
}

export class Schema {
  /* Populated from parameters */
  version: string;
  headers: string[];
  tags: string[][];
  enumerations: {};
  data_types = {};

  /* Calculated during construction */
  schema: TagDataMap;
  tag_order: string[];
  category_order: string[];


  toJSON(key) {
    const cloneObj = { ...this as Schema };

    delete cloneObj.schema;
    delete cloneObj.category_order;
    delete cloneObj.tag_order;

    /* If the entry was embedded in something else...
    if (key) {
      cloneObj.code = key;
    } */

    return cloneObj;
  }

  constructor (json: Object) {

    this.tags = json['tags'];
    this.version = json['version'];
    this.headers = json['headers'];
    this.data_types = json['data_types'];
    this.enumerations = json['enumerations'];
    this.category_order = [];
    this.tag_order = [];
    this.schema = {};

    if (!this.headers) {
      return;
    }

    const tag_col = this.headers.indexOf('Tag');
    const cat_col = this.headers.indexOf('SFCategory');

    for (const schem_tag of this.tags) {
      // Set the category order and tag order
      this.tag_order.push(schem_tag[tag_col]);
      if (this.category_order.indexOf(schem_tag[cat_col]) < 0) {
        this.category_order.push(schem_tag[cat_col]);
      }

      const tt = {};
      for (let i = 0; i <= this.headers.length; i++) {
        tt[this.headers[i]] = schem_tag[i];
      }
      this.schema[schem_tag[tag_col]] = tt;
    }
  }

  getTag(tag_name: string) {
    return this.schema[tag_name];
  }

  getValue(tag_name: string, tag_property: string) {
    const tag = this.getTag(tag_name);
    if (tag) {
      return tag[tag_property];
    } else {
      return null;
    }
  }

  /* Returns true if data is valid. */
  checkDatatype(tag_name: string, tag_value: string): boolean {
    const tag_datatype = this.getValue(tag_name, 'BMRB data type');
    const regexp = new RegExp(this.data_types[tag_datatype]);
    let regex_pass = regexp.test(tag_value);
    // Fail the check if the value is null
    if (!this.getValue(tag_name, 'Nullable')) {
      if (tag_value === null) {
        console.log(tag_name);
        regex_pass = false;
      }
    }
    return regex_pass;
  }
}
