import {Component, inject, Input, OnInit} from '@angular/core';
import {DepositionPersistenceService} from '../deposition-persistence.service';
import {LoopTag, Tag} from '../nmrstar/tag';
import {countryNames, getRegions} from '../nmrstar/countries';
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
  filteredOptions: [string, string][] = [];
  countryNames = countryNames;

  /* For a country tag, the state/province tag of the same row, and vice versa. */
  private linkedTag: LoopTag | null = null;

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
    // The country and state/province tags of a contact person drive each other
    if (this.tag instanceof LoopTag) {
      if (this.tag.interfaceType === 'country') {
        this.linkedTag = this.tag.getTagInSameRow('State_province');
      } else if (this.tag.interfaceType === 'state') {
        this.linkedTag = this.tag.getTagInSameRow('Country');
      }
    }
  }

  /* The states/provinces to offer for a state tag, based on the country selected in the same row. */
  get regions(): string[] {
    return getRegions(this.linkedTag ? this.linkedTag.value : '');
  }

  /* True if the tag holds a country or region that isn't in the list, which happens when a
   * deposition was started before a country renamed or reorganized its subdivisions. Such a value
   * is offered as an extra option rather than silently dropped. */
  valueIsUnlisted(options: string[]): boolean {
    return !!this.tag.value && options.indexOf(this.tag.value) < 0;
  }

  /* A state/province is only meaningful for the country it belongs to. */
  countryChanged(country: string): void {
    if (this.linkedTag && getRegions(country).indexOf(this.linkedTag.value) < 0) {
      this.linkedTag.value = '';
    }
    this.validateTag();
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
