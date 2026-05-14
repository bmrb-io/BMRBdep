import {checkValueIsNull} from './nmrstar';
import {
  FileUploadType,
  OverrideRule,
  RawSaveframeTable,
  RawTagTable,
  RawValueRows,
  SaveframeSchemaEntry,
  SchemaJSON,
  SuperGroupDescription,
  SuperGroupRecord,
  TagSchemaEntry,
  Tester,
} from './schemaTypes';

class NotNullChecker {
  static test(value: string): boolean {
    return !checkValueIsNull(value);
  }
}

export class Schema {
  /* Populated from parameters */
  version: string;
  tags: RawTagTable | undefined;
  saveframes: RawSaveframeTable | undefined;
  dataTypes: { [dataType: string]: string } = {};
  fileUploadTypes: FileUploadType[];
  overrides: RawValueRows | undefined;
  overridesDictList: OverrideRule[];
  categorySuperGroups: RawValueRows | undefined;
  categorySupergroupsDictList: SuperGroupRecord[][];
  categorySuperGroupsDescription: RawValueRows;
  categorySuperGroupsDescriptionDict: { [id: string]: SuperGroupDescription };

  /* Calculated during construction */
  schema: { [tagName: string]: TagSchemaEntry };
  saveframeSchema: { [category: string]: SaveframeSchemaEntry };


  toJSON(): object {
    return {
      version: this.version, tags: this.tags, saveframes: this.saveframes, data_types: this.dataTypes,
      overrides: this.overrides, file_upload_types: this.fileUploadTypes, category_supergroups: this.categorySuperGroups,
      supergroup_descriptions: this.categorySuperGroupsDescription
    };
  }

  constructor(json: SchemaJSON) {

    this.version = json.version;
    this.tags = json.tags;
    this.dataTypes = json.data_types;
    this.overrides = json.overrides;
    this.categorySuperGroups = json.category_supergroups;
    this.categorySuperGroupsDescription = json.supergroup_descriptions;
    this.categorySuperGroupsDescriptionDict = {};
    this.saveframes = json.saveframes;
    this.fileUploadTypes = json.file_upload_types;
    this.schema = {};
    this.saveframeSchema = {};
    this.overridesDictList = [];
    this.categorySupergroupsDictList = [];

    if (!this.tags) {
      return;
    }

    // Assign the overrides to the appropriate tags
    for (const overrideRecord of this.overrides.values) {

      // Generate an override dictionary for a single override
      const overrideDictionary: Record<string, unknown> = {};
      for (let i = 0; i <= this.overrides.headers.length; i++) {
        if (overrideRecord[i] != null) {
          overrideDictionary[this.overrides.headers[i]] = overrideRecord[i];
        }
      }

      const regex: Tester = overrideDictionary['Override value'] === '*'
        ? NotNullChecker
        : new RegExp('^' + (overrideDictionary['Override value'] as string) + '$');
      overrideDictionary['Regex'] = regex;

      const conditionalTag = overrideDictionary['Conditional tag'] as string;
      overrideDictionary['Conditional tag prefix'] = conditionalTag.split('.')[0];
      if (overrideDictionary['Tag category'] !== '*') {
        overrideDictionary['Tag category'] = '_' + (overrideDictionary['Tag category'] as string);
      }


      this.overridesDictList.push(overrideDictionary as unknown as OverrideRule);
    }

    // Load the super group help data
    for (const superGroup of this.categorySuperGroupsDescription.values) {
      // Generate an override dictionary for a single override
      const superGroupRecord: Record<string, unknown> = {};
      for (let i = 0; i <= this.categorySuperGroupsDescription.headers.length; i++) {
        if (this.categorySuperGroupsDescription.headers[i]) {
          superGroupRecord[this.categorySuperGroupsDescription.headers[i]] = superGroup[i];
        }
      }
      this.categorySuperGroupsDescriptionDict[superGroup[0] as string] = superGroupRecord as unknown as SuperGroupDescription;
    }

    // Build a data structure for the supergroups
    const temporarySuperGroupList: SuperGroupRecord[] = [];
    for (const supergroupRecord of this.categorySuperGroups.values) {

      // Generate an override dictionary for a single override
      const superGroupRecord: Record<string, unknown> = {};
      for (let i = 0; i <= this.categorySuperGroups.headers.length; i++) {
        if (this.categorySuperGroups.headers[i]) {
          superGroupRecord[this.categorySuperGroups.headers[i]] = supergroupRecord[i];
        }
      }
      temporarySuperGroupList.push(superGroupRecord as unknown as SuperGroupRecord);
    }
    const temporaryGroupDict: { [key: string]: SuperGroupRecord[] } = {};
    for (const superRecord of temporarySuperGroupList) {
      if (!(superRecord.category_super_group in temporaryGroupDict)) {
        temporaryGroupDict[superRecord.category_super_group] = [superRecord];
      } else {
        temporaryGroupDict[superRecord.category_super_group].push(superRecord);
      }
    }
    for (const superRecord of temporarySuperGroupList) {
      if (!(this.categorySupergroupsDictList.indexOf(temporaryGroupDict[superRecord.category_super_group]) > -1)) {
        this.categorySupergroupsDictList.push(temporaryGroupDict[superRecord.category_super_group]);
      }
    }

    // Generate the tag schema dictionary and add it to the dictionary of tag schemas
    const tagCol = this.tags.headers.indexOf('Tag');
    const dataTypeCol = this.tags.headers.indexOf('BMRB data type');
    const enumCol = this.tags.headers.indexOf('enumerations');
    for (const schemaTag of Object.keys(this.tags.values)) {
      const tagSchemaDictionary: Record<string, unknown> = {};
      for (let i = 0; i <= this.tags.headers.length; i++) {
        if (this.tags.values[schemaTag][i] != null) {
          if (i === enumCol && (this.tags.values[schemaTag][enumCol] as unknown[]).length > 0) {
            const enumList = this.tags.values[schemaTag][enumCol] as unknown[];
            for (let pos = 0; pos < enumList.length; pos++) {
              const singleEnum = enumList[pos];

              // This code upgrades the enum format to the new enum,description format
              // It can be removed after 6 months (to allow clients caches to have cleared).
              // Can remove after: 06/01/2020
              if (typeof singleEnum === 'string' || singleEnum instanceof String) {
                enumList[pos] = [singleEnum, singleEnum];
              } else {
                const pair = singleEnum as [string, string];
                if (pair[1] === '.') {
                  pair[1] = pair[0];
                }
              }
            }

          }
          if (i === dataTypeCol) {
            const bmrbDataType = this.tags.values[schemaTag][i] as string;
            tagSchemaDictionary['BMRB data type'] = bmrbDataType;
            if (bmrbDataType === 'line' || bmrbDataType === 'text') {
              tagSchemaDictionary['Regex'] = NotNullChecker;
            } else {
              tagSchemaDictionary['Regex'] = new RegExp('^' + this.dataTypes[bmrbDataType] + '$');
            }

          } else {
            tagSchemaDictionary[this.tags.headers[i]] = this.tags.values[schemaTag][i];
          }
        }
      }
      // Don't show a default value of "?"
      if (checkValueIsNull(tagSchemaDictionary['default value'] as string)) {
        tagSchemaDictionary['default value'] = '';
      }
      this.schema[this.tags.values[schemaTag][tagCol] as string] = tagSchemaDictionary as unknown as TagSchemaEntry;
    }

    // Generate the dictionary of saveframe-level info
    for (const saveframeCategory of Object.keys(this.saveframes.values)) {
      const saveframeSchemaList = this.saveframes.values[saveframeCategory];
      const saveframeSchemaDictionary: Record<string, unknown> = {};
      for (let i = 0; i <= this.saveframes.headers.length; i++) {
        if (saveframeSchemaList[i] != null) {
          saveframeSchemaDictionary[this.saveframes.headers[i]] = saveframeSchemaList[i];
        }
      }
      this.saveframeSchema[saveframeCategory] = saveframeSchemaDictionary as unknown as SaveframeSchemaEntry;
    }
  }

  getTag(tagName: string): TagSchemaEntry | undefined {
    return this.schema[tagName];
  }

}
