import {sprintf} from 'sprintf-js';



export function cleanValue(value) {

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

    // Normally we wouldn't autoconvert null values for them but it may be appropriate here
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


