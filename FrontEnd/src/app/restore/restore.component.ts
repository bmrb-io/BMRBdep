import {Component, OnInit} from '@angular/core';
import {ApiService} from '../api.service';
import {ActivatedRoute} from '@angular/router';
import {Entry} from '../nmrstar/entry';

@Component({
  selector: 'app-restore',
  templateUrl: './restore.component.html',
  styleUrls: ['./restore.component.css']
})
export class RestoreComponent implements OnInit {

  entry: Entry;
  constructor(private route: ActivatedRoute,
              public api: ApiService) {
  }

  ngOnInit() {
    this.api.entrySubject.subscribe(entry => this.entry = entry);

    const parent = this;
    this.route.params.subscribe(function (params) {
      parent.api.loadEntry(params['entry']);
    });
  }

}
