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
  }

  ngOnInit() {
    // Listen for the changing of the params string
    const parent: EntryComponent = this;

    this.api.entrySubject.subscribe(entry => this.entry = entry);

    this.route.params.subscribe(function (params) {
      parent.api.getEntry(params['entry']).subscribe();
    });
  }

}
