import {DepositionPersistenceService} from '../deposition-persistence.service';
import {Loop} from '../nmrstar/loop';
import {LoopTag} from '../nmrstar/tag';
import {Component, inject, Input} from '@angular/core';

import {MatTooltip} from '@angular/material/tooltip';
import {MatButton} from '@angular/material/button';
import {NgClass} from '@angular/common';
import {TagComponent} from '../tag/tag.component';

@Component({
  selector: 'app-loop',
  templateUrl: './loop.component.html',
  styleUrls: ['./loop.component.scss'],
  standalone: true,
  imports: [MatTooltip, MatButton, NgClass, TagComponent]
})
export class LoopComponent {
  private persistence = inject(DepositionPersistenceService);

  @Input() loop!: Loop;
  activeTag: LoopTag | null;

  constructor() {
    this.activeTag = null;
  }

  // Add another row of data
  addRow() {
    this.loop.addRow();
    this.loop.parent.parent.refresh();
    this.persistence.storeEntry(true);
  }

  // Delete a row of data
  deleteRow(row_id: number) {
    this.loop.deleteRow(row_id);
    this.loop.parent.parent.refresh();
    this.persistence.storeEntry(true);
  }

  helpClick(activeTag: LoopTag, el: HTMLElement) {
    if (this.activeTag !== activeTag) {
      this.activeTag = activeTag;
      setTimeout(() => {
        el.scrollIntoView(false);
      }, 5);
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
    this.persistence.storeEntry(true);
  }
}
