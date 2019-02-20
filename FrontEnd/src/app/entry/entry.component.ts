import {ApiService} from '../api.service';
import {Entry} from '../nmrstar/entry';
import {Component, OnInit} from '@angular/core';

@Component({
  selector: 'app-entry',
  templateUrl: './entry.component.html',
  styleUrls: ['./entry.component.css']
})
export class EntryComponent implements OnInit {
  entry: Entry;

  constructor(private api: ApiService) {
  }

  ngOnInit() {
    this.api.entrySubject.subscribe(entry => this.entry = entry);
  }

}
