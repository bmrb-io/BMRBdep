import { Component, OnInit } from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {environment} from '../../environments/environment';
import {ActivatedRoute} from '@angular/router';

export class Files {
  name: string;
  path: string;
}

export class Entry {
  id: string;
  release_date: string;
  title: string;
  bmrb_id: string;
  pdb_id: string;
  doi: string;
}

@Component({
  selector: 'app-data-viewer',
  templateUrl: './data-viewer.component.html',
  styleUrls: ['./data-viewer.component.scss']
})
export class DataViewerComponent implements OnInit {
  public files: Array<Files>;
  public title: string;
  public entry_id: string;
  public env: object;
  public records: Array<Entry>;
  constructor(private http: HttpClient,
              private route: ActivatedRoute) {
    this.env = environment;
  }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      // Entry summary page
      if (params['entry']) {
        this.getEntryRecord(params['entry']);
        this.entry_id = params['entry'];
      } else {
        // All entries page
        this.getAllEntries();
      }
    });
  }

  getEntryRecord(entry_id): void {
    const url = `${environment.serverURL}/released/${entry_id}`;
    this.http.get(url).subscribe(response => {
      this.files = response['files'] as Array<Files>;
      this.title = response['title'];
    });
  }

  getAllEntries(): void {
    const url = `${environment.serverURL}/released`;
    this.http.get(url).subscribe(response => {
      this.records = response as Array<Entry>;
    });
  }
}
