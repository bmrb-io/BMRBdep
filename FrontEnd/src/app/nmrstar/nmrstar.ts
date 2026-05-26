import {nullTags} from './definitions';
import {Entry} from './entry';

export function cleanValue(rawValue: string | null | undefined): string {

  if (checkValueIsNull(rawValue)) {
    return '.';
  }

  const value: string = rawValue as string;

  // Values that go on their own line don't need to be touched
  if (value.indexOf('\n') !== -1) {
    if (value.substring(value.length - 1) !== '\n') {
      return value + '\n';
    } else {
      return value;
    }
  }

  if ((value.indexOf('"') !== -1) && (value.indexOf('\'') !== -1)) {
    return `${value}\n`;
  }

  if ((value.indexOf(' ') !== -1) || (value.indexOf('\t') !== -1) ||
    (value.indexOf('#') !== -1) || (value.startsWith('_')) ||
    ((value.length > 4) && (value.startsWith('data_')) ||
      (value.startsWith('save_')) || (value.startsWith('loop_')) || (value.startsWith('stop_')))) {

    if (value.indexOf('"') !== -1) {
      return `'${value}'`;
    } else if (value.indexOf('\'') !== -1) {
      return `"${value}"`;
    } else {
      return `'${value}'`;
    }
  }

  // Quote if necessary
  if (value[0] === '\'') {
    return '"' + value + '"';
  }
  if (value[0] === '"') {
    return '\'' + value + '\'';
  }

  return value;
}

export function checkValueIsNull(value: unknown): boolean {
  return nullTags.indexOf(value as null | string | undefined) >= 0;
}

export function checkTagIsRequired(tag: { name: string }): boolean {
  const alwaysDisplay = ['sf_framecode', 'entry_id', 'id', 'sf_category', 'name'];
  return alwaysDisplay.indexOf(tag.name.toLowerCase()) >= 0;
}

export function download(filename: string, printableObject: Entry): void {
  const element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(printableObject.print()));
  element.setAttribute('download', filename);
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

export function isMixedCase(str: string): boolean {
  return str.toUpperCase() !== str && str.toLowerCase() !== str;
}
