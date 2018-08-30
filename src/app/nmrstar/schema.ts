class NotNullChecker {
  constructor () {}
  static test(value: string) {
    return value !== null;
  }
}

export class Schema {
  /* Populated from parameters */
  version: string;
  tags: {};
  saveframes: {};
  data_types = {};
  file_upload_types;
  overrides: {};
  overridesDictList: Array<{}>;

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
    this.overridesDictList = [];

    if (!this.tags) {
      return;
    }

    // Assign the overrides to the appropriate tags
    for (const overrideRecord of this.overrides['values']) {

      // Generate an override dictionary for a single override
      const overrideDictionary = {};
      for (let i = 0; i <= this.overrides['headers'].length; i++) {
        if (overrideRecord[i] != null) {
          overrideDictionary[this.overrides['headers'][i]] = overrideRecord[i];
        }
      }

      if (overrideDictionary['Override value'] === '*') {
        overrideDictionary['Regex'] = NotNullChecker;
      } else {
        overrideDictionary['Regex'] = new RegExp('^' + overrideDictionary['Override value'] + '$');
      }

      overrideDictionary['Conditional tag prefix'] = overrideDictionary['Conditional tag'].split('.')[0];
      if (overrideDictionary['Tag category'] !== '*') {
        overrideDictionary['Tag category'] = '_' + overrideDictionary['Tag category'];
      }


      this.overridesDictList.push(overrideDictionary);
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

  getTag(tag_name: string): {} {
    return this.schema[tag_name];
  }

}
