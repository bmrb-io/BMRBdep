import {Component, Input, OnInit} from '@angular/core';
import {ApiService} from '../api.service';
import {Tag} from '../nmrstar/tag';

@Component({
  selector: 'app-tag',
  templateUrl: './tag.component.html',
  styleUrls: ['./tag.component.css']
})
export class TagComponent implements OnInit {
  @Input() tag: Tag;
  @Input() unique_identifier: string;
  public height: number;

  constructor(public api: ApiService) { }

  ngOnInit() {
    if (this.tag.interfaceType === 'text') {
      this.recalculateHeight();
    }
  }

  recalculateHeight() {
    // Set the height if this is a textarea tag
    if (this.tag.value) {
      const matches = this.tag.value.match(/\n/g);
      if (matches) {
        this.height = matches.length + 4;
      } else {
        this.height = 4;
      }
    }
  }

  validateTag(tag: Tag): void {
    tag.getEntry().refresh();
    this.api.saveEntry();
  }
}
