import {ApiService} from '../api.service';
import {Entry} from '../nmrstar/entry';
import {Component, OnDestroy, OnInit} from '@angular/core';
import {Subscription} from 'rxjs';
import {SaveframeComponent} from '../saveframe/saveframe.component';

@Component({
  selector: 'app-entry',
  templateUrl: './entry.component.html',
  styleUrls: ['./entry.component.css'],
  standalone: true,
  imports: [SaveframeComponent]
})
export class EntryComponent implements OnInit, OnDestroy {
  entry: Entry;
  subscription$: Subscription;

  constructor(private api: ApiService) {
  }

  ngOnInit() {
    this.subscription$ = this.api.entrySubject.subscribe(entry => this.entry = entry);
  }

  ngOnDestroy() {
    if (this.subscription$) {
      this.subscription$.unsubscribe();
    }
  }

}
