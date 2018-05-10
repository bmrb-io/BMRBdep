import { ApiService } from '../api.service';
import { Entry } from '../nmrstar/entry';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { download } from '../nmrstar/nmrstar';


@Component({
  selector: 'app-entry',
  templateUrl: './entry.component.html',
  styleUrls: ['./entry.component.css']
})
export class EntryComponent implements OnInit {
  entry: Entry;
  showall: boolean;

  constructor(private route: ActivatedRoute,
    private api: ApiService) {
    this.entry = new Entry('');
    this.showall = true;
  }

  ngOnInit() {
    // Listen for the changing of the params string
    const parent = this;
    this.route.params.subscribe(function(params) {
      parent.loadEntry(params['entry']);
    });
  }

  loadEntry(entry: string) {

    const parent = this;
    parent.api.getEntry(entry)
      .subscribe(
        fetched_entry => {
          parent.entry = fetched_entry;
        }
      );
  }

  download(name: string, printable_object) {
    download(name, printable_object);
  }

}
