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

  toJSON(key) {
    const cloneObj = { ...this as Entry };

    delete cloneObj.schema;
    return cloneObj;
  }

  /* Return the position of a given saveframe in the saveframe list. */
  sfIndex(saveframe: Saveframe) {
    return this.saveframes.indexOf(saveframe);
  }

  /* Add a new saveframe to the saveframe list.
     Optionally specify position if not at end. */
  addSaveframe(saveframe: Saveframe, position: number = -1) {
    if (position < 0) {
      this.saveframes.push(saveframe);
    } else {
      this.saveframes.splice(position, 0, saveframe);
    }
  }

  removeSaveframe(saveframe: Saveframe) {
    const index = this.saveframes.indexOf(saveframe, 0);
    if (index > -1) {
       this.saveframes.splice(index, 1);
    }
  }

  print(): string {
    let result = 'data_' + this.entry_id + '\n\n';

    for (const sf of this.saveframes) {
      result += sf.print() + '\n';
    }

    return result;
  }

  getTagValue(fqtn: string) {
    const split = fqtn.split('.');
    const category = split[0];
    const tag = split[1];

    for (const sf of this.saveframes) {
      // If the saveframe matches
      if (sf.tag_prefix === category) {
        for (const t of sf.tags) {
          if (t.name === tag) {
            return t.value;
          }
        }

        // Check the loops
        for (const l of sf.loops) {
          if (l.category === category) {
            for (let r = 0; r < l.data.length; r++) {
              for (let c = 0; c < l.data[r].length; c++) {
                if (l.data[r][c].name === tag) {
                  return l.data[r][c].value;
                }
              }
            }
          }
        }

      }
    }

    return null;
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

  refresh() {
    for (const sf of this.saveframes) {
      sf.refresh();
      for (const l of sf.loops) {
        l.refresh();
      }
    }
  }
}

export function entryFromJSON(jdata: Object): Entry {

    const entry = new Entry(jdata['entry_id']);
    entry.schema = new Schema(jdata['schema']);
    console.log('Using schema: ' + entry.schema.version);

    for (let i = 0; i < jdata['saveframes'].length; i++) {
      const new_frame = saveframeFromJSON(jdata['saveframes'][i], entry);
      entry.addSaveframe(new_frame);
    }

  entry.refresh();
  return entry;
}
