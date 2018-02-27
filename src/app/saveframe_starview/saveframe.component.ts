import { ApiService } from '../api.service';
import { Component, OnInit, Input } from '@angular/core';
import { Saveframe } from '../nmrstar/saveframe';

@Component({
  selector: 'app-saveframe-view',
  templateUrl: './saveframe.component.html',
  styleUrls: ['./saveframe.component.css']
})
export class SaveframeViewComponent implements OnInit {
  @Input() saveframe: Saveframe;
  @Input() showall: false;

  constructor(public api: ApiService) {}

  ngOnInit() {
  }
}
