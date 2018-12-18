import {Component, OnInit} from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {

  sidenav_open: boolean;

  constructor() {
    this.sidenav_open = false;
  }

  ngOnInit() { }

}
