import { Loop } from '../nmrstar/loop';
import { Component, OnInit, Input } from '@angular/core';

@Component({
  selector: 'app-loop',
  templateUrl: './loop.component.html',
  styleUrls: ['./loop.component.css']
})
export class LoopComponent implements OnInit {
  @Input() loop: Loop;
  @Input() showall: boolean;

  constructor() {}

  ngOnInit() {
  }

}
