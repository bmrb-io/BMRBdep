import {Saveframe, saveframeFromJSON} from './saveframe';
import {Schema} from './schema';
import {DataFileStore} from './dataStore';
import {LoopTag} from './tag';
import {Loop} from './loop';


export class Entry {
  entry_id: string;
  saveframes: Saveframe[];
  schema: Schema;
  categories: string[][];
  enumeration_ties: {};
  source: string;
  dataStore: DataFileStore;
  valid: boolean;

  constructor(data_name: string) {
    this.entry_id = data_name;
    this.saveframes = [];
    this.enumeration_ties = {};
    this.valid = true;

    this.updateCategories();
  }

  toJSON(): {} {
    return {entry_id: this.entry_id, saveframes: this.saveframes};
  }

  /* Return the position of a given saveframe in the saveframe list. */
  sfIndex(saveframe: Saveframe): number {
    return this.saveframes.indexOf(saveframe);
  }

  /* Add a new saveframe to the saveframe list.
     Optionally specify position if not at end. */
  addSaveframe(saveframe: Saveframe, position: number = -1): void {
    if (position < 0) {
      this.saveframes.push(saveframe);
    } else {
      this.saveframes.splice(position, 0, saveframe);
    }

    this.updateCategories();
  }

  removeSaveframe(saveframe: Saveframe): void {
    const index = this.saveframes.indexOf(saveframe, 0);
    if (index > -1) {
       this.saveframes.splice(index, 1);
    }

    this.updateCategories();
  }

  updateCategories(): void {

    this.categories = [];
    const seen = new Set();

    for (const sf of this.saveframes) {
      const pretty_name = sf.schema_values['category_group_view_name'];
      if (!seen.has(sf.category) && ['Y', 'N'].indexOf(sf.display) >= 0) {
        this.categories.push([pretty_name, sf.category, sf.valid, sf.display]);
        seen.add(sf.category);
      }
    }
  }

  print(): string {
    let result = 'data_' + this.entry_id + '\n\n';

    for (const sf of this.saveframes) {
      result += sf.print() + '\n';
    }

    return result;
  }

  getTagValue(fqtn: string, skip: Saveframe = null): string {

    for (const sf of this.saveframes) {
      // Skip checking the saveframe that called us, if one did
      if (sf === skip) { continue; }

      // Ask the saveframe for the tag, return it if found
      const sf_res = sf.getTagValue(fqtn);
      if (sf_res) { return sf_res; }
    }

    return null;
  }

  getSaveframeByName(sf_name: string): Saveframe {
    for (const sf of this.saveframes) {
      if (sf.name === sf_name) {
        return sf;
      }
    }
    return null;
  }

  getSaveframesByCategory(sf_category: string): Saveframe[] {
    const return_list: Saveframe[] = [];
    for (const sf of this.saveframes) {
      if (sf.category.toLowerCase() === sf_category.toLowerCase()) {
        return_list.push(sf);
      }
    }
    return return_list;
  }

  getSaveframesByPrefix(tag_prefix: string): Saveframe[] {
    const return_list: Saveframe[] = [];
    for (const sf of this.saveframes) {
      if (sf.tag_prefix === tag_prefix) {
        return_list.push(sf);
      }
    }
    return return_list;
  }

  refresh(overrides: {}[] = null, category: string = null): void {

    console.time('entry.refresh()');

    // Reset the enumeration ties
    this.enumeration_ties = {};
    // Refresh each saveframe
    for (const sf of this.saveframes) {
      sf.refresh(overrides, category);
    }
    this.updateCategories();
    // Check entry validity
    this.valid = true;
    for (const sf of this.saveframes) {
      if (sf.display === 'Y' && !sf.valid) {
        this.valid = false;
        break;
      }
    }

    console.timeEnd('entry.refresh()');
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
    // TODO: 1) Add the tags in a tag-order agnostic way
    const dfLoop = this.getLoopsByCategory('_Upload_data')[0];
    const newData = [];
    for (let i = 0; i < this.dataStore.dataFiles.length; i++) {
      for (let n = -1; n < this.dataStore.dataFiles[i].control.value.length; n++) {
        let sfCat = null;
        let sfDescription = null;

        // Make sure there is at least an empty record for each file
        if (n === -1) {
          if (this.dataStore.dataFiles[i].control.value.length !== 0) {continue; }
        } else {
          sfCat = this.dataStore.dataFiles[i].control.value[n][0];
          sfDescription = this.dataStore.dataFiles[i].control.value[n][1];
        }
        newData.push([
          new LoopTag('Data_file_ID', String(newData.length + 1), dfLoop),
          new LoopTag('Data_file_name', this.dataStore.dataFiles[i].fileName, dfLoop),
          new LoopTag('Data_file_content_type', sfCat, dfLoop),
          new LoopTag('Data_file_Sf_category', sfDescription, dfLoop),
          new LoopTag('Data_file_syntax', null, dfLoop),
          new LoopTag('Data_file_immutable_flag', null, dfLoop),
          new LoopTag('Sf_ID', null, dfLoop),
          new LoopTag('Entry_ID', this.entry_id, dfLoop),
          new LoopTag('Deposited_data_files_ID', String(i + 1), dfLoop)
        ]);
      }
    }
    if (newData.length) {
      dfLoop.data = newData;
    }

    /*
    Now, update the data types present in the entry_information saveframe
     */
    const infoSaveframe = this.getSaveframesByCategory('entry_interview')[0];

    // Set them all to 'no'
    for (const dropDownItem of this.dataStore.dropDownList) {
      const categoryTag = infoSaveframe.tag_dict['_Entry_interview.' + dropDownItem[2]];
      if (categoryTag) {
        categoryTag.value = 'no';
      }
    }

    // Set the appropriate ones to 'yes'
    for (const dataFile of this.dataStore.dataFiles) {
      for (const dataType of dataFile.control.value) {
        const categoryTag = infoSaveframe.tag_dict['_Entry_interview.' + dataType[2]];
        if (categoryTag) {
          categoryTag.value = 'yes';
        }
      }
    }
  }

  regenerateDataStore(): void {
    const dataStore = new DataFileStore([], this.schema.file_upload_types);
    const dataLoop = this.getLoopsByCategory('_Upload_data')[0];

    function getSelectionByDescription(category: string) {
      if (category === null) {
        return null;
      }
      for (const dropDownItem of dataStore.dropDownList) {
        if (dropDownItem[1] === category) {
          return dropDownItem;
        }
      }
    }

    const dataBuilder = {};
    const nameList = [];
    for (const dataRow of dataLoop.data) {
      if (!dataRow[1].value) {
        continue;
      }
      const sel = getSelectionByDescription(dataRow[3].value);
      if (!dataBuilder[dataRow[1].value]) {
        dataBuilder[dataRow[1].value] = [];
        nameList.push(dataRow[1].value);
      }
      if (sel) {
        dataBuilder[dataRow[1].value].push(sel);
      }
    }

    for (const name of nameList) {
      dataStore.addFile(name, dataBuilder[name]).percent = 100;
    }

    this.dataStore = dataStore;
  }

}

export function entryFromJSON(jdata: Object): Entry {
  const entry = new Entry(jdata['entry_id']);
  entry.schema = new Schema(jdata['schema']);

  for (const saveframeJSON of jdata['saveframes']) {
    const new_frame = saveframeFromJSON(saveframeJSON, entry);
    entry.addSaveframe(new_frame);
  }

  entry.regenerateDataStore(); // This must come before the refresh, because the tags require knowing what data files are available
  entry.refresh();
  return entry;
}
