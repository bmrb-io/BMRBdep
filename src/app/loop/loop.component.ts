import { ApiService } from '../api.service';
import { Loop } from '../nmrstar/loop';
import { LoopTag } from '../nmrstar/tag';
import { Component, OnInit, Input } from '@angular/core';

@Component({
  selector: 'app-loop',
  templateUrl: './loop.component.html',
  styleUrls: ['./loop.component.css']
})
export class LoopComponent implements OnInit {
  @Input() loop: Loop;
  @Input() showall: boolean;
  active_tag: LoopTag;

  constructor(public api: ApiService) {
    this.active_tag = null;
  }

  ngOnInit() {
  }

  // Add another row of data
  addRow() {
    const new_row = [];
    for (let i = 0; i < this.loop.tags.length; i++) {
      new_row.push(new LoopTag(this.loop.tags[i], null, this.loop));
    }
    this.loop.data.push(new_row);
    this.api.saveLocal();
  }

  // Delete a row of data
  deleteRow(row_id) {
    this.loop.data.splice(row_id, 1);
    this.api.saveLocal();
  }
}
