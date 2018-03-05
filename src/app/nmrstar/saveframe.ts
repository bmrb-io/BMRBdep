import { Entry } from './entry';
import { Loop } from './loop';
import { cleanValue } from './nmrstar';
import { Schema } from './schema';
import { SaveframeTag } from './tag';

function deepCopy(obj) {
  let copy;

  // Handle the 3 simple types, and null or undefined
  if (null === obj || 'object' !== typeof obj) {
    return obj;
  }

  // Handle Date
  if (obj instanceof Date) {
    copy = new Date();
    copy.setTime(obj.getTime());
    return copy;
  }

  // Handle Array
  if (obj instanceof Array) {
    copy = [];
    for (let i = 0, len = obj.length; i < len; i++) {
      copy[i] = deepCopy(obj[i]);
    }
    return copy;
  }

  if (typeof(obj) === 'function') {
    return obj;
  }

  // Handle Object
  if (obj instanceof Object) {
    copy = {};
    for (const attr in obj) {
      if (obj.hasOwnProperty(attr)) {
        if (attr !== 'parent') {
          copy[attr] = deepCopy(obj[attr]);
        }
      }
    }
    return copy;
  }

  throw new Error('Unable to copy obj! Its type isn\'t supported.');
}


export class Saveframe {
  name: string;
  category: string;
  tag_prefix: string;
  tags: SaveframeTag[];
  loops: Loop[];
  parent: Entry;

  constructor (name: string,
               category: string,
               tag_prefix: string,
               parent: Entry,
               tags: SaveframeTag[] = [],
               loops: Loop[] = []) {
    this.name = name;
    this.category = category;
    this.tag_prefix = tag_prefix;
    this.tags = tags;
    this.loops = loops;
    this.parent = parent;
  }

  duplicate(clear_values: boolean = false) {
    const next_this_type = this.parent.getSaveframesByCategory(this.category).length + 1;
    const new_frame = new Saveframe(this.name + '_' + next_this_type, this.category, this.tag_prefix, this.parent);

    // Copy the tags
    const tag_copy: SaveframeTag[] = [];
    for (const tag of this.tags) {
      if (clear_values) {
        tag_copy.push(new SaveframeTag(tag.name, null, new_frame));
      } else {
        tag_copy.push(new SaveframeTag(tag.name, tag.value, new_frame));
      }
    }
    new_frame.tags = tag_copy;

    // Copy the loops
    const loop_copy: Loop[] = [];
    for (const loop of this.loops) {
      loop_copy.push(loop.duplicate(clear_values));
    }
    new_frame.loops = loop_copy;

    const my_pos = this.parent.saveframes.indexOf(this);
    this.parent.addSaveframe(new_frame, my_pos + 1);
  }

  toJSON(key) {
    // Clone object to prevent accidentally performing modification on the original object
    const cloneObj = { ...this as Saveframe };
    delete cloneObj.parent;

    return cloneObj;
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
      if (tag.name.length > width) {
          width = tag.name.length;
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
          ret_string +=  sprintf(pstring, tag_prefix + '.' + tag.name, cleaned_tag);
      } else {
          ret_string +=  sprintf(mstring, tag_prefix + '.' + tag.name, cleaned_tag);
      }
    }

    for (const loop of this.loops) {
        ret_string += loop.print();
    }

    return ret_string + 'save_\n';
  }

}

export function saveframeFromJSON(jdata: Object, parent: Entry): Saveframe {
  const test: Saveframe = new Saveframe(jdata['name'],
                                        jdata['category'],
                                        jdata['tag_prefix'],
                                        parent);
  test.addTags(jdata['tags']);
  for (const l of jdata['loops']) {
    const new_loop = new Loop(l['category'], l['tags'], l['data'], test);
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
