import { cleanValue } from './nmrstar';
import { Saveframe } from './saveframe';
import { LoopTag } from './tag';

export class Loop {
  category: string;
  tags: string[];
  data: LoopTag[][];
  parent: Saveframe;
  data_in_column: boolean[];
  schema_values: {}[];
  display: string;

  toJSON(key) {
    // Clone object to prevent accidentally performing modification on the original object
    const cloneObj = { ...this as Loop };
    delete cloneObj.parent;
    delete cloneObj.schema_values;
    delete cloneObj.data_in_column;
    delete cloneObj.display;

    // Turn the loop tags into a simple array of values
    const reduced_data = [];
    for (let r = 0; r < this.data.length; r++) {
      const row = [];
      for (let c = 0; c < this.data[r].length; c++) {
        row.push(this.data[r][c].value);
      }
      reduced_data.push(row);
    }
    cloneObj.data = reduced_data;

    return cloneObj;
  }

  constructor (category: string, tags: string[], data: string[][], parent: Saveframe) {
    this.category = category;
    this.tags = tags;
    this.data_in_column = [];
    this.parent = parent;
    this.schema_values = [];
    this.display = 'H';

    // Turn text nulls into logical nulls
    for (let m = 0; m < data.length; m++) {
      for (let n = 0; n < data[m].length; n++) {
        if (data[m][n] === '.' || data[m][n] === '?') {
          data[m][n] = null;
        }
      }
    }

    // Turn the data into loop tags...
    this.data = [];
    for (let r = 0; r < data.length; r++) {
      const row = [];
      for (let c = 0; c < data[r].length; c++) {
        const new_tag = new LoopTag(this.tags[c], data[r][c], this);
        if (['Y', 'N'].indexOf(new_tag.display) >= 0) {
          if (this.display === 'N') {
            if (new_tag.display === 'Y') {
              this.display = 'Y';
            }
          }
          if (this.display === 'H') {
            this.display = new_tag.display;
          }
        }
        row.push(new_tag);
      }
      this.data.push(row);
    }

    for (let r = 0; r < this.tags.length; r++) {
      this.schema_values.push(this.parent.parent.schema.getTag(this.category + '.' + this.tags[r]));
    }
  }

  // Creates a duplicate of this loop, or an empty loop of the same type
  duplicate(clear_values: boolean = false) {
    const new_loop = new Loop(this.category, this.tags.slice(), [], this.parent);

    for (let r = 0; r < this.data.length; r++) {
      const new_row = [];
      for (let c = 0; c < this.data[r].length; c++) {
        const val = clear_values ? null : this.data[r][c].value;
        new_row.push(new LoopTag(this.data[r][c].name, val, new_loop));
      }
      new_loop.data.push(new_row);
      // Just one row of null data if cloning
      if (clear_values) {
        return new_loop;
      }
    }

    return new_loop;
  }


  checkNull() {
    // Go through the columns
    for (let x = 0; x < this.tags.length; x++) {
      this.data_in_column[x] = false;

      // Check the data for a given column
      for (let n = 0; n < this.data.length; n++) {
        if (this.data[n][x] && (!(['.', '?', '', null].indexOf(this.data[n][x].value) >= 0))) {
          this.data_in_column[x] = true;
          break;
        }
      }
    }
  }

  refresh() {
    this.display = 'H';
    for (let r = 0; r < this.data.length; r++) {
      for (let c = 0; c < this.data[r].length; c++) {
        this.data[r][c].updateTagStatus();

        if (this.display === 'N') {
          if (this.data[r][c].display === 'Y') {
            this.display = 'Y';
          }
        }
        if (this.display === 'H') {
          this.display = this.data[r][c].display;
        }
      }
    }
  }

  /*
   * Currently we don't check loop tags, but if we had to
   * in the future, just have this check those tags preferentially
   */
  getTagValue(fqtn: string): string {
    return this.parent.getTagValue(fqtn, true);
  }

  getSaveframesByPrefix(tag_prefix: string): Saveframe[] {
    return this.parent.parent.getSaveframesByPrefix(tag_prefix);
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
          if (row[n] && row[n].value) {
            // Don't count data that goes on its own line
            if (row[n].value.indexOf('\n') !== -1) {
              continue;
            }
            if (row[n].value.length + 3 > widths[n]) {
                widths[n] = row[n].value.length + 3;
            }
          }
        }
      }

      // Go through and print the data
      for (const row of this.data) {

        // Each row starts with whitespace
        ret_string += '     ';

        // Get the data ready for printing
        for (let n = 0; n < row.length; n++) {

            let datum_copy = cleanValue(row[n].value);
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
