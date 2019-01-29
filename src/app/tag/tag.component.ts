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
  storedValue: string;

  public height: number;

  constructor(public api: ApiService) { }

  ngOnInit() {
    if (this.tag.interfaceType === 'text') {
      this.recalculateHeight();
    }
    if (this.tag.schemaValues['default value'] !== '?') {
      this.storedValue = this.tag.schemaValues['default value'];
    } else {
      this.storedValue = '';
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

  validateTag(): void {
    this.tag.getEntry().refresh();
    this.api.saveEntry();
  }

  storeValue(): void {
    if (this.tag.value) {
      this.storedValue = this.tag.value;
      this.tag.value = null;
    }
  }

  restoreValue(): void {
    if (!this.tag.value) {
      this.tag.value = this.storedValue;
    } else {
      if (this.tag.value !== this.storedValue) {
        this.validateTag();
        this.storedValue = this.tag.value;
      }
    }
  }

  checkDelete(key): void {
    // This checks if they have pressed the delete/backspace key on an open enum - if so we must clear the stored value
    if (['Backspace', 'Delete'].indexOf(key) >= 0) {
      this.storedValue = '';
    }
  }

}
