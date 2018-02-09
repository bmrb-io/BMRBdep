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
            const new_loop = new Loop();
            new_loop.columns = jdata['saveframes'][i]['loops'][n]['tags'];
            new_loop.data = jdata['saveframes'][i]['loops'][n]['data'];
            new_loop.category = jdata['saveframes'][i]['loops'][n]['category'];
            new_frame.loops.push(new_loop);
        }
        this.saveframes.push(new_frame);
    }

  return entry;
}

const tags: SaveframeTag[] = [new SaveframeTag('Sf_category', 'entry_information'),
new SaveframeTag('Sf_framecode', 'entry_information'),
new SaveframeTag('ID', '15000'),
new SaveframeTag('Title', 'Solution structure of chicken villin headpiece subdomain \
containing a fluorinated side chain in the core\\n'),
new SaveframeTag('Type', 'macromolecule'),
new SaveframeTag('Version_type', 'original'),
new SaveframeTag('Submission_date', '2006-09-07'),
new SaveframeTag('Accession_date', '2006-09-07'),
new SaveframeTag('Last_release_date', null),
new SaveframeTag('Original_release_date', null),
new SaveframeTag('Origination', 'author'),
new SaveframeTag('NMR_STAR_version', '3.1.1.61'),
new SaveframeTag('Original_NMR_STAR_version', null),
new SaveframeTag('Experimental_method', 'NMR'),
new SaveframeTag('Experimental_method_subtype', 'solution'),
new SaveframeTag('Details', null),
new SaveframeTag('BMRB_internal_directory_name', null)];

export const DEMO: Saveframe = new Saveframe('entry_information', 'entry_information', '_Entry', tags);


