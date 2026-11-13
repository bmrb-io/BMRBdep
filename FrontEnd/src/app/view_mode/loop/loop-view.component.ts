import {Loop} from '../../nmrstar/loop';
import {Component, Input, OnInit} from '@angular/core';
import {FormsModule} from '@angular/forms';

@Component({
    selector: 'app-loop-view',
    templateUrl: './loop-view.component.html',
    styleUrls: ['./loop-view.component.scss'],
    imports: [FormsModule]
})

export class LoopViewComponent implements OnInit {
    @Input() loop: Loop;

    constructor() {
    }

    ngOnInit() {
    }

}
