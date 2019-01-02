import {sprintf} from 'sprintf-js';


/* Automatically quotes the value in the appropriate way. Don't quote
   values you send to this method or they will show up in another set
   of quotes as part of the actual data. E.g.:

cleanValue('"e. coli"') returns '\'"e. coli"\''

while

cleanValue("e. coli") returns "'e. coli'"

This will automatically be called on all values when you use a str()
method (so don't call it before inserting values into tags or loops).

Be mindful of the value of str_conversion_dict as it will effect the
way the value is converted to a string.*/
export function cleanValue(value): string {

  if (value == null) {
    return '.';
  }

  // If the user inserts a newline in the web editor replace it with a newline
  value = value.replace(/<br>/g, '\n');
  value = value.replace(/⏎/g, '\n');

  // Values that go on their own line don't need to be touched
  if (value.indexOf('\n') !== -1) {
    if (value.substring(value.length - 1) !== '\n') {
      return value + '\n';
    } else {
      return value;
    }
  }

  // No empty values
  if (value === undefined) {
    throw new Error('Empty strings are not allowed as values. Use a \'.\' or a \'?\' if needed.');
  }

  // Normally we wouldn't auto-convert null values for them but it may be appropriate here
  if (value === '') {
    value = '.';
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

export function download(filename, printableObject): void {
  const element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(printableObject.print()));
  element.setAttribute('download', filename);
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}
