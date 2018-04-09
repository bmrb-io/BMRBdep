import { Entry } from './entry';
import { Loop } from './loop';
import { cleanValue } from './nmrstar';
import { Schema } from './schema';
import { SaveframeTag } from './tag';

export class Saveframe {
  name: string;
  category: string;
  tag_prefix: string;
  tags: SaveframeTag[];
  loops: Loop[];
  parent: Entry;
  display = 'H';

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
      let val = clear_values ? null : tag.value;
      if (!clear_values && tag.name === 'Sf_framecode') {
        val = new_frame.name;
      }
      tag_copy.push(new SaveframeTag(tag.name, val, new_frame));
    }
    new_frame.tags = tag_copy;

    // Copy the loops
    for (const loop of this.loops) {
      const nl = loop.duplicate(clear_values);
      new_frame.addLoop(nl);
    }

    new_frame.refresh();
    const my_pos = this.parent.saveframes.indexOf(this);
    this.parent.addSaveframe(new_frame, my_pos + 1);
  }

  toJSON(key) {
    // Clone object to prevent accidentally performing modification on the original object
    const cloneObj = { ...this as Saveframe };
    delete cloneObj.parent;
    delete cloneObj.display;

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

  /*
   * Attempts to locate the tag within the saveframe. If not found, calls up
   * to the Entry to locate the first instance of it.
   * @param fqtn The fully qualified tag name.
   * @returns    The value of the queried tag, or null if not found
   */
  getTagValue(fqtn: string, full_entry: boolean = false): string {
    const split = fqtn.split('.');
    const category = split[0];
    const tag = split[1];

    if (this.tag_prefix === category) {
      for (const t of this.tags) {
        if (t.name === tag) {
          return t.value;
        }
      }
    }

    // Ask the parent entry to search the other saveframes if this is a full search
    // (The parent entry may call this method on us, in which case don't make an
    // infinite recursion)
    if (full_entry) {
      return this.parent.getTagValue(fqtn, this);
    } else {
      return null;
    }
  }

  getSaveframesByPrefix(tag_prefix: string): Saveframe[] {
    return this.parent.getSaveframesByPrefix(tag_prefix);
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

  refresh(): void {
    const fc_name = this.getTagValue(this.tag_prefix + '.Sf_framecode');
    if (fc_name) {
      this.name = fc_name;
    }

    // Update the tags and the loops
    for (const tag of this.tags) {
      tag.updateTagStatus();
    }
    for (const l of this.loops) {
      l.refresh();
    }

     // Update whether this saveframe has anything to display
    this.display = 'H';
    for (const tag of this.tags) {
      if (['Y', 'N'].indexOf(tag.display) >= 0) {
        if (this.display === 'N') {
          if (tag.display === 'Y') {
            this.display = 'Y';
          }
        }
        if (this.display === 'H') {
          this.display = tag.display;
        }
      }
    }
    for (const loop of this.loops) {
      if (['Y', 'N'].indexOf(loop.display) >= 0) {
        if (this.display === 'N') {
          if (loop.display === 'Y') {
            this.display = 'Y';
          }
        }
        if (this.display === 'H') {
          this.display = loop.display;
        }
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
      const cleaned_tag = cleanValue(tag.value);

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
