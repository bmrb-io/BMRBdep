import {cleanValue} from './nmrstar';
import {Saveframe} from './saveframe';
import {LoopTag, Tag} from './tag';
import {sprintf} from 'sprintf-js';

export class Loop {
  category: string;
  tags: string[];
  data: LoopTag[][];
  parent: Saveframe;
  schemaValues: {}[];
  display: string;
  valid: boolean;
  empty: boolean;

  toJSON(): {} {

    // Turn the loop tags into a simple array of values
    const reducedData = [];
    for (const row of this.data) {
      const outputRow = [];
      for (const item of row) {
        if ((!item.value) || (item.value === '')) {
          outputRow.push('.');
        } else {
          outputRow.push(item.value);
        }
      }
      reducedData.push(outputRow);
    }

    return {category: this.category, tags: this.tags, data: reducedData};
  }

  constructor(category: string, tags: string[], data: string[][], parent: Saveframe) {
    this.category = category;
    this.tags = tags;
    this.parent = parent;
    this.schemaValues = [];
    this.display = 'H';
    this.valid = true;
    this.empty = false;

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
        const newTag = new LoopTag(this.tags[c], rawRow[c], this);
        row.push(newTag);
      }
      this.data.push(row);
    }

    for (const tag of this.tags) {
      this.schemaValues.push(this.parent.parent.schema.getTag(this.category + '.' + tag));
    }
  }

  addRow(): Array<LoopTag> {
    const newRow = [];
    for (const tag of this.tags) {
      newRow.push(new LoopTag(tag, null, this));
    }
    this.data.push(newRow);

    return newRow;
  }

  deleteRow(rowID): void {
    this.data.splice(rowID, 1);
  }

  // Creates a duplicate of this loop, or an empty loop of the same type
  duplicate(clearValues: boolean = false): Loop {
    const newLoop = new Loop(this.category, this.tags.slice(), [], this.parent);

    for (const row of this.data) {
      const newRow = [];
      for (const item of row) {
        const val = clearValues ? null : item.value;
        newRow.push(new LoopTag(item.name, val, newLoop));
      }
      newLoop.data.push(newRow);
      // Just one row of null data if cloning
      if (clearValues) {
        return newLoop;
      }
    }

    return newLoop;
  }

  // Sets the visibility of all tags in the loop
  setVisibility(rule): void {

    if (rule['Tag category'] !== '*' && rule['Tag category'] !== this.category) {
      console.error('Invalid rule applied to loop:', rule, this);
      return;
    }

    // Only certain tags
    if (rule['Tag'] !== '*') {
      let tagCol = -1;
      for (const row of this.data) {
        for (const col in row) {
          if (row[col].fullyQualifiedTagName === rule['Tag']) {
            tagCol = parseInt(col, 10);
          }
        }
      }

      if (tagCol < 0) {
        console.error('Invalid rule applied to loop missing specified tag:', rule, this);
        return;
      }

      // Apply the rule
      for (const row of this.data) {
        if (rule['Override view value'] === 'O') {
          row[tagCol].display = row[tagCol].schemaValues['User full view'];
        } else {
          row[tagCol].display = rule['Override view value'];
        }
      }
    } else {
      // Indiscriminately apply to all tags
      for (const row of this.data) {
        for (const tag of row) {
          if (rule['Override view value'] === 'O') {
            tag.display = tag.schemaValues['User full view'];
          } else {
            tag.display = rule['Override view value'];
          }
        }
      }
    }
  }

  checkEmpty(): boolean {
    let empty = true;
    if (this.data.length > 1) {
      return false;
    }
    for (const col of this.data[0]) {
      if (col.value !== null && col.value !== '.' && col.value !== '') {
        empty = false;
      }
    }
    return empty;
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

    this.specialRules();
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
    let returnString = '\n   loop_\n';
    // Print the columns
    const rowFormatString = '      %-s\n';

    // Check to make sure our category is set
    if (this.category === undefined) {
      throw new Error('The category was never set for this loop. Either add a column \
        with the category intact, specify it when generating the loop, or set it using setCategory.');
    }

    // Print the categories
    const loopCategory = this.category;
    for (const column of this.tags) {
      returnString += sprintf(rowFormatString, loopCategory + '.' + column);
    }

    returnString += '\n';

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
        returnString += '     ';

        // Get the data ready for printing
        for (let n = 0; n < row.length; n++) {

          let datumCopy = cleanValue(row[n].value);
          if (datumCopy.indexOf('\n') !== -1) {
            datumCopy = sprintf('\n;\n%s;\n', datumCopy);
          }

          // Add the data to the return string
          returnString += sprintf('%-' + widths[n] + 's', datumCopy);
        }

        // End the row
        returnString += ' \n';
      }
    }

    // Close the loop
    returnString += '\n   stop_\n';
    return returnString;
  }


  /* Special rules that aren't in the dictionary */
  specialRules(): void {
    // It is too costly to check this for all loops every refresh since we only need it for citation author
    if (this.category === '_Citation_author') {
      this.empty = this.checkEmpty();
    }
    // If this is the contact person loop, an extra check is needed
    if (this.category === '_Contact_person') {
      let valid = false;
      const roleTags: LoopTag[] = [];

      for (const row of this.data) {
        for (const item of row) {
          if (item.name === 'Role') {
            if (item.value === 'principal investigator') {
              valid = true;
            }
            roleTags.push(item);
          }
        }
      }

      if (!valid) {
        this.valid = false;
        for (const tag of roleTags) {
          tag.valid = false;
          tag.validationMessage = 'Each deposition must have at least one person with the role \'Principal Investigator\'.';
        }
      }
    }
  }
}
