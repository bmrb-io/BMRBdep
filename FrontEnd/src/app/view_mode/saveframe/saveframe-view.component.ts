import {Component, Input, OnInit} from '@angular/core';
import {Saveframe} from '../../nmrstar/saveframe';

@Component({
    selector: 'app-saveframe-view',
    templateUrl: './saveframe-view.component.html',
    styleUrls: ['./saveframe-view.component.scss'],
    standalone: false
})
export class SaveframeViewComponent implements OnInit {
  @Input() saveframe: Saveframe;

  constructor() {
  }

  ngOnInit() {
  }
}
