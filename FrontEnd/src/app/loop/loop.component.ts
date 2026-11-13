import {ApiService} from '../api.service';
import {Loop} from '../nmrstar/loop';
import {LoopTag} from '../nmrstar/tag';
import {Component, Input, OnInit} from '@angular/core';

import {MatTooltip} from '@angular/material/tooltip';
import {MatButton} from '@angular/material/button';
import {NgClass} from '@angular/common';
import {TagComponent} from '../tag/tag.component';

@Component({
    selector: 'app-loop',
    templateUrl: './loop.component.html',
    styleUrls: ['./loop.component.scss'],
    imports: [MatTooltip, MatButton, NgClass, TagComponent]
})
export class LoopComponent implements OnInit {
    @Input() loop: Loop;
    activeTag: LoopTag;

    constructor(private api: ApiService) {
        this.activeTag = null;
    }

    ngOnInit() {
    }

    // Add another row of data
    addRow() {
        this.loop.addRow();
        this.loop.parent.parent.refresh();
        this.api.storeEntry(true);
    }

    // Delete a row of data
    deleteRow(row_id) {
        this.loop.deleteRow(row_id);
        this.loop.parent.parent.refresh();
        this.api.storeEntry(true);
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
        this.api.storeEntry(true);
    }
}
