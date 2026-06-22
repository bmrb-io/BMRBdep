import {DepositionPersistenceService} from '../deposition-persistence.service';
import {DepositionLifecycleService} from '../deposition-lifecycle.service';
import {Entry} from '../nmrstar/entry';
import {Component, inject, OnDestroy, OnInit} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {Subscription} from 'rxjs';
import {SaveframeComponent} from '../saveframe/saveframe.component';

@Component({
  selector: 'app-entry',
  templateUrl: './entry.component.html',
  styleUrls: ['./entry.component.scss'],
  standalone: true,
  imports: [SaveframeComponent, MatButtonModule]
})
export class EntryComponent implements OnInit, OnDestroy {
  private persistence = inject(DepositionPersistenceService);
  private lifecycle = inject(DepositionLifecycleService);

  entry: Entry | null = null;
  subscription$!: Subscription;

  // Whether a deposited entry can still be unlocked (ETS status still 'nd'). null while unknown
  // (status not yet fetched, or the entry isn't deposited) so the template shows neither variant.
  unlockable: boolean | null = null;

  ngOnInit() {
    this.subscription$ = this.persistence.entrySubject.subscribe({
      next: entry => {
        this.entry = entry;
        this.refreshUnlockStatus();
      }
    });
  }

  private refreshUnlockStatus(): void {
    this.unlockable = null;
    if (this.entry && this.entry.deposited) {
      this.lifecycle.getUnlockStatus(this.entry.entryID).subscribe({
        next: status => this.unlockable = status ? status.unlockable : null
      });
    }
  }

  unlockDeposition(): void {
    this.lifecycle.unlockDeposition();
  }

  ngOnDestroy() {
    if (this.subscription$) {
      this.subscription$.unsubscribe();
    }
  }

}
