import { Saveframe, saveframeFromJSON } from './saveframe';
import { Schema } from './schema';

export class Entry {
  entry_id: string;
  saveframes: Saveframe[];
  schema: Schema;

  constructor(data_name: string, saveframes: Saveframe[] = []) {
    this.entry_id = data_name;
    this.saveframes = [];
  }

  addSaveframe(saveframe: Saveframe) {
    this.saveframes.push(saveframe);
  }

  print(): string {
    let result = 'data_' + this.entry_id + '\n\n';

    for (const sf of this.saveframes) {
      result += sf.print() + '\n';
    }

    return result;
  }

  getSaveframeByName(sf_name: string): Saveframe {
    for (const sf of this.saveframes) {
      if (sf.name === sf_name) {
        return sf;
      }
    }
    throw new Error('No saveframe with the name ' + sf_name + ' found.');
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

}

export function entryFromJSON(jdata: Object): Entry {

    const entry = new Entry(jdata['entry_id']);
    entry.schema = new Schema(jdata['schema']);
    console.log(entry.schema);
    console.log('Using schema: ' + entry.schema.version);

    for (let i = 0; i < jdata['saveframes'].length; i++) {
      const new_frame = saveframeFromJSON(jdata['saveframes'][i], entry);
      new_frame.updateTags();
      entry.addSaveframe(new_frame);
    }

  return entry;
}
