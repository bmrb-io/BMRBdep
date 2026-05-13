import {ApiService} from '../api.service';
import {Entry} from '../nmrstar/entry';
import {Component, inject, OnDestroy, OnInit} from '@angular/core';
import {Subscription} from 'rxjs';
import {SaveframeComponent} from '../saveframe/saveframe.component';

@Component({
  selector: 'app-entry',
  templateUrl: './entry.component.html',
  styleUrls: ['./entry.component.scss'],
  standalone: true,
  imports: [SaveframeComponent]
})
export class EntryComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);

  entry: Entry;
  subscription$: Subscription;

  ngOnInit() {
    this.subscription$ = this.api.entrySubject.subscribe({
      next: entry => this.entry = entry
    });
  }

  ngOnDestroy() {
    if (this.subscription$) {
      this.subscription$.unsubscribe();
    }
  }

}
