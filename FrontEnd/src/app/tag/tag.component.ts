import {Component, inject, Input, OnInit} from '@angular/core';
import {DepositionPersistenceService} from '../deposition-persistence.service';
import {Tag} from '../nmrstar/tag';
import {FormsModule} from '@angular/forms';
import {NgClass} from '@angular/common';
import {MatTooltip} from '@angular/material/tooltip';
import {MatOption, MatSelect} from '@angular/material/select';
import {MatInput} from '@angular/material/input';
import {MatAutocomplete, MatAutocompleteTrigger} from '@angular/material/autocomplete';
import {MatRadioButton, MatRadioGroup} from '@angular/material/radio';

@Component({
  selector: 'app-tag',
  templateUrl: './tag.component.html',
  styleUrls: ['./tag.component.scss'],
  standalone: true,
  imports: [FormsModule, NgClass, MatTooltip, MatSelect, MatOption, MatInput, MatAutocompleteTrigger, MatAutocomplete, MatRadioGroup, MatRadioButton]
})
export class TagComponent implements OnInit {
  private persistence = inject(DepositionPersistenceService);

  @Input() tag!: Tag;
  @Input() unique_identifier!: string;
  filteredOptions: [string, string][] = [];

  public height: number = 0;

  ngOnInit() {
    if (this.tag.interfaceType === 'text') {
      this.recalculateHeight();
    }
    if (this.tag.interfaceType === 'open_enum' && this.tag.enums) {
      this.filteredOptions = [];
      for (const singleEnum of this.tag.enums) {
        this.filteredOptions.push(singleEnum);
      }
    }
  }

  filter() {
    this.filteredOptions = [];
    if (!this.tag.enums) {
      return;
    }
    for (const singleEnum of this.tag.enums) {
      if (singleEnum[0].toLowerCase().includes(this.tag.value.toLowerCase())) {
        this.filteredOptions.push(singleEnum);
      }
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
    } else {
      this.height = 4;
    }
  }

  validateTag(): void {
    this.tag.getEntry().refresh();
    this.persistence.storeEntry(true);
  }

}
