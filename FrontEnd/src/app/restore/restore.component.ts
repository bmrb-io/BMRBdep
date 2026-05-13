import {Component, inject, OnDestroy, OnInit} from '@angular/core';
import {ApiService} from '../api.service';
import {Entry} from '../nmrstar/entry';
import {Subscription} from 'rxjs';
import {SaveframeComponent} from '../saveframe/saveframe.component';

@Component({
  selector: 'app-restore',
  templateUrl: './restore.component.html',
  styleUrls: ['./restore.component.css'],
  standalone: true,
  imports: [SaveframeComponent]
})
export class RestoreComponent implements OnInit, OnDestroy {
  api = inject(ApiService);


  entry: Entry;
  subscription$: Subscription;

  ngOnInit() {
    this.subscription$ = this.api.entrySubject.subscribe({
      next: entry => this.entry = entry
    });
  }

  ngOnDestroy() {
    this.subscription$.unsubscribe();
  }

}
