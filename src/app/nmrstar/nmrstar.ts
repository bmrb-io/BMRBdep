import {sprintf} from 'sprintf-js';
import {nullTags} from './definitions';

export function cleanValue(value): string {

  if (checkValueIsNull(value)) {
    return '.';
  }

  // Values that go on their own line don't need to be touched
  if (value.indexOf('\n') !== -1) {
    if (value.substring(value.length - 1) !== '\n') {
      return value + '\n';
    } else {
      return value;
    }
  }

  if ((value.indexOf('"') !== -1) && (value.indexOf('\'') !== -1)) {
    return sprintf('%s\n', value);
  }

  if ((value.indexOf(' ') !== -1) || (value.indexOf('\t') !== -1) ||
    (value.indexOf('#') !== -1) || (value.startsWith('_')) ||
    ((value.length > 4) && (value.startsWith('data_')) ||
      (value.startsWith('save_')) || (value.startsWith('loop_')) || (value.startsWith('stop_')))) {

    if (value.indexOf('"') !== -1) {
      return sprintf('\'%s\'', value);
    } else if (value.indexOf('\'') !== -1) {
      return sprintf('"%s"', value);
    } else {
      return sprintf('\'%s\'', value);
    }
  }

  return value;
}

export function checkValueIsNull(value) {
  return nullTags.indexOf(value) >= 0;
}

export function checkTagIsRequired(tag) {
  const alwaysDisplay = ['sf_framecode', 'entry_id', 'id', 'sf_category', 'name'];
  return alwaysDisplay.indexOf(tag.name.toLowerCase()) >= 0;
}

export function download(filename, printableObject): void {
  const element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(printableObject.print()));
  element.setAttribute('download', filename);
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}
