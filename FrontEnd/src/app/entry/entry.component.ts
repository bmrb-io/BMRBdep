import {ApiService} from '../api.service';
import {Entry} from '../nmrstar/entry';
import {Component, OnInit} from '@angular/core';
import {ActivatedRoute} from '@angular/router';

@Component({
  selector: 'app-entry',
  templateUrl: './entry.component.html',
  styleUrls: ['./entry.component.css']
})
export class EntryComponent implements OnInit {
  entry: Entry;

  constructor(private route: ActivatedRoute,
              private api: ApiService) {
    this.entry = new Entry('');
  }

  ngOnInit() {
    // Listen for the changing of the params string
    const parent = this;
    this.route.params.subscribe(function (params) {
      parent.loadEntry(params['entry']);
    });
  }

  loadEntry(entry: string): void {

    const parent = this;
    parent.api.getEntry(entry)
      .subscribe(
        fetched_entry => {
          parent.entry = fetched_entry;
        }
      );
  }

}
