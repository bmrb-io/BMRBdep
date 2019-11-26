import {ApiService} from '../api.service';
import {Loop} from '../nmrstar/loop';
import {LoopTag} from '../nmrstar/tag';
import {AfterViewChecked, ChangeDetectorRef, Component, Input, OnInit} from '@angular/core';

/* Import country updater code */
import * as crs from '../javascript/crs.min';

@Component({
  selector: 'app-loop',
  templateUrl: './loop.component.html',
  styleUrls: ['./loop.component.scss']
})
export class LoopComponent implements OnInit, AfterViewChecked {
  @Input() loop: Loop;
  activeTag: LoopTag;
  crsInit: boolean;

  constructor(private api: ApiService,
              private changeDetector: ChangeDetectorRef) {
    this.activeTag = null;
    this.crsInit = false;
  }

  ngOnInit() {
  }

  // Load the country autofill code
  ngAfterViewChecked() {
    // Note that we use ngAfterViewChecked with a custom run-once check rather than AfterViewInit due to the issues discussed here:
    // https://stackoverflow.com/questions/31171084/how-to-call-function-after-dom-renders-in-angular2
    if (!this.crsInit && this.loop.category === '_Contact_person') {
      crs.init();
      this.crsInit = true;
    }
  }

  // Add another row of data
  addRow() {
    this.loop.addRow();
    this.loop.parent.parent.refresh();
    this.api.saveEntry();
    // Reload the country-autofill code
    if (this.loop.category === '_Contact_person') {
      this.changeDetector.detectChanges();
      crs.init();
    }
  }

  // Delete a row of data
  deleteRow(row_id) {
    this.loop.deleteRow(row_id);
    this.loop.parent.parent.refresh();
    this.api.saveEntry();
  }

  helpClick(activeTag: LoopTag, el: HTMLElement) {
    if (this.activeTag !== activeTag) {
      this.activeTag = activeTag;
      setTimeout(() => {el.scrollIntoView(false); }, 5);
    } else {
      this.activeTag = null;
    }
  }

  log() {
    console.log(this.loop);
  }

  copyAuthors(): void {
    this.loop.copyAuthors();
    this.loop.parent.parent.refresh();
    this.api.saveEntry();
  }
}
