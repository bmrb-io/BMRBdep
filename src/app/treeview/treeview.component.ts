import { Entry } from '../nmrstar/entry';
import { Component, OnInit, Input } from '@angular/core';
import { TitleCasePipe } from '@angular/common';

@Component({
  selector: 'app-treeview',
  templateUrl: './treeview.component.html',
  styleUrls: ['./treeview.component.css']
})
export class TreeviewComponent implements OnInit {
  @Input() entry: Entry;
  @Input() active: string;

  constructor() { }

  ngOnInit() {
  }

}
