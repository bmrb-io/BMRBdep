import {Component, inject, OnDestroy, OnInit} from '@angular/core';
import {DepositionPersistenceService} from '../deposition-persistence.service';
import {ActivatedRoute, Router} from '@angular/router';
import {Subscription} from 'rxjs';
import {Entry} from '../nmrstar/entry';

@Component({
  selector: 'app-load-entry',
  templateUrl: './load-entry.component.html',
  standalone: true,
  styleUrls: ['./load-entry.component.css']
})
export class LoadEntryComponent implements OnInit, OnDestroy {
  private persistence = inject(DepositionPersistenceService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  subscription$!: Subscription;

  ngOnInit() {
    this.subscription$ = this.route.params.subscribe({
      next: params => {
        this.persistence.loadEntry(params['entry']).then(
          entry => this.routeForEntry(entry),
          // The fetch or local save failed; the user-facing error was already shown by
          // the load path. Get the user off the now-dead /entry/load/:id route — back to
          // whatever is still active, or home if nothing is.
          () => this.router.navigate([this.persistence.currentEntry ? '/entry' : '/']).then()
        );
      }
    });
  }

  /** Land on the right section for a freshly-loaded entry, mirroring a normal open. */
  private routeForEntry(entry: Entry): void {
    if (!entry.emailValidated) {
      this.router.navigate(['/entry', 'pending-verification']).then();
      return;
    }
    if (entry.deposited) {
      this.router.navigate(['/entry']).then();
    } else if (entry.firstIncompleteCategory) {
      this.router.navigate(['/entry/', 'saveframe', entry.firstIncompleteCategory]).then();
    } else {
      this.router.navigate(['/entry/', 'review']).then();
    }
  }

  ngOnDestroy() {
    if (this.subscription$) {
      this.subscription$.unsubscribe();
    }
  }
}
