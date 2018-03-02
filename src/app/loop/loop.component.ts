import { Loop } from '../nmrstar/loop';
import { LoopTag } from '../nmrstar/tag';
import { Component, OnInit, Input } from '@angular/core';

@Component({
  selector: 'app-loop',
  templateUrl: './loop.component.html',
  styleUrls: ['./loop.component.css']
})
export class LoopComponent implements OnInit {
  @Input() loop: Loop;
  active_tag: LoopTag;

  constructor() {
    this.active_tag = null;
  }

  ngOnInit() {
    console.log();
  }
}
