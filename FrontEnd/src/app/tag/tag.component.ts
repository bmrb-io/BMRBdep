import {Component, Input, OnInit} from '@angular/core';
import {ApiService} from '../api.service';
import {Tag} from '../nmrstar/tag';

@Component({
  selector: 'app-tag',
  templateUrl: './tag.component.html',
  styleUrls: ['./tag.component.scss']
})
export class TagComponent implements OnInit {
  @Input() tag: Tag;
  @Input() unique_identifier: string;
  filteredOptions: string[];

  public height: number;

  constructor(private api: ApiService) {
  }

  ngOnInit() {
    if (this.tag.interfaceType === 'text') {
      this.recalculateHeight();
    }
    if (this.tag.interfaceType === 'open_enum') {
      this.filteredOptions = Array.from(this.tag.enums);
    }
  }

  private filter() {
    this.filteredOptions = Array.from(this.tag.enums).filter(option => option.toLowerCase().includes(this.tag.value.toLowerCase()));
  }

  getRow() {
    const split = this.unique_identifier.split('_');
    return split[split.length - 2];
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

  validateTag(): void {
    this.tag.getEntry().refresh();
    this.api.saveEntry();
  }

}
