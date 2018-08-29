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
  schema: {};
  saveframe_schema: {};


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

    const conditionalTagCol = this.overrides['headers'].indexOf('Conditional tag');
    const sfCategoryCol = this.overrides['headers'].indexOf('Sf category');
    const tagCategoryCol = this.overrides['headers'].indexOf('Tag category');
    const conditionalValueCol = this.overrides['headers'].indexOf('Override value');

    // Assign the overrides to the appropriate tags
    for (const overrideRecord of this.overrides['values']) {
      const conditionalTag =  overrideRecord[conditionalTagCol];
      const sfCategory = overrideRecord[sfCategoryCol];
      const tagCategory = overrideRecord[tagCategoryCol];

      // Create a dictionary for this saveframe category if none exists
      if (!this.override_dict[sfCategory]) {
        this.override_dict[sfCategory] = {};
      }
      // Create a dictionary for the tag category if none exists
      const categoryDictionary = this.override_dict[sfCategory];
      if (!categoryDictionary[tagCategory]) {
        categoryDictionary[tagCategory] = {};
      }
      // Create a list of the tag rules if none exists
      const fullyResolvedTagList = categoryDictionary[tagCategory];
      if (!fullyResolvedTagList[conditionalTag]) {
        fullyResolvedTagList[conditionalTag] = [];
      }

      // Generate an override dictionary for a single override
      const overrideDictionary = {};
      for (let i = 0; i <= this.overrides['headers'].length; i++) {
        if (overrideRecord[i] != null) {
          if ((i === conditionalValueCol) && (overrideRecord[i] !== '*')) {
            overrideDictionary[this.overrides['headers'][i]] = new RegExp('^' + overrideRecord[i] + '$');
          } else {
            overrideDictionary[this.overrides['headers'][i]] = overrideRecord[i];
          }
        }
      }

      // Push the override onto the appropriate tag
      fullyResolvedTagList[conditionalTag].push(overrideDictionary);
    }

    // Generate the tag schema dictionary and add it to the dictionary of tag schemas
    const tagCol = this.tags['headers'].indexOf('Tag');
    const dataTypeCol = this.tags['headers'].indexOf('BMRB data type');
    for (const schemaTag of Object.keys(this.tags['values'])) {
      const tagSchemaDictionary = {};
      for (let i = 0; i <= this.tags['headers'].length; i++) {
        if (this.tags['values'][schemaTag][i] != null) {
          if (i === dataTypeCol) {
            tagSchemaDictionary['Regex'] = new RegExp('^' + this.data_types[this.tags['values'][schemaTag][i]] + '$');
            tagSchemaDictionary['BMRB data type'] = this.tags['values'][schemaTag][i];
          } else {
            tagSchemaDictionary[this.tags['headers'][i]] = this.tags['values'][schemaTag][i];
          }
        }
      }
      tagSchemaDictionary['overrides'] = this.getOverridePointers(tagSchemaDictionary);
      this.schema[this.tags['values'][schemaTag][tagCol]] = tagSchemaDictionary;
    }

    // Generate the dictionary of saveframe-level info
    for (const saveframeCategory of Object.keys(this.saveframes['values'])) {
      const saveframeSchemaList = this.saveframes['values'][saveframeCategory];
      const saveframeSchemaDictionary = {};
      for (let i = 0; i <= this.saveframes['headers'].length; i++) {
        if (saveframeSchemaList[i] != null) {
          saveframeSchemaDictionary[this.saveframes['headers'][i]] = saveframeSchemaList[i];
        }
      }
      this.saveframe_schema[saveframeCategory] = saveframeSchemaDictionary;
    }
  }


  private getOverridePointers(tag: {}): {} {
    // saveframeCategoryRoot is saveframe category root
    const saveframeCategoryRoot = this.override_dict[tag['SFCategory']];

    let overrides = [];
    if (saveframeCategoryRoot) {
      for (const field of [tag['Tag category'], '*']) {
        if (field in saveframeCategoryRoot) {
          const categoryDictionary = saveframeCategoryRoot[field];
          if (tag['Tag'] in categoryDictionary) {
            overrides = overrides.concat(categoryDictionary[tag['Tag']]);
          }
          if ('*' in categoryDictionary) {
            overrides = overrides.concat(categoryDictionary['*']);
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
