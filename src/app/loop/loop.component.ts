import {ApiService} from '../api.service';
import {Loop} from '../nmrstar/loop';
import {LoopTag} from '../nmrstar/tag';
import {Component, Input, OnInit} from '@angular/core';

@Component({
  selector: 'app-loop',
  templateUrl: './loop.component.html',
  styleUrls: ['./loop.component.css']
})
export class LoopComponent implements OnInit {
  @Input() loop: Loop;
  @Input() showInvalidOnly: false;
  activeTag: LoopTag;

  constructor(public api: ApiService) {
    this.activeTag = null;
  }

  ngOnInit() {
  }

  // Add another row of data
  addRow() {
    this.loop.addRow();
    this.loop.parent.parent.refresh();
    this.api.saveEntry();
  }

  // Delete a row of data
  deleteRow(row_id) {
    this.loop.deleteRow(row_id);
    this.loop.parent.parent.refresh();
    this.api.saveEntry();
  }

  log() {
    console.log(this.loop);
  }

  copyAuthors(): void {
    const entryAuthors = this.loop.parent.parent.getLoopsByCategory('_Entry_author')[0];

    // Add the new rows
    for (let i = 0; i < entryAuthors.data.length - 1; i++) {
      this.loop.addRow();
    }

    // Figure out which columns we need to copy
    const entryGivenNameCol = entryAuthors.tags.indexOf('Given_name');
    const entryFamilyNameCol = entryAuthors.tags.indexOf('Family_name');
    const entryMiddleInitialsCol = entryAuthors.tags.indexOf('Middle_initials');
    const entryFamilyTitleCol = entryAuthors.tags.indexOf('Family_title');

    const citationGivenNameCol = this.loop.tags.indexOf('Given_name');
    const citationFamilyNameCol = this.loop.tags.indexOf('Family_name');
    const citationMiddleInitialsCol = this.loop.tags.indexOf('Middle_initials');
    const citationFamilyTitleCol = this.loop.tags.indexOf('Family_title');

    // Copy the data
    for (const row in this.loop.data) {
      if (this.loop.data.hasOwnProperty(row)) {
        this.loop.data[row][citationGivenNameCol].value = entryAuthors.data[row][entryGivenNameCol].value;
        this.loop.data[row][citationFamilyNameCol].value = entryAuthors.data[row][entryFamilyNameCol].value;
        this.loop.data[row][citationMiddleInitialsCol].value = entryAuthors.data[row][entryMiddleInitialsCol].value;
        this.loop.data[row][citationFamilyTitleCol].value = entryAuthors.data[row][entryFamilyTitleCol].value;
      }
    }

    // Refresh and save
    this.loop.parent.parent.refresh();
    this.api.saveEntry();
  }
}
