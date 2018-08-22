interface TagDataMap {
    [tag: string]: {};
}

export class Schema {
  /* Populated from parameters */
  version: string;
  tags: {};
  saveframes: {};
  data_types = {};
  file_upload_types;
  overrides: {};
  override_dict = {};

  /* Calculated during construction */
  schema: TagDataMap;
  saveframe_schema: TagDataMap;


  toJSON(): {} {
    return {version: this.version, tags: this.tags, saveframes: this.saveframes, data_types: this.data_types,
            overrides: this.overrides, file_upload_types: this.file_upload_types};
  }

  constructor (json: Object) {

    this.version = json['version'];
    this.tags = json['tags'];
    this.data_types = json['data_types'];
    this.overrides = json['overrides'];
    this.saveframes = json['saveframes'];
    this.file_upload_types = json['file_upload_types'];
    this.schema = {};
    this.saveframe_schema = {};
    this.override_dict = {};

    if (!this.tags) {
      return;
    }

    // Assign the overrides to the appropriate tags
    const or_tag_col = this.overrides['headers'].indexOf('Conditional tag');
    const cond_tag_col = this.overrides['headers'].indexOf('Conditional tag');
    const sf_cat_col = this.overrides['headers'].indexOf('Sf category');
    const tag_cat_col = this.overrides['headers'].indexOf('Tag category');
    for (const or of this.overrides['values']) {
      if (!this.override_dict[or[sf_cat_col]]) {
        this.override_dict[or[sf_cat_col]] = {};
      }
      const current_category = this.override_dict[or[sf_cat_col]];
      if (!current_category[or[tag_cat_col]]) {
        current_category[or[tag_cat_col]] = {};
      }
      const current_tag = current_category[or[tag_cat_col]];
      if (!current_tag[or[or_tag_col]]) {
        current_tag[or[or_tag_col]] = [];
      }

      // Turn the overrides into a dictionary
      const tt = {};
      for (let i = 0; i <= this.overrides['headers'].length; i++) {
        if (or[i] != null) {
          tt[this.overrides['headers'][i]] = or[i];
        }
      }

      // Push the override onto the appropriate tag
      this.override_dict[or[sf_cat_col]][or[tag_cat_col]][or[or_tag_col]].push(tt);
    }

    // Turn the tags into a dictionary of values
    const tag_col = this.tags['headers'].indexOf('Tag');

    for (const schema_tag of Object.keys(this.tags['values'])) {
      const tt = {};
      for (let i = 0; i <= this.tags['headers'].length; i++) {
        if (this.tags['values'][schema_tag][i] != null) {
          tt[this.tags['headers'][i]] = this.tags['values'][schema_tag][i];
        }
      }
      tt['overrides'] = this.getOverridePointers(tt);
      this.schema[this.tags['values'][schema_tag][tag_col]] = tt;
    }

    // Turn the schema values into a dictionary
    for (const saveframe_category of Object.keys(this.saveframes['values'])) {
      const saveframe = this.saveframes['values'][saveframe_category];
      const tt = {};
      for (let i = 0; i <= this.saveframes['headers'].length; i++) {
        if (saveframe[i] != null) {
          tt[this.saveframes['headers'][i]] = saveframe[i];
        }
      }
      this.saveframe_schema[saveframe_category] = tt;
    }

  }


  private getOverridePointers(tag: {}): {} {
    // saveframeCategoryRoot is saveframe category root
    const saveframeCategoryRoot = this.override_dict[tag['SFCategory']];

    let overrides = [];
    if (saveframeCategoryRoot) {
      for (const field of [tag['Tag category'], '*']) {
        if (field in saveframeCategoryRoot) {
          const sf_cat = saveframeCategoryRoot[field];
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
      a = parseInt(a['Order of operation'], 10);
      b = parseInt(b['Order of operation'], 10);
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

  getTag(tag_name: string): {} {
    return this.schema[tag_name];
  }

}
