import {Component, OnInit} from '@angular/core';
import {ApiService} from './api.service';
import {versions} from 'environments/versions';
import {Entry} from './nmrstar/entry';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {

  sidenav_open: boolean;
  entry: Entry;

  constructor(private api: ApiService) {
    this.sidenav_open = false;
  }

  ngOnInit() {
    console.log('Running git commit: ' + versions.branch + ':' + versions.revision +
        '. View commit on GitHub: https://github.com/uwbmrb/BMRBDep/commit/' + versions.revision);

    this.api.entrySubject.subscribe(entry => this.entry = entry);
  }
}
