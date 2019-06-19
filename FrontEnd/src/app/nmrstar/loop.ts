import {checkValueIsNull, cleanValue} from './nmrstar';
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
  displayTags: string[];
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
    this.displayTags = new Array(tags.length).fill('H');
    this.valid = true;
    this.empty = false;

    // Turn text nulls into logical nulls
    for (let m = 0; m < data.length; m++) {
      for (let n = 0; n < data[m].length; n++) {
        if (checkValueIsNull(data[m][n])) {
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

  getNextAvailableOrdinal(): number {
    const seenIDs = [];
    const IDCol = this.getTagIndex('ID');
    if (IDCol === null) {
      return null;
    }

    for (const row of this.data) {
      const parsedInt = parseInt(row[IDCol].value, 10);
      if (parsedInt) {
        seenIDs.push(parsedInt);
      }
    }

    const found = Math.max.apply(null, seenIDs) + 1;
    if (!Number.isInteger(found)) {
      return 1;
    }
    return found;
  }

  addRow(): Array<LoopTag> {
    const newRow = [];
    for (const tag of this.tags) {
      const newTag = new LoopTag(tag, null, this);
      // Add the default value if the tag has one
      if (!checkValueIsNull(newTag.schemaValues['default value'])) {
        newTag.value = newTag.schemaValues['default value'];
      }
      if (tag === 'ID') {
        newTag.value = this.getNextAvailableOrdinal().toString();
      }
      newRow.push(newTag);
    }
    this.data.push(newRow);

    return newRow;
  }

  clear(): void {
    if (this.category === '_Contact_person') {
      this.data = [this.data[0]];
    } else {
      this.data = [];
    }
    this.addRow();
  }

  deleteRow(rowID): void {
    this.data.splice(rowID, 1);
  }

  // Creates a duplicate of this loop, or an empty loop of the same type
  duplicate(clearValues: boolean = false): Loop {
    const newLoop = new Loop(this.category, this.tags.slice(), [], this.parent);

    if (!clearValues) {
      for (const row of this.data) {
        const newRow = [];
        for (const item of row) {
          newRow.push(new LoopTag(item.name, item.value, newLoop));
        }
        newLoop.data.push(newRow);
      }
    } else {
      newLoop.addRow();
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
    this.empty = true;
    for (const row of this.data) {
      for (const item of row) {
        if (!checkValueIsNull(item.value)) {
          this.empty = false;
          return this.empty;
        }
      }
    }
    return this.empty;
  }

  refresh(): void {

    // Update the child data tags
    for (const row of this.data) {
      for (const item of row) {
        item.updateTagStatus();
      }
    }

    // Update the per-tag visibility
    this.displayTags = new Array(this.displayTags.length).fill('H');
    for (const row of this.data) {
      for (let col = 0; col < row.length; col++) {
        if (row[col].display === 'Y') {
          this.displayTags[col] = 'Y';
        }
        if (this.displayTags[col] === 'H') {
          this.displayTags[col] = row[col].display;
        }
      }
    }

    // Update the 'overview' visibility
    this.display = 'H';
    for (const display of this.displayTags) {
      if (display === 'Y') {
        this.display = 'Y';
        break;
      }
      if (this.display === 'H') {
        this.display = display;
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

  getTagIndex(tagName: string): number {
    if (tagName.includes('.')) {
      tagName = tagName.slice(tagName.indexOf('.') + 1);
    }
    const position = this.tags.indexOf(tagName);
    if (position < 0) {
      return null;
    }
    return position;
  }

  print(): string {

    const parent = this;

    // Check for totally empty loops
    if (this.checkEmpty()) {
      return '';
    }

    // Check for loops that have data, but only imported data
    if (this.display === 'H') {
      return '';
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

    let hadRealData = false;

    // If there is data to print, print it
    if (this.data.length !== 0) {

      const widths = Array(this.data[0].length).fill(null);

      // Figure out the maximum row lengths
      for (const row of this.data) {
        for (let n = 0; n < row.length; n++) {
          if (row[n] && (!checkValueIsNull(row[n].value))) {
            // Don't count data that goes on its own line
            if (row[n].value.indexOf('\n') !== -1) {
              continue;
            }
            if (widths[n] === null) {
              widths[n] = row[n].value.length + 3;
            } else if (row[n].value.length + 3 > widths[n]) {
              widths[n] = row[n].value.length + 3;
            }
          }
        }
      }

      // Print the categories
      const loopCategory = this.category;
      for (const column in this.tags) {
        if ((this.displayTags[column] !== 'H' && widths[column] !== null) || this.tags[column] === 'Experiment_ID' ||
          this.category === '_Upload_data' || this.tags[column] === 'ID' ) {
          returnString += sprintf(rowFormatString, loopCategory + '.' + this.tags[column]);
        }
      }
      returnString += '\n';

      // Go through and print the data
      for (const row of this.data) {

        // Each row starts with whitespace
        returnString += '     ';

        // Get the data ready for printing
        for (let n = 0; n < row.length; n++) {

          if ((this.displayTags[n] === 'H' || widths[n] === null) && row[n].name !== 'Experiment_ID' && this.category !== '_Upload_data' &&
            row[n].name !== 'ID') {
            continue;
          }

          if (!checkValueIsNull(row[n].value)) {
            // ID alone isn't worth printing
            if (row[n].name !== 'ID') {
              hadRealData = true;
            }
          }

          let datumCopy = cleanValue(row[n].value);
          if (datumCopy.indexOf('\n') !== -1) {
            datumCopy = sprintf('\n;\n%s;\n', datumCopy);
          }

          if (widths[n] === null) {
            widths[n] = 3;
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
    if (hadRealData) {
      return returnString;
    } else {
      return '';
    }
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

      // Check for a PI
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

    // Lock the first data row author email for contact person
    if (this.category === '_Contact_person') {
      const emailID = this.tags.indexOf('Email_address');
      this.data[0][emailID].disabled = true;
    }
  }

  copyAuthors(): void {
    const entryAuthors = this.parent.parent.getLoopsByCategory('_Entry_author')[0];

    // Add the new rows
    for (let i = 0; i < entryAuthors.data.length - 1; i++) {
      this.addRow();
    }

    // Figure out which columns we need to copy
    const entryGivenNameCol = entryAuthors.tags.indexOf('Given_name');
    const entryFamilyNameCol = entryAuthors.tags.indexOf('Family_name');
    const entryMiddleInitialsCol = entryAuthors.tags.indexOf('Middle_initials');
    const entryFamilyTitleCol = entryAuthors.tags.indexOf('Family_title');

    const citationGivenNameCol = this.tags.indexOf('Given_name');
    const citationFamilyNameCol = this.tags.indexOf('Family_name');
    const citationMiddleInitialsCol = this.tags.indexOf('Middle_initials');
    const citationFamilyTitleCol = this.tags.indexOf('Family_title');

    // Copy the data
    for (const row in this.data) {
      if (this.data.hasOwnProperty(row)) {
        this.data[row][citationGivenNameCol].value = entryAuthors.data[row][entryGivenNameCol].value;
        this.data[row][citationFamilyNameCol].value = entryAuthors.data[row][entryFamilyNameCol].value;
        this.data[row][citationMiddleInitialsCol].value = entryAuthors.data[row][entryMiddleInitialsCol].value;
        this.data[row][citationFamilyTitleCol].value = entryAuthors.data[row][entryFamilyTitleCol].value;
      }
    }
  }
}
