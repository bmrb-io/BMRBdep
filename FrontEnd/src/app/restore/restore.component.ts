import {Component, OnDestroy, OnInit} from '@angular/core';
import {ApiService} from '../api.service';
import {Entry} from '../nmrstar/entry';
import {Subscription} from 'rxjs';

@Component({
  selector: 'app-restore',
  templateUrl: './restore.component.html',
  styleUrls: ['./restore.component.css']
})
export class RestoreComponent implements OnInit, OnDestroy {

  entry: Entry;
  subscription$: Subscription;

  constructor(public api: ApiService) {
  }

  ngOnInit() {
    this.subscription$ = this.api.entrySubject.subscribe(entry => this.entry = entry);
  }

  ngOnDestroy() {
    this.subscription$.unsubscribe();
  }

}
