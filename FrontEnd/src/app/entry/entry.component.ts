import {DepositionPersistenceService} from '../deposition-persistence.service';
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
  private persistence = inject(DepositionPersistenceService);

  entry: Entry | null = null;
  subscription$!: Subscription;

  ngOnInit() {
    this.subscription$ = this.persistence.entrySubject.subscribe({
      next: entry => this.entry = entry
    });
  }

  ngOnDestroy() {
    if (this.subscription$) {
      this.subscription$.unsubscribe();
    }
  }

}
