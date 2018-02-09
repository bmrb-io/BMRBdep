import { Component, OnInit, Input } from '@angular/core';
import { SaveframeTag } from '../../nmrstar/nmrstar';

@Component({
  selector: 'app-saveframe-tag',
  templateUrl: './saveframe-tag.component.html',
  styleUrls: ['./saveframe-tag.component.css']
})
export class SaveframeTagComponent implements OnInit {
    @Input() tag: SaveframeTag;
    @Input() showall;

  constructor() { }

  ngOnInit() {
  }

}
