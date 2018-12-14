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
    // Set the height if this is a textarea tag
    if (this.tag.value) {
      const matches = this.tag.value.match(/\n/g);
      if (matches) {
        this.height = matches.length * 20;
      } else {
        this.height = 50;
      }
    }

  }

  validateTag(tag: Tag): void {
    tag.updateCascade();
    this.api.saveEntry();
  }
}
