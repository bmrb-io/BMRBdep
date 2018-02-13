import { Saveframe, saveframeFromJSON } from './saveframe';

export class Entry {
  data_name: string;
  saveframes: Saveframe[];

  constructor(data_name: string, saveframes: Saveframe[] = []) {
    this.data_name = data_name;
    this.saveframes = [];
  }

  addSaveframe(saveframe: Saveframe) {
    this.saveframes.push(saveframe);
  }

  print(): string {
    let result = 'data_' + this.data_name + '\n\n';

    for (const sf of this.saveframes) {
      result += sf.print() + '\n';
    }

    return result;
  }
}

export function entryFromJSON(jdata: Object): Entry {

    const entry = new Entry(jdata['entry_id']);

    for (let i = 0; i < jdata['saveframes'].length; i++) {
      const new_frame = saveframeFromJSON(jdata['saveframes'][i]);
      entry.addSaveframe(new_frame);
    }

  return entry;
}
