import {Entry} from '../nmrstar/entry';
import {Component, Input, OnInit} from '@angular/core';

@Component({
  selector: 'app-tree-view',
  templateUrl: './tree-view.component.html',
  styleUrls: ['./tree-view.component.css']
})
export class TreeViewComponent implements OnInit {
  @Input() entry: Entry;
  @Input() active: string;
  @Input() show_all: boolean;

  constructor() { }

  ngOnInit() {
  }

}
