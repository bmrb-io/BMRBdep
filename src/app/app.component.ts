import {Component, OnInit} from '@angular/core';
import {Entry} from './nmrstar/entry';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {

  entry: Entry;
  sidenav_open: boolean;

  constructor() {
    this.sidenav_open = false;
  }

  ngOnInit() {
    console.log('InstantDep version .4');
  }

}
