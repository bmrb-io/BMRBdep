import {Loop} from '../../nmrstar/loop';
import {Component, Input, OnInit} from '@angular/core';

@Component({
  selector: 'app-loop-view',
  templateUrl: './loop-view.component.html',
  styleUrls: ['./loop-view.component.css']
})

export class LoopViewComponent implements OnInit {
  @Input() loop: Loop;
  @Input() show_all: boolean;

  constructor() {}

  ngOnInit() {
  }

}
