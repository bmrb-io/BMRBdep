import {Component, OnInit} from '@angular/core';
import {ApiService} from '../api.service';
import {Entry} from '../nmrstar/entry';

@Component({
  selector: 'app-restore',
  templateUrl: './restore.component.html',
  styleUrls: ['./restore.component.css']
})
export class RestoreComponent implements OnInit {

  entry: Entry;
  constructor(public api: ApiService) {
  }

  ngOnInit() {
    this.api.entrySubject.subscribe(entry => this.entry = entry);
  }

}
