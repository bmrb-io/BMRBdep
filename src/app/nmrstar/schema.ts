class NotNullChecker {
  constructor() {
  }

  static test(value: string) {
    return value !== null;
  }
}

export class Schema {
  /* Populated from parameters */
  version: string;
  tags: {};
  saveframes: {};
  dataTypes = {};
  fileUploadTypes;
  overrides: {};
  overridesDictList: Array<{}>;
  categorySuperGroups: {};
  categorySupergroupsDictList: Array<Array<{}>>;
  categorySuperGroupsDescription: {};

  /* Calculated during construction */
  schema: {};
  saveframeSchema: {};


  toJSON(): {} {
    return {
      version: this.version, tags: this.tags, saveframes: this.saveframes, data_types: this.dataTypes,
      overrides: this.overrides, file_upload_types: this.fileUploadTypes, category_supergroups: this.categorySuperGroups,
      supergroup_descriptions: this.categorySuperGroupsDescription
    };
  }

  /* Delete unnecessary un-parsed schema data. Only run once serialized and saved locally. */
  cleanUp(): void {
    delete this.tags;
    delete this.overrides;
    delete this.categorySuperGroups;
    delete this.saveframes;
  }

  constructor(json: Object) {

    this.version = json['version'];
    this.tags = json['tags'];
    this.dataTypes = json['data_types'];
    this.overrides = json['overrides'];
    this.categorySuperGroups = json['category_supergroups'];
    this.categorySuperGroupsDescription = json['supergroup_descriptions'];
    this.saveframes = json['saveframes'];
    this.fileUploadTypes = json['file_upload_types'];
    this.schema = {};
    this.saveframeSchema = {};
    this.overridesDictList = [];
    this.categorySupergroupsDictList = [];

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

    const superGroupMapping = {};
    const superGroupIDCol = json['supergroup_descriptions']['headers'].indexOf('super_group_ID');
    const superGroupDisplayNameCol = json['supergroup_descriptions']['headers'].indexOf('super_group_name');
    const superGroupHelpCol = json['supergroup_descriptions']['headers'].indexOf('Description');
    for (const superGroup of json['supergroup_descriptions']['values']) {
      superGroupMapping[superGroup[superGroupIDCol]] = [superGroup[superGroupDisplayNameCol], superGroup[superGroupHelpCol]];
    }

    // Build a data structure for the supergroups
    const temporarySuperGroupList = [];
    for (const supergroupRecord of this.categorySuperGroups['values']) {

      // Generate an override dictionary for a single override
      const superGroupRecord = {};
      for (let i = 0; i <= this.categorySuperGroups['headers'].length; i++) {
        if (this.categorySuperGroups['headers'][i]) {
          superGroupRecord[this.categorySuperGroups['headers'][i]] = supergroupRecord[i];
        }
      }
      superGroupRecord['super_group_display_name'] = superGroupMapping[superGroupRecord['category_super_group_ID']][0];
      superGroupRecord['super_group_help'] = superGroupMapping[superGroupRecord['category_super_group_ID']][1];
      temporarySuperGroupList.push(superGroupRecord);
    }
    const temporaryGroupDict = {};
    for (const superRecord of temporarySuperGroupList) {
      if (!(superRecord['category_super_group'] in temporaryGroupDict)) {
        temporaryGroupDict[superRecord['category_super_group']] = [superRecord];
      } else {
        temporaryGroupDict[superRecord['category_super_group']].push(superRecord);
      }
    }
    for (const superRecord of temporarySuperGroupList) {
      if (!(this.categorySupergroupsDictList.indexOf(temporaryGroupDict[superRecord['category_super_group']]) > -1)) {
        this.categorySupergroupsDictList.push(temporaryGroupDict[superRecord['category_super_group']]);
      }
    }

    // Generate the tag schema dictionary and add it to the dictionary of tag schemas
    const tagCol = this.tags['headers'].indexOf('Tag');
    const dataTypeCol = this.tags['headers'].indexOf('BMRB data type');
    for (const schemaTag of Object.keys(this.tags['values'])) {
      const tagSchemaDictionary = {};
      for (let i = 0; i <= this.tags['headers'].length; i++) {
        if (this.tags['values'][schemaTag][i] != null) {
          if (i === dataTypeCol) {
            tagSchemaDictionary['Regex'] = new RegExp('^' + this.dataTypes[this.tags['values'][schemaTag][i]] + '$');
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
      this.saveframeSchema[saveframeCategory] = saveframeSchemaDictionary;
    }
  }

  getTag(tagName: string): {} {
    return this.schema[tagName];
  }

}
