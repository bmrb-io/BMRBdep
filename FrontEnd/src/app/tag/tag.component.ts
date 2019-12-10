import {Component, Input, OnInit} from '@angular/core';
import {ApiService} from '../api.service';
import {Tag} from '../nmrstar/tag';
import {checkValueIsNull} from '../nmrstar/nmrstar';

@Component({
  selector: 'app-tag',
  templateUrl: './tag.component.html',
  styleUrls: ['./tag.component.scss']
})
export class TagComponent implements OnInit {
  @Input() tag: Tag;
  @Input() unique_identifier: string;
  storedValue: string;

  public height: number;

  constructor(private api: ApiService) {
  }

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

  storeValue(): void {
    if (!checkValueIsNull(this.tag.value)) {
      this.storedValue = this.tag.value;
      this.tag.value = null;
    }
  }

  restoreValue(): void {
    if (checkValueIsNull(this.tag.value)) {
      this.tag.value = this.storedValue;
    } else {
      if (this.tag.value !== this.storedValue || this.tag.value === this.tag.schemaValues['default value']) {
        this.storedValue = this.tag.value;
        this.validateTag();
      }
    }
  }

  checkDelete(key): void {
    // This checks if they have pressed the delete/backspace key on an open enum - if so we must clear the stored value
    if (['Backspace', 'Delete'].includes(key)) {
      this.storedValue = '';
      this.validateTag();
    }
  }

}
