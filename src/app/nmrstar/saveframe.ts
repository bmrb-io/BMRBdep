import { Loop } from './loop';
import { cleanValue } from './nmrstar';

export class SaveframeTag {
  tag_name: string;
  value: string;

  constructor(tag_name: string, value: string) {
    this.tag_name = tag_name;
    if (['.', '?', '', null].indexOf(value) >= 0) {
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

  constructor (name: string, category: string, tag_prefix: string, tag_list: SaveframeTag[] = [], loops: Loop[] = []) {
    this.name = name;
    this.category = category;
    this.tag_prefix = tag_prefix;
    this.tags = tag_list;
    this.loops = loops;
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
}

export function saveframeFromJSON(jdata: Object): Saveframe {
  const test: Saveframe = new Saveframe(jdata['name'],
                                        jdata['category'],
                                        jdata['tag_prefix']);
  test.addTags(jdata['tags']);
  for (const l of jdata['loops']) {
    const new_loop = new Loop(l['category'], l['tags'], l['data']);
    test.addLoop(new_loop);
  }
  return test;
}
