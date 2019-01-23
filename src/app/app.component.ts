import {Component, OnInit} from '@angular/core';
import {ApiService} from './api.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {

  sidenav_open: boolean;

  constructor(public api: ApiService) {
    this.sidenav_open = false;
  }

  ngOnInit() { }

}
