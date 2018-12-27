import {Entry} from './entry';
import {Loop} from './loop';
import {cleanValue} from './nmrstar';
import {SaveframeTag, Tag} from './tag';
import {sprintf} from 'sprintf-js';

export class Saveframe {
  name: string;
  category: string;
  tagPrefix: string;
  tags: SaveframeTag[];
  loops: Loop[];
  parent: Entry;
  display: string;
  valid: boolean;
  tagDict: {};
  schemaValues: {};
  index: number;
  nextCategory: string;
  previousCategory: string;

  constructor(name: string, category: string, tag_prefix: string, parent: Entry, tags: SaveframeTag[] = [], loops: Loop[] = []) {
    this.name = name;
    this.category = category;
    this.tagPrefix = tag_prefix;
    this.tags = tags;
    this.loops = loops;
    this.parent = parent;
    this.tagDict = {};
    this.display = 'H';
    this.valid = true;
    this.index = 0;
    this.nextCategory = null;
    this.previousCategory = null;
    if (this.parent.schema) {
      this.schemaValues = this.parent.schema.saveframeSchema[this.category];
    }

    for (const tag of this.tags) {
      this.tagDict[tag.fullyQualifiedTagName] = tag;
    }
  }

  log() {
    console.log(this);
  }

  duplicate(clear_values: boolean = false): Saveframe {
    let frameIndex = this.parent.getSaveframesByCategory(this.category).length + 1;
    let frameName = this.category + '_' + frameIndex;
    while (this.parent.getSaveframeByName(frameName)) {
      frameIndex += 1;
      frameName = this.category + '_' + frameIndex;
    }

    const new_frame = new Saveframe(frameName, this.category, this.tagPrefix, this.parent);

    // Copy the tags
    for (const tag of this.tags) {
      if (clear_values) {
        new_frame.addTag(tag.name, null);
      } else {
        new_frame.addTag(tag.name, tag.value);
      }
    }
    // Set the framecode and category regardless of clear_values argument
    new_frame.tagDict[this.tagPrefix + '.Sf_framecode'].value = frameName;
    new_frame.tagDict[this.tagPrefix + '.Sf_category'].value = this.category;

    // Copy the loops
    for (const loop of this.loops) {
      const nl = loop.duplicate(clear_values);
      new_frame.addLoop(nl);
    }

    new_frame.refresh();
    const my_pos = this.parent.saveframes.indexOf(this);
    this.parent.addSaveframe(new_frame, my_pos + 1);

    // The work is already done, as the new saveframe is inserted, but return it for reference
    return new_frame;
  }

  toJSON(): {} {
    return {category: this.category, name: this.name, tag_prefix: this.tagPrefix, tags: this.tags, loops: this.loops};
  }

  addTag(name: string, value: string): void {
    const new_tag = new SaveframeTag(name, value, this);
    this.tags.push(new_tag);
    this.tagDict[new_tag.fullyQualifiedTagName] = new_tag;
  }

  addTags(tag_list: string[][]): void {
    for (const tag_pair of tag_list) {
      if (tag_pair[0]) {
        this.addTag(tag_pair[0], tag_pair[1]);
      } else {
        this.addTag(tag_pair['name'], tag_pair['value']);
      }
    }
  }

  addLoop(loop: Loop): void {
    this.loops.push(loop);
  }

  /*
   * Attempts to locate the tag within the saveframe. If not found, calls up
   * to the Entry to locate the first instance of it.
   * @param fqtn The fully qualified tag name.
   * @returns    The value of the queried tag, or null if not found
   */
  getTagValue(fqtn: string, full_entry: boolean = false): string {
    if (fqtn in this.tagDict) {
      return this.tagDict[fqtn].value;
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

  getTag(fqtn: string): SaveframeTag {
    if (fqtn in this.tagDict) {
      return this.tagDict[fqtn];
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

  // Sets the visibility of all tags in the saveframe
  setVisibility(rule): void {

    // Make sure this is a rule for the saveframe and not a rule for a child loop
    if (rule['Tag category'] === '*' || rule['Tag category'] === this.tagPrefix) {

      // If the rule applies to all tags in this saveframe
      if (rule['Tag'] === '*') {
        for (const tag of this.tags) {
          if (rule['Override view value'] === 'O') {
            tag.display = tag.schemaValues['User full view'];
          } else {
            tag.display = rule['Override view value'];
          }
        }
      } else {
        if (rule['Override view value'] === 'O') {
          this.tagDict[rule['Tag']].display = this.tagDict[rule['Tag']].schemaValues['User full view'];
        } else {
          this.tagDict[rule['Tag']].display = rule['Override view value'];
        }
      }
    }

    // Now set the visibility for the child loops
    for (const loop of this.loops) {
      if (rule['Tag category'] === '*' || rule['Tag category'] === loop.category) {
        loop.setVisibility(rule);
      }
    }
  }

  refresh(): void {
    // Get the SF name from the framecode tag
    const framecodeTag: SaveframeTag = this.tagDict[this.tagPrefix + '.Sf_framecode'];
    if (framecodeTag.value) {
      // Strip whitespace from the tag
      framecodeTag.value = framecodeTag.value.replace(/[\s+]/g, '_');
      this.name = framecodeTag.value;
    }

    // Get the category number for this SF
    this.index = this.parent.getSaveframesByCategory(this.category).indexOf(this);


    // Update the tags
    for (const tag of this.tags) {
      tag.updateTagStatus();
    }
    for (const loop of this.loops) {
      loop.refresh();
    }

    // Update whether this saveframe has anything to display and is complete
    this.display = 'H';
    for (const tag of this.tags) {
      if (tag.display === 'Y') {
        this.display = 'Y';
        break;
      }
      if (this.display === 'H') {
        this.display = tag.display;
      }
    }
    for (const loop of this.loops) {
      if (loop.display === 'Y') {
        this.display = 'Y';
        break;
      }
      if (this.display === 'H') {
        this.display = loop.display;
      }
    }

    // Update the validity value
    this.valid = true;
    for (const tag of this.tags) {
      if (tag.display === 'Y' && !tag.valid) {
        this.valid = false;
        break;
      }
    }
    if (this.valid) {
      for (const loop of this.loops) {
        if (loop.display === 'Y' && !loop.valid) {
          this.valid = false;
          break;
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
    width += this.tagPrefix.length + 2;

    // Print the saveframe
    let ret_string = sprintf('save_%s\n', this.name);
    const pstring = sprintf('   %%-%ds  %%s\n', width);
    const mstring = sprintf('   %%-%ds\n;\n%%s;\n', width);

    const tag_prefix = this.tagPrefix;

    for (const tag of this.tags) {
      const cleaned_tag = cleanValue(tag.value);

      if (cleaned_tag.indexOf('\n') === -1) {
        ret_string += sprintf(pstring, tag_prefix + '.' + tag.name, cleaned_tag);
      } else {
        ret_string += sprintf(mstring, tag_prefix + '.' + tag.name, cleaned_tag);
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
  for (const loopJSON of jdata['loops']) {
    const newLoop = new Loop(loopJSON['category'], loopJSON['tags'], loopJSON['data'], test);
    test.addLoop(newLoop);
  }
  return test;
}
