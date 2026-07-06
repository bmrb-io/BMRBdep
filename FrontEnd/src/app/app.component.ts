import {AfterViewInit, Component, inject, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {DepositionPersistenceService, OpenDepositionView} from './deposition-persistence.service';
import {AuthService, SessionInfo} from './auth.service';
import {versions} from 'environments/versions';
import {Entry} from './nmrstar/entry';
import {Subscription} from 'rxjs';
import {SidenavService} from './sidenav.service';
import {MatSidenav, MatSidenavContainer, MatSidenavContent} from '@angular/material/sidenav';
import {LoadingBarService} from '@ngx-loading-bar/core';
import {MatToolbar, MatToolbarRow} from '@angular/material/toolbar';
import {AsyncPipe, NgClass} from '@angular/common';
import {MatTooltip} from '@angular/material/tooltip';
import {MatIcon} from '@angular/material/icon';
import {Router, RouterLink, RouterOutlet} from '@angular/router';
import {MatProgressBar} from '@angular/material/progress-bar';
import {TreeViewComponent} from './treeview/tree-view.component';
import {CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray} from '@angular/cdk/drag-drop';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  imports: [MatToolbar, MatToolbarRow, NgClass, MatTooltip, MatIcon, RouterLink, MatProgressBar, MatSidenavContainer, MatSidenav, TreeViewComponent, MatSidenavContent, RouterOutlet, AsyncPipe, CdkDropList, CdkDrag, CdkDragHandle]
})
export class AppComponent implements OnInit, OnDestroy, AfterViewInit {
  private persistence = inject(DepositionPersistenceService);
  private auth = inject(AuthService);
  private sidenavService = inject(SidenavService);
  private router = inject(Router);
  loader = inject(LoadingBarService);


  sidenav_open: boolean;
  entry: Entry | null = null;
  openDepositions: OpenDepositionView[] = [];
  sessionInfo: SessionInfo = {};
  subscription$ = new Subscription();
  @ViewChild('sidenav') public sidenav!: MatSidenav;

  constructor() {
    this.sidenav_open = false;
  }

  ngOnInit() {
    console.info('Running git commit: ' + versions.branch + ':' + versions.revision +
      '. View commit on GitHub: https://github.com/bmrb-io/BMRBDep/commit/' + versions.revision);

    this.subscription$.add(this.persistence.entrySubject.subscribe({
      next: entry => this.entry = entry
    }));
    this.subscription$.add(this.persistence.openDepositionsSubject.subscribe({
      next: views => this.openDepositions = views
    }));
    // Fetched once on load; the session only changes via full-page flows (e-mail link activation,
    // sign-out below), so a one-shot read is sufficient to decide whether to offer sign-out.
    this.subscription$.add(this.auth.getSessionInfo().subscribe({
      next: info => this.sessionInfo = info
    }));
  }

  /** Sign-out is offered whenever there is user state to clear: a loaded entry or an active session. */
  get canSignOut(): boolean {
    return !!(this.entry || this.sessionInfo.email || this.sessionInfo.orcid);
  }

  ngAfterViewInit(): void {
    this.sidenavService.setSidenav(this.sidenav);
  }

  ngOnDestroy() {
    this.subscription$.unsubscribe();
  }

  clearEntry(): void {
    // Close any open depositions first (prompts on unsaved changes); if the user cancels, abort.
    this.persistence.signOut().then(done => {
      if (!done) {
        return;
      }
      // Then terminate the server-side session so no user state remains, and clear the local copy
      // so the sign-out button hides immediately.
      this.auth.endSession().then(() => {
        this.sessionInfo = {};
        this.router.navigate(['/']).then();
      });
    });
  }

  activateDeposition(entryID: string): void {
    this.router.navigate(['/entry', 'load', entryID]).then();
  }

  closeChip(event: Event, entryID: string): void {
    event.stopPropagation();
    const wasActive = this.entry?.entryID === entryID;
    this.persistence.confirmDiscardUnsaved('close this deposition', entryID).then(confirmed => {
      if (!confirmed) return;
      this.persistence.closeDeposition(entryID).then(() => {
        // Only move the user if they are actually viewing a deposition (a /entry* page). On other
        // pages (admin, my-depositions, support, help) closing in the tab strip shouldn't yank them
        // away — the close just updates the active entry and the tab strip in place.
        if (!this.router.url.startsWith('/entry')) {
          return;
        }
        if (this.persistence.getOpenDepositionRecords().length === 0) {
          this.router.navigate(['/']).then();
          return;
        }
        // The URL still points at the closed deposition's saveframe path. Route
        // through /entry/load so the new active lands on its first incomplete
        // category (or review / pending-verification) just like a fresh load.
        if (wasActive) {
          const newActive = this.persistence.getEntryID();
          if (newActive) {
            this.router.navigate(['/entry', 'load', newActive]).then();
          }
        }
      });
    });
  }

  trackChip(_index: number, view: OpenDepositionView): string {
    return view.entryID;
  }

  onChipDrop(event: CdkDragDrop<OpenDepositionView[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    // Reorder the local view immediately so the chip doesn't snap back while
    // the service's emit catches up.
    const reordered = [...this.openDepositions];
    moveItemInArray(reordered, event.previousIndex, event.currentIndex);
    this.openDepositions = reordered;
    this.persistence.reorderDepositions(reordered.map(v => v.entryID));
  }
}
