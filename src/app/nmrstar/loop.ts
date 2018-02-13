import { cleanValue } from './nmrstar';

export class Loop {
  category: string;
  tags: string[];
  data: string[][];
  data_in_column: boolean[];

  constructor (category: string, tags: string[], data: string[][] = []) {
    this.category = category;
    this.tags = tags;
    this.data_in_column = [];

    // Turn text nulls into logical nulls
    for (let m = 0; m < data.length; m++) {
      for (let n = 0; n < data[m].length; n++) {
        if (data[m][n] === '.' || data[m][n] === '?') {
          data[m][n] = null;
        }
      }
    }
    this.data = data;

    // Check for rows of null data
    this.checkNull();
  }

  checkNull() {
    // Go through the columns
    for (let x = 0; x < this.tags.length; x++) {
      this.data_in_column[x] = false;

      // Check the data for a given column
      for (let n = 0; n < this.data.length; n++) {
        if (!(['.', '?', '', null].indexOf(this.data[n][x]) >= 0)) {
          this.data_in_column[x] = true;
          break;
        }
      }
    }
  }

  print(): string {

    const parent = this;
    // Check for empty loops
    if (this.data.length === 0) {
        if (this.tags.length === 0) {
            return '\n   loop_\n\n   stop_\n';
        }
    }

    // Can't print data without columns
    if (this.tags.length === 0) {
        throw new Error(sprintf('Impossible to print data if there are no associated tags. Loop: \'%s\'.', parent.category));
    }

    // Make sure that if there is data, it is the same width as the column tags
    if (this.data.length > 0) {
        for (let n = 0; n < this.data.length; n++) {
            if (this.tags.length !== this.data[n].length) {
                throw new Error(sprintf('The number of column tags must match width of the data.\
 Row: %d Loop: \'%s\'.', n, parent.category));
            }
        }
    }

    // Start the loop
    let ret_string = '\n   loop_\n';
    // Print the columns
    const pstring = '      %-s\n';

    // Check to make sure our category is set
    if (this.category === undefined) {
        throw new Error('The category was never set for this loop. Either add a column \
        with the category intact, specify it when generating the loop, or set it using setCategory.');
    }

    // Print the categories
    const loop_category = this.category;
    for (const column of this.tags) {
        ret_string += sprintf(pstring, loop_category + '.' + column);
    }

    ret_string += '\n';

    // If there is data to print, print it
    if (this.data.length !== 0) {

      const widths = Array(this.data[0].length).fill(3);

      // Figure out the maximum row lengths
      for (const row of this.data) {
        for (let n = 0; n < row.length; n++) {
          // Don't count data that goes on its own line
          if (row[n] && row[n].indexOf('\n') !== -1) {
            continue;
          }
          if (row[n] && row[n].length + 3 > widths[n]) {
              widths[n] = row[n].length + 3;
          }
        }
      }

      // Go through and print the data
      for (const row of this.data) {

        // Each row starts with whitespace
        ret_string += '     ';

        // Get the data ready for printing
        for (let n = 0; n < row.length; n++) {

            let datum_copy = cleanValue(row[n]);
            if (datum_copy.indexOf('\n') !== -1) {
                datum_copy = sprintf('\n;\n%s;\n', datum_copy);
            }

            // Add the data to the return string
            ret_string += sprintf('%-' + widths[n] + 's', datum_copy);
        }

        // End the row
        ret_string += ' \n';
      }
    }

    // Close the loop
    ret_string += '\n   stop_\n';
    return ret_string;
  }
}
