import {Component, Input, OnInit} from '@angular/core';
import {Saveframe} from '../../nmrstar/saveframe';
import {FormsModule} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {LoopViewComponent} from '../loop/loop-view.component';

@Component({
    selector: 'app-saveframe-view',
    templateUrl: './saveframe-view.component.html',
    styleUrls: ['./saveframe-view.component.scss'],
    imports: [FormsModule, RouterLink, LoopViewComponent]
})
export class SaveframeViewComponent implements OnInit {
    @Input() saveframe: Saveframe;

    constructor() {
    }

    ngOnInit() {
    }
}
