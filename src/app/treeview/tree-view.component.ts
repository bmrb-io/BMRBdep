import { Entry } from '../nmrstar/entry';
import { Component, OnInit, Input } from '@angular/core';
import { TitleCasePipe } from '@angular/common';

@Component({
  selector: 'app-treeview',
  templateUrl: './tree-view.component.html',
  styleUrls: ['./tree-view.component.css']
})
export class TreeViewComponent implements OnInit {
  @Input() entry: Entry;
  @Input() active: string;

  constructor() { }

  ngOnInit() {
  }

}
