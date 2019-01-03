import {Entry} from './entry';
import {Loop} from './loop';
import {cleanValue} from './nmrstar';
import {SaveframeTag, Tag} from './tag';
import {sprintf} from 'sprintf-js';

export function saveframeFromJSON(jdata: Object, parent: Entry): Saveframe {
  const test: Saveframe = new Saveframe(jdata['name'], jdata['category'], jdata['tag_prefix'], parent);
  test.addTags(jdata['tags']);
  for (const loopJSON of jdata['loops']) {
    const newLoop = new Loop(loopJSON['category'], loopJSON['tags'], loopJSON['data'], test);
    test.addLoop(newLoop);
  }
  return test;
}

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

  constructor(name: string, category: string, tagPrefix: string, parent: Entry, tags: SaveframeTag[] = [], loops: Loop[] = []) {
    this.name = name;
    this.category = category;
    this.tagPrefix = tagPrefix;
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

  duplicate(clearValues: boolean = false): Saveframe {
    let frameIndex = this.parent.getSaveframesByCategory(this.category).length + 1;
    let frameName = this.category + '_' + frameIndex;
    while (this.parent.getSaveframeByName(frameName)) {
      frameIndex += 1;
      frameName = this.category + '_' + frameIndex;
    }

    const newFrame = new Saveframe(frameName, this.category, this.tagPrefix, this.parent);

    // Copy the tags
    for (const tag of this.tags) {
      if (clearValues) {
        newFrame.addTag(tag.name, null);
      } else {
        newFrame.addTag(tag.name, tag.value);
      }
    }
    // Set the framecode and category regardless of clearValues argument
    newFrame.tagDict[this.tagPrefix + '.Sf_framecode'].value = frameName;
    newFrame.tagDict[this.tagPrefix + '.Sf_category'].value = this.category;

    // Copy the loops
    for (const loop of this.loops) {
      const nl = loop.duplicate(clearValues);
      newFrame.addLoop(nl);
    }

    newFrame.refresh();
    const myPosition = this.parent.saveframes.indexOf(this);
    this.parent.addSaveframe(newFrame, myPosition + 1);

    // The work is already done, as the new saveframe is inserted, but return it for reference
    return newFrame;
  }

  toJSON(): {} {
    return {category: this.category, name: this.name, tag_prefix: this.tagPrefix, tags: this.tags, loops: this.loops};
  }

  addTag(name: string, value: string): void {
    const newTag = new SaveframeTag(name, value, this);
    this.tags.push(newTag);
    this.tagDict[newTag.fullyQualifiedTagName] = newTag;
  }

  addTags(tagList: string[][]): void {
    for (const tagPair of tagList) {
      if (tagPair[0]) {
        this.addTag(tagPair[0], tagPair[1]);
      } else {
        this.addTag(tagPair['name'], tagPair['value']);
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
  getTagValue(fqtn: string, fullEntry: boolean = false): string {
    if (fqtn in this.tagDict) {
      return this.tagDict[fqtn].value;
    }

    // Ask the parent entry to search the other saveframes if this is a full search
    // (The parent entry may call this method on us, in which case don't make an
    // infinite recursion)
    if (fullEntry) {
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

  getLoopByPrefix(tagPrefix): Loop {
    for (const loop of this.loops) {
      if (loop.category === tagPrefix) {
        return loop;
      }
    }
    return null;
  }

  getID(): string {
    let entryIDTag = 'Entry_ID';
    if (this.category === 'entry_information') {
      entryIDTag = 'ID';
    }
    for (const tag of this.tags) {
      if (tag['name'] === entryIDTag) {
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

    // Apply the special rules
    this.specialRules();

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
    let returnString = sprintf('save_%s\n', this.name);
    const standardFormatString = sprintf('   %%-%ds  %%s\n', width);
    const multiLineFormatString = sprintf('   %%-%ds\n;\n%%s;\n', width);

    for (const tag of this.tags) {
      const cleanedTag = cleanValue(tag.value);

      if (cleanedTag.indexOf('\n') === -1) {
        returnString += sprintf(standardFormatString, this.tagPrefix + '.' + tag.name, cleanedTag);
      } else {
        returnString += sprintf(multiLineFormatString, this.tagPrefix + '.' + tag.name, cleanedTag);
      }
    }

    for (const loop of this.loops) {
      returnString += loop.print();
    }

    return returnString + 'save_\n';
  }

  /* Special rules that aren't in the dictionary */
  specialRules(): void {

    // Check that at least one chemical shift reference is present
    if (this.category === 'chem_shift_reference') {
      let allNo = true;
      const tagsToCheck = ['_Chem_shift_reference.Proton_shifts_flag',
        '_Chem_shift_reference.Carbon_shifts_flag',
        '_Chem_shift_reference.Nitrogen_shifts_flag',
        '_Chem_shift_reference.Phosphorus_shifts_flag',
        '_Chem_shift_reference.Other_shifts_flag'
      ];
      for (const tag of tagsToCheck) {
        if (this.tagDict[tag].value !== 'no') {
          allNo = false;
          break;
        }
      }
      if (allNo) {
        for (const tag of tagsToCheck) {
          this.tagDict[tag].valid = false;
          this.tagDict[tag].validationMessage = 'At least one chemical shift reference must be given.';
        }
      }
    }
  }
}
