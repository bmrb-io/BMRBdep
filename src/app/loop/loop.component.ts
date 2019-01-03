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
    this.loop.copyAuthors();
    this.loop.parent.parent.refresh();
    this.api.saveEntry();
  }
}
