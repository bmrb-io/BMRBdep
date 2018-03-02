import { Loop } from '../../nmrstar/loop';
import { Component, OnInit, Input } from '@angular/core';

@Component({
  selector: 'app-loop-view',
  templateUrl: './loop-view.component.html',
  styleUrls: ['./loop-view.component.css']
})

export class LoopViewComponent implements OnInit {
  @Input() loop: Loop;
  @Input() showall: boolean;



  constructor() {}

  ngOnInit() {
  }

  trackByFn(index, item) {
    return index;
  }

}