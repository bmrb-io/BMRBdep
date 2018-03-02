import { Component, OnInit, Input } from '@angular/core';
import { Saveframe } from '../../nmrstar/saveframe';

@Component({
  selector: 'app-saveframe-view',
  templateUrl: './saveframe-view.component.html',
  styleUrls: ['./saveframe-view.component.css']
})
export class SaveframeViewComponent implements OnInit {
  @Input() saveframe: Saveframe;
  @Input() showall: false;

  constructor() {}

  ngOnInit() {
  }
}
