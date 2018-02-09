// import { myJSON } from './demo';

export class Loop {
  category: string = null;
  columns: string[];
  data: string[][];

  constructor (category: string, columns: string[], data: string[][] = []) {
    this.category = category;
    this.columns = columns;
    this.data = data;
  }
}

export class SaveframeTag {
  tag_name: string;
  value: string;

  constructor(tag_name: string, value: string) {
    this.tag_name = tag_name;
    if (value === '.' || value === '?') {
      this.value = null;
    } else {
      this.value = value;
    }
  }
}

export class Saveframe {
  name: string;
  category: string;
  tag_prefix: string;
  tags?: SaveframeTag[];
  loops?: Loop[];

  constructor (name: string, category: string, tag_prefix: string, tag_list: SaveframeTag[] = []) {
    this.name = name;
    this.category = category;
    this.tag_prefix = tag_prefix;
    this.tags = tag_list;
  }

  addTag(name: string, value: string) {
    this.tags.push(new SaveframeTag(name, value));
  }

  addTags(tag_list: string[][]) {
    for (const tag_pair of tag_list) {
      this.addTag(tag_pair[0], tag_pair[1]);
    }
  }

  addLoop(loop: Loop) {
    this.loops.push(loop);
  }
}

export class Entry {
  data_name: string;
  saveframes: Saveframe[];

  constructor(data_name: string) {
    this.data_name = data_name;
  }

  addSaveframe(saveframe: Saveframe) {
    this.saveframes.push(saveframe);
  }
}

export function fromJSON(jdata: Object): Entry {

    const entry = new Entry(jdata['bmrb_id']);

    for (let i = 0; i < jdata['saveframes'].length; i++) {
        const new_frame = new Saveframe(jdata['saveframes'][i]['name'],
                                        jdata['saveframes'][i]['tag_prefix'], jdata['saveframes'][i]['tags']);
        new_frame.category = jdata['saveframes'][i]['category'];
        new_frame.loops = [];
        for (let n = 0; n < jdata['saveframes'][i]['loops'].length; n++) {
            const new_loop = new Loop(jdata['saveframes'][i]['loops'][n]['category'],
                                      jdata['saveframes'][i]['loops'][n]['tags'],
                                      jdata['saveframes'][i]['loops'][n]['data']);
            new_frame.loops.push(new_loop);
        }
        this.saveframes.push(new_frame);
    }

  return entry;
}

