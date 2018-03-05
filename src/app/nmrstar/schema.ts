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
  overrides: string[][];
  override_dict = {};

  /* Calculated during construction */
  schema: TagDataMap;
  tag_order: string[];
  category_order: string[];


  toJSON(key) {
    const cloneObj = { ...this as Schema };

    delete cloneObj.schema;
    delete cloneObj.category_order;
    delete cloneObj.tag_order;
    delete cloneObj.override_dict;

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
    this.overrides = json['overrides'];
    this.category_order = [];
    this.tag_order = [];
    this.schema = {};
    this.override_dict = {};

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

    for (const or of this.overrides) {
      if (!this.override_dict[or[0]]) {
        this.override_dict[or[0]] = [];
      }
      this.override_dict[or[0]].push(or.slice(1));
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

}
