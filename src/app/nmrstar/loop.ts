import {cleanValue} from './nmrstar';
import {Saveframe} from './saveframe';
import {LoopTag, Tag} from './tag';

export class Loop {
  category: string;
  tags: string[];
  data: LoopTag[][];
  parent: Saveframe;
  schema_values: {}[];
  display: string;
  valid: boolean;

  toJSON(): {} {

    // Turn the loop tags into a simple array of values
    const reduced_data = [];
    for (const row of this.data) {
      const outputRow = [];
      for (const item of row) {
        if ((!item.value) || (item.value === '')) {
          outputRow.push('.');
        } else {
          outputRow.push(item.value);
        }
      }
      reduced_data.push(outputRow);
    }

    return {category: this.category, tags: this.tags, data: reduced_data};
  }

  constructor (category: string, tags: string[], data: string[][], parent: Saveframe) {
    this.category = category;
    this.tags = tags;
    this.parent = parent;
    this.schema_values = [];
    this.display = 'H';
    this.valid = true;

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
    for (const rawRow of data) {
      const row = [];
      for (let c = 0; c < rawRow.length; c++) {
        const new_tag = new LoopTag(this.tags[c], rawRow[c], this);
        row.push(new_tag);
      }
      this.data.push(row);
    }

    for (const tag of this.tags) {
      this.schema_values.push(this.parent.parent.schema.getTag(this.category + '.' + tag));
    }
  }

  addRow(): void {
    const new_row = [];
    for (const tag of this.tags) {
      new_row.push(new LoopTag(tag, null, this));
    }
    this.data.push(new_row);
    this.refresh();
  }

  deleteRow(row_id): void {
    this.data.splice(row_id, 1);
  }

  // Creates a duplicate of this loop, or an empty loop of the same type
  duplicate(clear_values: boolean = false): Loop {
    const new_loop = new Loop(this.category, this.tags.slice(), [], this.parent);

    for (const row of this.data) {
      const new_row = [];
      for (const item of row) {
        const val = clear_values ? null : item.value;
        new_row.push(new LoopTag(item.name, val, new_loop));
      }
      new_loop.data.push(new_row);
      // Just one row of null data if cloning
      if (clear_values) {
        return new_loop;
      }
    }

    return new_loop;
  }

  // Sets the visibility of all tags in the loop
  setVisibility(visibility: 'H' | 'N' | 'Y', FQTN: string = '*'): void {

    // Only certain tags
    if (FQTN !== '*') {
      let tagCol = -1;
      for (const row of this.data) {
        for (const col in row) {
          if (row[col].fqtn === FQTN) {
            tagCol = parseInt(col, 10);
          }
        }
      }
      if (tagCol < 0 ) {
        console.error('Loop ', this, ' asked to hide tag of FQTN of ', FQTN, ' which isn\'t present in this loop.');
        return;
      }

      for (const row of this.data) {
        row[tagCol].display = visibility;
      }
    } else {
      // Indiscriminately apply to all tags
      for (const row of this.data) {
        for (const tag of row) {
          tag.display = visibility;
        }
      }
    }
  }

  refresh(): void {

    // Update the child data tags
    for (const row of this.data) {
      for (const item of row) {
        item.updateTagStatus();
      }
    }

    // Check the loop visibility
    this.display = 'H';
    visibilityCheck:
    for (const row of this.data) {
      for (const item of row) {
        if (item.display === 'Y') {
          this.display = 'Y';
          break visibilityCheck;
        }
        if (this.display === 'H') {
          this.display = item.display;
        }
      }
    }

    // Check if the loop is valid
    this.valid = true;
    validityCheck:
    for (const row of this.data) {
      for (const item of row) {
        if (item.display === 'Y' && !item.valid) {
          this.valid = false;
          break validityCheck;
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
