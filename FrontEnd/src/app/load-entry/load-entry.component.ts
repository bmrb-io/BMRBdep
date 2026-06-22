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
          // whatever is still active, or home if nothing is. replaceUrl so this dead route
          // never lingers in history (otherwise Back lands here and re-redirects forward).
          () => this.router.navigate([this.persistence.currentEntry ? '/entry' : '/'], {replaceUrl: true}).then()
        );
      }
    });
  }

  /**
   * Land on the right section for a freshly-loaded entry, mirroring a normal open.
   *
   * Every navigation here uses replaceUrl so the transient /entry/load/:id route is
   * swapped out of history rather than stacked on top of it. Without this, Back from
   * the destination returns to /entry/load/:id, which immediately re-redirects forward
   * — leaving the user unable to navigate back to wherever they opened the entry from
   * (e.g. /admin).
   */
  private routeForEntry(entry: Entry): void {
    if (!entry.emailValidated) {
      this.router.navigate(['/entry', 'pending-verification'], {replaceUrl: true}).then();
      return;
    }
    if (entry.deposited) {
      this.router.navigate(['/entry'], {replaceUrl: true}).then();
    } else if (entry.firstIncompleteCategory) {
      this.router.navigate(['/entry/', 'saveframe', entry.firstIncompleteCategory], {replaceUrl: true}).then();
    } else {
      this.router.navigate(['/entry/', 'review'], {replaceUrl: true}).then();
    }
  }

  ngOnDestroy() {
    if (this.subscription$) {
      this.subscription$.unsubscribe();
    }
  }
}
