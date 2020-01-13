import {Saveframe, saveframeFromJSON} from './saveframe';
import {Schema} from './schema';
import {DataFileStore} from './dataStore';
import {LoopTag} from './tag';
import {Loop} from './loop';

class SuperCategoryInfo {
  superCategory: string;
  displayName: string;
  displayHelp: string;
  valid: boolean;
  display: string;
  children: Array<CategoryInfo>;

  constructor(superCategory: string,
              displayName: string,
              displayHelp: string,
              valid: boolean = true,
              display: string = 'H') {
    this.superCategory = superCategory;
    this.displayName = displayName;
    this.displayHelp = displayHelp;
    this.valid = valid;
    this.display = display;
    this.children = [];
  }
}

class CategoryInfo {
  category: string;
  displayName: string;
  valid: boolean;
  display: string;

  constructor(category: string,
              displayName: string,
              valid: boolean = true,
              display: string = 'H') {
    this.category = category;
    this.displayName = displayName;
    this.valid = valid;
    this.display = display;
  }
}

export function entryFromJSON(jdata: Object): Entry {
  const entry = new Entry(jdata['entry_id']);
  entry.schema = new Schema(jdata['schema']);
  entry.emailValidated = jdata['email_validated'];
  entry.deposited = jdata['entry_deposited'];
  entry.depositionNickname = jdata['deposition_nickname'];
  entry.commit = jdata['commit'];

  // This code upgrades the user session to the new commits-as-list format
  // It can be removed after 6 months (to allow clients caches to have cleared).
  // Can remove after: 06/01/2020
  if (typeof entry.commit === 'string' || entry.commit instanceof String) {
    entry.commit = [entry.commit];
  }


  if ('unsaved' in jdata) {
    entry.unsaved = jdata['unsaved'];
  } else {
    entry.unsaved = false;
  }

  for (const saveframeJSON of jdata['saveframes']) {
    const newFrame = saveframeFromJSON(saveframeJSON, entry);
    entry.addSaveframe(newFrame, -1, false);
  }

  entry.regenerateDataStore(); // This must come before the refresh, because the tags require knowing what data files are available
  entry.updateUploadedData(); // This makes sure the Entry.xxx tags are set properly, if they started with an uploaded data file
  entry.refresh();
  return entry;
}

export class Entry {
  entryID: string;
  saveframes: Saveframe[];
  schema: Schema;
  superGroups: Array<SuperCategoryInfo>;
  enumerationTies: {};
  source: string;
  dataStore: DataFileStore;
  valid: boolean;
  showAll: boolean;
  hasDeleted: boolean;
  emailValidated: boolean;
  deposited: boolean;
  depositionNickname: string;
  firstIncompleteCategory: string;
  commit: Array<string>;
  unsaved: boolean;

  constructor(dataName: string) {
    this.entryID = dataName;
    this.saveframes = [];
    this.enumerationTies = {};
    this.valid = true;
    this.showAll = true;
    this.hasDeleted = false;
    this.emailValidated = false;
    this.deposited = false;
    this.depositionNickname = null;
    this.firstIncompleteCategory = null;

    this.updateCategories();
  }

  toJSON(): {} {
    return {
      entry_id: this.entryID, saveframes: this.saveframes, email_validated: this.emailValidated,
      deposition_nickname: this.depositionNickname, entry_deposited: this.deposited, unsaved: this.unsaved,
      commit: this.commit
    };
  }

  addCommit(commit: string) {
    this.commit.push(commit);
    if (this.commit.length > 15) {
      this.commit.splice(0, 1);
    }
  }

  checkCommit(commit: string) {
    return this.commit.includes(commit);
  }

  /* Add a new saveframe to the saveframe list.
     Optionally specify position if not at end. */
  addSaveframe(saveframe: Saveframe, position: number = -1, refresh: boolean = true): void {
    if (position < 0) {
      this.saveframes.push(saveframe);
    } else {
      this.saveframes.splice(position, 0, saveframe);
    }

    if (refresh) {
      this.refresh();
    }
  }

  restoreByCategory(category: string): void {
    for (const sf of this.getSaveframesByCategory(category)) {
      sf.restore();
    }
  }

  updateCategories(): void {

    if (!this.schema) {
      return;
    }

    // First get the categories, and their order
    const categories = new Set();
    for (const sf of this.saveframes) {
      if (!sf.deleted) {
        categories.add(sf.category);
      }
    }
    const categoryStatusDict = {};

    // Then check all of the saveframes in each category to determine if the category group is valid and needs to be displayed
    //  Also, set the first invalid saveframe in the process
    this.firstIncompleteCategory = null;
    for (const category of Array.from(categories)) {
      if (!(typeof category === 'string')) {
        throw new Error(('Bug in code: category should have been a string.'));
      }
      if (!this.schema.saveframeSchema[category]) {
        console.error('A saveframe exists with an invalid category:', category);
        continue;
      }
      const prettyName = this.schema.saveframeSchema[category]['category_group_view_name'];

      const matchingSaveframes = this.getSaveframesByCategory(category);

      // Determine category validity
      let valid = true;
      for (const saveframe of matchingSaveframes) {
        if (!saveframe.valid && !saveframe.deleted) {
          valid = false;
        }
      }
      // Determine category display rules
      let display = 'H';
      for (const saveframe of matchingSaveframes) {
        if (saveframe.display === 'Y') {
          display = 'Y';
          break;
        }
        if (display === 'H') {
          display = saveframe.display;
        }
      }

      // Determine the first incomplete category
      if (this.firstIncompleteCategory === null && !valid && display !== 'H') {
        this.firstIncompleteCategory = category;
      }

      // Add the record
      categoryStatusDict[category] = new CategoryInfo(category, prettyName, valid, display);
    }

    // Update a record of which supergroup categories are valid and should be displayed
    const categoryOrder = [];
    this.superGroups = [];
    if (this.schema) {
      for (const supergroup of this.schema.categorySupergroupsDictList) {

        const singleSuperRecord = new SuperCategoryInfo(supergroup[0]['category_super_group'],
          this.schema.categorySuperGroupsDescriptionDict[supergroup[0]['category_super_group_ID']]['super_group_name'],
          this.schema.categorySuperGroupsDescriptionDict[supergroup[0]['category_super_group_ID']]['Description']);
        this.superGroups.push(singleSuperRecord);

        for (const group of supergroup) {
          // Handle the case that the specific saveframe has been deleted
          if (categoryStatusDict[group['saveframe_category']] === undefined) {
            continue;
          }

          // Add the category to the supergroup
          const singleCategoryRecord = categoryStatusDict[group['saveframe_category']];
          singleSuperRecord.children.push(singleCategoryRecord);

          // Determine whether or not to set a saveframe in the record of saveframe order
          if (singleCategoryRecord.display === 'Y' || (singleCategoryRecord.display === 'N' && this.showAll)) {
            categoryOrder.push(singleCategoryRecord.category);
          }

          // Update the valid value
          if (!categoryStatusDict[group['saveframe_category']].valid) {
            singleSuperRecord.valid = false;
          }
          // Update the show saveframe value
          const showSaveframe = categoryStatusDict[group['saveframe_category']].display;
          if (singleSuperRecord.display === 'H') {
            singleSuperRecord.display = showSaveframe;
          } else {
            if (showSaveframe === 'Y') {
              singleSuperRecord.display = 'Y';
            }
          }
        }
      }
    }

    function setNextAndPreviousCategories(saveframe) {
      const index = categoryOrder.indexOf(saveframe.category);

      /* In the case that the saveframe is no longer displayed (i.e. index < 0)
         do not reset the next and previous saveframes - just keep what was there before
         the update. Otherwise navigation breaks if viewing a saveframe with all non-mandatory tags
         which is hid upon toggling 'Display non-mandatory tags'. */
      if (index === 0) {
        saveframe.previousCategory = null;
      } else if (index > 0) {
        saveframe.previousCategory = categoryOrder[index - 1];
      }

      if (index + 1 === categoryOrder.length) {
        saveframe.nextCategory = null;
      } else if (index >= 0) {
        saveframe.nextCategory = categoryOrder[index + 1];
      }
    }

    // Set the "next" and "previous" saveframes
    for (const saveframe of this.saveframes) {
      setNextAndPreviousCategories(saveframe);
    }
  }

  print(): string {
    let result = 'data_' + this.entryID + '\n\n';

    for (const sf of this.saveframes) {
      result += sf.print();
    }

    return result;
  }

  getTagValue(fqtn: string, skip: Saveframe = null): string {

    for (const saveframe of this.saveframes) {
      // Skip checking the saveframe that called us, if one did
      if (saveframe === skip) {
        continue;
      }

      // Ask the saveframe for the tag, return it if found
      const saveframeResult = saveframe.getTagValue(fqtn);
      if (saveframeResult) {
        return saveframeResult;
      }
    }

    return null;
  }

  getSaveframeByName(saveframeName: string): Saveframe {
    for (const sf of this.saveframes) {
      if (sf.name === saveframeName) {
        return sf;
      }
    }
    return null;
  }

  getSaveframesByCategory(saveframeCategory: string): Saveframe[] {
    const returnList: Saveframe[] = [];
    for (const sf of this.saveframes) {
      if (sf.category.toLowerCase() === saveframeCategory.toLowerCase()) {
        returnList.push(sf);
      }
    }
    return returnList;
  }

  getSaveframesByPrefix(tagPrefix: string): Saveframe[] {
    const returnList: Saveframe[] = [];
    for (const sf of this.saveframes) {
      if (sf.tagPrefix === tagPrefix) {
        returnList.push(sf);
      }
    }
    return returnList;
  }

  refresh(): void {

    // Reset the enumeration ties
    this.enumerationTies = {};

    // First reset all the tag display values to the default
    for (const saveframe of this.saveframes) {
      for (const tag of saveframe.tags) {
        tag.display = tag.schemaValues['User full view'];
      }
      for (const loop of saveframe.loops) {
        for (const row of loop.data) {
          for (const tag of row) {
            tag.display = tag.schemaValues['User full view'];
          }
        }
      }
    }

    for (const saveframe of this.saveframes) {
      for (const rule of this.schema.overridesDictList) {

        // Check if this is a saveframe we need to test
        if (rule['Conditional tag prefix'] === saveframe.tagPrefix) {
          // Check that the rule is valid
          if (saveframe.tagDict[rule['Conditional tag']] === undefined) {
            console.warn('Dictionary over-ride rule specifies non-existent conditional tag: ' + rule['Conditional tag'], rule);
            // See if the rule fires
          } else if (rule['Regex'].test(saveframe.tagDict[rule['Conditional tag']].value)) {

            // First see if the rule applies to saveframe-level tag
            if (rule['Tag category'] === saveframe.tagPrefix) {
              if (rule['Override view value'] === 'O') {
                // Set the tag to whatever its dictionary value was
                saveframe.tagDict[rule['Tag']].display = saveframe.tagDict[rule['Tag']].schemaValues['User full view'];
              } else {
                const conditionalTag = saveframe.tagDict[rule['Tag']];
                // Set the tag to the override rule
                if (!conditionalTag) {
                  console.warn('Dictionary over-ride rule specifies non-existent tag:', rule['Tag'], rule);
                } else {
                  conditionalTag.display = rule['Override view value'];
                }
              }
              // See if the rule applies to a child loop
            } else {
              const loopsByPrefix = {};
              for (const loop of saveframe.loops) {
                loopsByPrefix[loop.category] = loop;
              }
              // The rule applies to a loop in this saveframe
              if (loopsByPrefix[rule['Tag category']]) {
                loopsByPrefix[rule['Tag category']].setVisibility(rule);
                // The rule applies to a saveframe elsewhere
              } else {
                for (const frame of this.getSaveframesByCategory(rule['Sf category'])) {
                  frame.setVisibility(rule);
                }
              }
            }
          }
          // Check if the rule applies to the value of a tag in the loop
        } else {
          for (const loop of saveframe.loops) {
            if (rule['Conditional tag prefix'] === loop.category) {

              if (rule['Tag category'] === loop.category) {
                // We need to check each row
                const tagCol = loop.getTagIndex(rule['Conditional tag']);
                const applyCol = loop.getTagIndex(rule['Tag']);
                for (const row of loop.data) {
                  if (row[tagCol] && rule['Regex'].test(row[tagCol].value)) {
                    if (rule['Tag category'] === loop.category) {
                      if (row[applyCol] === undefined) {
                        console.warn('Dictionary over-ride rule specifies non-existent tag: ' + rule['Tag'], rule);
                      } else {
                        row[applyCol].display = rule['Override view value'];
                      }
                    }
                  }
                }
              } else {
                // We are here if the rule applies to another loop
                const conditionalIndex = loop.getTagIndex(rule['Conditional tag']);
                if (!conditionalIndex) {
                  console.error('Invalid rule: applies to tag that doesn\'t exist in the specified loop:', rule);
                } else {
                  for (const conditionalRow of loop.data) {
                    if (rule['Regex'].test(conditionalRow[conditionalIndex].value)) {
                      loop.parent.getLoopByPrefix(rule['Tag category']).setVisibility(rule);
                      break;
                    }
                  }
                }
              }

              // There is no way the rule applies to multiple loops in one saveframe
              break;
            }
          }
        }
      }
    }

    // Refresh each saveframe and update the deletion tracker
    this.hasDeleted = false;
    for (const sf of this.saveframes) {
      sf.refresh();
      if (sf.deleted) {
        this.hasDeleted = true;
      }
    }

    // Applies special non-dictionary based behavior to specific saveframes.
    this.specialRules();

    // Update the category order
    this.updateCategories();

    // Update the saveframe 'number of non-deleted saveframes' counter
    for (const supercategory of this.superGroups) {
      for (const category of supercategory.children) {
        const categorySaveframes = this.getSaveframesByCategory(category.category);
        let saveframesInCategory = 0;
        for (const sf of categorySaveframes) {
          if (!sf.deleted) {
            saveframesInCategory += 1;
          }
        }

        for (const sf of categorySaveframes) {
          sf.saveframesInCategory = saveframesInCategory;
        }
      }
    }

    // Check entry validity
    this.valid = true;
    for (const sf of this.saveframes) {
      if (sf.display === 'Y' && !sf.valid) {
        this.valid = false;
        break;
      }
    }
  }

  getLoopsByCategory(category): Loop[] {
    const results: Loop[] = [];
    for (const saveframe of this.saveframes) {
      for (const loop of saveframe.loops) {
        if (loop.category === category) {
          results.push(loop);
        }
      }
    }
    return results;
  }

  /* Update the data files loop */
  updateUploadedData() {

    /*
    First, update the uploaded_data loop
     */
    const dfLoop = this.getLoopsByCategory('_Upload_data')[0];
    dfLoop.data = [];
    for (let i = 0; i < this.dataStore.dataFiles.length; i++) {
      for (let n = -1; n < this.dataStore.dataFiles[i].control.value.length; n++) {
        let contentDescription = null;
        let sfCategory = null;

        // Make sure there is at least an empty record for each file
        if (n === -1) {
          if (this.dataStore.dataFiles[i].control.value.length !== 0) {
            continue;
          }
        } else {
          contentDescription = this.dataStore.dataFiles[i].control.value[n][0];
          sfCategory = this.dataStore.dataFiles[i].control.value[n][1];
        }
        const newRow = dfLoop.addRow();
        newRow[dfLoop.tags.indexOf('Data_file_ID')] = new LoopTag('Data_file_ID', String(dfLoop.data.length), dfLoop);
        newRow[dfLoop.tags.indexOf('Data_file_name')] = new LoopTag('Data_file_name', this.dataStore.dataFiles[i].fileName, dfLoop);
        newRow[dfLoop.tags.indexOf('Data_file_content_type')] = new LoopTag('Data_file_content_type', contentDescription, dfLoop);
        if (sfCategory === null) {
          newRow[dfLoop.tags.indexOf('Data_file_Sf_category')] = new LoopTag('Data_file_Sf_category', null, dfLoop);
        } else {
          if (sfCategory.length === 1) {
            newRow[dfLoop.tags.indexOf('Data_file_Sf_category')] = new LoopTag('Data_file_Sf_category', sfCategory[0], dfLoop);
          } else {
            newRow[dfLoop.tags.indexOf('Data_file_Sf_category')] = new LoopTag('Data_file_Sf_category', '*', dfLoop);
          }
        }
        newRow[dfLoop.tags.indexOf('Data_file_syntax')] = new LoopTag('Data_file_syntax', null, dfLoop);
        newRow[dfLoop.tags.indexOf('Data_file_immutable_flag')] = new LoopTag('Data_file_immutable_flag', null, dfLoop);
        newRow[dfLoop.tags.indexOf('Sf_ID')] = new LoopTag('Sf_ID', null, dfLoop);
        newRow[dfLoop.tags.indexOf('Entry_ID')] = new LoopTag('Entry_ID', this.entryID, dfLoop);
        newRow[dfLoop.tags.indexOf('Deposited_data_files_ID')] = new LoopTag('Deposited_data_files_ID', '1', dfLoop);
      }
    }
    // Ensure the loop always has at least one empty row
    if (!dfLoop.data.length) {
      dfLoop.addRow();
    }

    /*
    Now, update the data types present in the entry_information saveframe
     */
    const infoSaveframe = this.getSaveframesByCategory('entry_interview')[0];

    // Set them all to 'no'
    for (const dropDownItem of this.dataStore.dropDownList) {
      const categoryTag = infoSaveframe.tagDict['_Entry_interview.' + dropDownItem[2]];
      if (categoryTag) {
        categoryTag.value = 'no';
      }
    }

    // Set the appropriate ones to 'yes'
    for (const dataFile of this.dataStore.dataFiles) {
      for (const dataType of dataFile.control.value) {
        const categoryTag = infoSaveframe.tagDict['_Entry_interview.' + dataType[2]];
        if (categoryTag) {
          categoryTag.value = 'yes';
        }
      }
    }
  }

  regenerateDataStore(): void {
    const dataStore = new DataFileStore([], this.schema.fileUploadTypes);
    const dataLoop = this.getLoopsByCategory('_Upload_data')[0];

    function getSelectionByDescription(description: string) {
      for (const dropDownItem of dataStore.dropDownList) {
        if (dropDownItem[0] === description) {
          return dropDownItem;
        }
      }
    }

    const dataBuilder = {};
    const nameList = [];
    const dataDescriptionRow = dataLoop.tags.indexOf('Data_file_content_type');
    const dataFileNameRow = dataLoop.tags.indexOf('Data_file_name');
    for (const dataRow of dataLoop.data) {
      if (!dataRow[dataFileNameRow].value) {
        continue;
      }
      const sel = getSelectionByDescription(dataRow[dataDescriptionRow].value);
      if (!sel) {
        console.error('Could not match saved data type "' + dataRow[dataDescriptionRow].value +
          '" - this is a serious problem as data associations for this file will be lost.');
      }
      if (!dataBuilder[dataRow[dataFileNameRow].value]) {
        dataBuilder[dataRow[dataFileNameRow].value] = [];
        nameList.push(dataRow[dataFileNameRow].value);
      }
      if (sel) {
        dataBuilder[dataRow[dataFileNameRow].value].push(sel);
      }
    }

    for (const name of nameList) {
      dataStore.addFile(name, dataBuilder[name]).percent = 100;
    }

    this.dataStore = dataStore;
  }


  /* Special rules that aren't in the dictionary */
  specialRules(): void {
    // Make sure there is at least one "reference citation" saveframe
    let referenceCitation = false;
    for (const citationFrame of this.getSaveframesByCategory('citations')) {
      if (citationFrame.getTagValue('_Citation.Class') === 'entry citation') {
        referenceCitation = true;
      }
    }
    if (!referenceCitation) {
      for (const citationFrame of this.getSaveframesByCategory('citations')) {
        const classTag = citationFrame.getTag('_Citation.Class');
        classTag.valid = false;
        classTag.validationMessage = 'Each deposition must have at least one saveframe of type "entry citation". ' +
          'Please either create a new citation of type "entry citation" or update one of the existing ones.';
        citationFrame.valid = false;
      }
    }
  }
}
