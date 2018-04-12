interface TagDataMap {
    [tag: string]: {};
}

export class Schema {
  /* Populated from parameters */
  version: string;
  tags: {};
  saveframes: {};
  enumerations: {};
  data_types = {};
  overrides: {};
  override_dict = {};

  /* Calculated during construction */
  schema: TagDataMap;
  saveframe_schema: TagDataMap;


  toJSON(key) {
    const cloneObj = { ...this as Schema };

    delete cloneObj.schema;
    delete cloneObj.override_dict;
    delete cloneObj.saveframe_schema;
    return cloneObj;
  }

  constructor (json: Object) {

    this.version = json['version'];
    this.tags = json['tags'];
    this.data_types = json['data_types'];
    this.overrides = json['overrides'];
    this.saveframes = json['saveframes'];
    this.schema = {};
    this.saveframe_schema = {};
    this.override_dict = {};

    if (!this.tags) {
      return;
    }

    // Assign the overrides to the appropriate tags
    const or_tag_col = this.overrides['headers'].indexOf('Tag');
    const sf_cat_col = this.overrides['headers'].indexOf('Sf category');
    const tag_cat_col = this.overrides['headers'].indexOf('Tag category');
    for (const or of this.overrides['values']) {
      if (!this.override_dict[or[sf_cat_col]]) {
        this.override_dict[or[sf_cat_col]] = {};
      }
      if (!this.override_dict[or[sf_cat_col]][or[tag_cat_col]]) {
        this.override_dict[or[sf_cat_col]][or[tag_cat_col]] = {};
      }
      if (!this.override_dict[or[sf_cat_col]][or[tag_cat_col]][or[or_tag_col]]) {
        this.override_dict[or[sf_cat_col]][or[tag_cat_col]][or[or_tag_col]] = [];
      }


      
      // Push the override onto the appropriate tag
      this.override_dict[or[sf_cat_col]][or[tag_cat_col]][or[or_tag_col]].push(or.slice(1));
    }

    // Turn the tags into a dictionary of values
    const tag_col = this.tags['headers'].indexOf('Tag');
    const cat_col = this.tags['headers'].indexOf('SFCategory');

    for (const schem_tag of Object.keys(this.tags['values'])) {
      const tt = {};
      for (let i = 0; i <= this.tags['headers'].length; i++) {
        if (this.tags['values'][schem_tag][i]) {
          tt[this.tags['headers'][i]] = this.tags['values'][schem_tag][i];
        }
      }
      tt['overrides'] = this.getOverrides(tt);
      this.schema[this.tags['values'][schem_tag][tag_col]] = tt;
    }

    // Turn the schema values into a dictionary
    for (const saveframe_category of Object.keys(this.saveframes['values'])) {
      const saveframe = this.saveframes['values'][saveframe_category];
      const tt = {};
      for (let i = 0; i <= this.saveframes['headers'].length; i++) {
        if (saveframe[i]) {
          tt[this.saveframes['headers'][i]] = saveframe[i];
        }
      }
      this.saveframe_schema[saveframe_category] = tt;
    }

    console.log(this);
  }

  // Returns true if the strings match, or either is a * character
  private starMatch(string1: string, string2: string) {
    if (string1 === string2 || string1 === '*' || string2 === '*') {
      return true;
    }
    return false;
  }

  private getOverrides(tag: {}): {} {
    // sf_or is saveframe category root
    const sf_or = this.override_dict[tag['SFCategory']];

    let overrides = [];
    if (sf_or) {
      for (const field of [tag['Tag category'], '*']) {
        if (field in sf_or) {
          const sf_cat = sf_or[field];
          if (tag['Tag'] in sf_cat) {
            overrides = overrides.concat(sf_cat[tag['Tag']]);
          }
          if ('*' in sf_cat) {
            overrides = overrides.concat(sf_cat['*']);
          }
        }
      }
    }
    function comparator(a, b) {
      a = parseInt(a[-1], 10);
      b = parseInt(b[-1], 10);
      if (a < b) {
        return -1;
      } else if (a > b) {
        return 1;
      } else {
        return 0;
      }
    }
    overrides = overrides.sort(comparator);
    return overrides;
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
