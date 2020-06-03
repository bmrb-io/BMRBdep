import { Component, OnInit } from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {environment} from '../../environments/environment';
import {ActivatedRoute} from '@angular/router';
export class Files {
  name: string;
  path: string;
}

@Component({
  selector: 'app-data-viewer',
  templateUrl: './data-viewer.component.html',
  styleUrls: ['./data-viewer.component.scss']
})
export class DataViewerComponent implements OnInit {
  public files: Array<Files>;
  public entry_id: string;
  public env: object;
  constructor(private http: HttpClient,
              private route: ActivatedRoute) {
    this.env = environment;
  }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.updateFAQs(params['entry']);
      this.entry_id = params['entry'];
    });
  }

  updateFAQs(entry_id): void {
    const url = `${environment.serverURL}/released/${entry_id}`;
    this.http.get(url).subscribe(response => {
      this.files = response['files'] as Array<Files>;
    });
  }
}
