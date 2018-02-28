import { Entry } from './entry';
import { Loop } from './loop';
import { cleanValue } from './nmrstar';
import { Schema } from './schema';

export class SaveframeTag {
  name: string;
  value: string;
  parent: Saveframe;
  valid: boolean;
  schema_values: {};
  fqtn: string;
  enums: string[];

  constructor(name: string, value: string, parent: Saveframe) {
    this.name = name;
    if (['.', '?', '', null].indexOf(value) >= 0) {
      this.value = null;
    } else {
      this.value = value;
    }
    this.parent = parent;
    this.valid = true;
    this.schema_values = {};
    this.fqtn = parent.tag_prefix + '.' + name;
    this.enums = [];
  }

  updateTagStatus(tag_prefix) {
    this.fqtn = tag_prefix + '.' + this.name;
    this.valid = this.parent.parent.schema.checkDatatype(this.fqtn, this.value);
    this.schema_values = this.parent.parent.schema.getTag(this.fqtn);
    this.enums = this.parent.parent.enumerations[this.fqtn];
  }

}

export class Saveframe {
  name: string;
  category: string;
  tag_prefix: string;
  tags: SaveframeTag[];
  loops: Loop[];
  parent: Entry;

  constructor (name: string, category: string, tag_prefix: string, parent: Entry) {
    this.name = name;
    this.category = category;
    this.tag_prefix = tag_prefix;
    this.tags = [];
    this.loops = [];
    this.parent = parent;
  }

  lt() {
    return this.tag_prefix + '.' + this.tags[0].name;
  }

  addTag(name: string, value: string) {
    this.tags.push(new SaveframeTag(name, value, this));
  }

  addTags(tag_list: string[][]) {
    for (const tag_pair of tag_list) {
      if (tag_pair[0]) {
        this.addTag(tag_pair[0], tag_pair[1]);
      } else {
        this.addTag(tag_pair['name'], tag_pair['value']);
      }
    }
  }

  addLoop(loop: Loop) {
    this.loops.push(loop);
  }

  getID(): string {
    let entry_id_tag = 'Entry_ID';
    if (this.category === 'entry_information') {
      entry_id_tag = 'ID';
    }
    for (const tag of this.tags) {
      if (tag['name'] === entry_id_tag) {
        return tag['value'];
      }
    }
  }

  print(): string {
    let width = 0;

    for (const tag of this.tags) {
      if (tag['tag_name'].length > width) {
          width = tag['tag_name'].length;
      }
    }
    width += this.tag_prefix.length + 2;

    // Print the saveframe
    let ret_string = sprintf('save_%s\n', this.name);
    const pstring = sprintf('   %%-%ds  %%s\n', width);
    const mstring = sprintf('   %%-%ds\n;\n%%s;\n', width);

    const tag_prefix = this.tag_prefix;

    for (const tag of this.tags) {
      const cleaned_tag = cleanValue(tag['value']);

      if (cleaned_tag.indexOf('\n') === -1) {
          ret_string +=  sprintf(pstring, tag_prefix + '.' + tag['tag_name'], cleaned_tag);
      } else {
          ret_string +=  sprintf(mstring, tag_prefix + '.' + tag['tag_name'], cleaned_tag);
      }
    }

    for (const loop of this.loops) {
        ret_string += loop.print();
    }

    return ret_string + 'save_\n';
  }

   updateTags(schema) {
     for (const tag of this.tags) {
       tag.updateTagStatus(this.tag_prefix);
     }
   }
}

export function saveframeFromJSON(jdata: Object, parent: Entry): Saveframe {
  const test: Saveframe = new Saveframe(jdata['name'],
                                        jdata['category'],
                                        jdata['tag_prefix'],
                                        parent);
  test.addTags(jdata['tags']);
  for (const l of jdata['loops']) {
    const new_loop = new Loop(l['category'], l['tags'], l['data']);
    test.addLoop(new_loop);
  }
  return test;
}
/* probably obsolete but kept for now for reference
export function saveframesFromJSON(jdata: Object[]): Saveframe[] {
  const saveframes = [];

  for (const sf_json of jdata) {
    saveframes.push(saveframeFromJSON(sf_json));
  }
  return saveframes;
}

*/
