import {Component, inject, OnDestroy, OnInit} from '@angular/core';
import {DepositionPersistenceService, OpenDepositionView} from '../deposition-persistence.service';
import {AuthService, SessionInfo} from '../auth.service';
import {Router, RouterLink} from '@angular/router';
import {Subscription} from 'rxjs';
import {MatCard, MatCardContent, MatCardHeader, MatCardTitle} from '@angular/material/card';
import {MatNavList} from '@angular/material/list';
import {MatIcon} from '@angular/material/icon';
import {NgClass} from '@angular/common';
import {MatProgressSpinner} from '@angular/material/progress-spinner';
import {MatButton} from '@angular/material/button';

export interface Deposition {
  deposition_id: string;
  nickname: string;
  authorized_via: string[];
  entry_deposited?: boolean;
  bmrbnum?: number;
}

@Component({
  selector: 'app-my-depositions',
  templateUrl: './my-depositions.component.html',
  styleUrls: ['./my-depositions.component.scss'],
  standalone: true,
  imports: [MatCard, MatCardHeader, MatCardTitle, MatCardContent, MatNavList, MatIcon, NgClass, MatProgressSpinner, MatButton, RouterLink]
})
export class MyDepositionsComponent implements OnInit, OnDestroy {
  private persistence = inject(DepositionPersistenceService);
  private auth = inject(AuthService);
  private router = inject(Router);

  depositions: Deposition[] = [];
  activeDepositionId: string | null = null;
  openDepositionIds = new Set<string>();
  sessionInfo: SessionInfo = {};

  // The empty-state needs both signals before it can be trusted: the server's
  // authorized list AND the in-tab hydration of locally-opened depositions.
  // Showing it before hydration finishes can flash "no depositions" for entries
  // that are about to appear from IDB.
  private serverResponseReceived = false;
  private hydrationDone = false;
  private serverDepositions: Deposition[] = [];
  private openViews: OpenDepositionView[] = [];

  subscription$ = new Subscription();

  ngOnInit() {
    this.subscription$.add(this.persistence.entrySubject.subscribe({
      next: entry => this.activeDepositionId = entry ? entry.entryID : null,
    }));
    this.subscription$.add(this.persistence.openDepositionsSubject.subscribe({
      next: views => {
        this.openViews = views;
        this.openDepositionIds = new Set(views.map(v => v.entryID));
        this.recomputeDepositions();
      },
    }));
    this.persistence.hydrationComplete.then(() => {
      this.hydrationDone = true;
      this.recomputeDepositions();
    });
    this.auth.getSessionInfo().subscribe({
      next: info => this.sessionInfo = info,
    });
    this.subscription$.add(this.auth.getAuthorizedDepositions().subscribe({
      next: (depositions: Deposition[]) => {
        this.serverDepositions = depositions;
        this.serverResponseReceived = true;
        this.recomputeDepositions();
      },
      error: () => {
        this.serverResponseReceived = true;
        this.recomputeDepositions();
      }
    }));
  }

  ngOnDestroy() {
    this.subscription$?.unsubscribe();
  }

  get loading(): boolean {
    return !this.serverResponseReceived || !this.hydrationDone;
  }

  get showEmptyState(): boolean {
    return !this.loading && this.depositions.length === 0;
  }

  get emptyStateMessage(): string {
    if (this.sessionInfo.email && this.sessionInfo.orcid) {
      return `No depositions are associated with ${this.sessionInfo.email} or ORCID iD ${this.sessionInfo.orcid}.`;
    }
    if (this.sessionInfo.email) {
      return `No depositions are associated with ${this.sessionInfo.email}.`;
    }
    if (this.sessionInfo.orcid) {
      return `No depositions are associated with ORCID iD ${this.sessionInfo.orcid}.`;
    }
    return 'You are not signed in. To see depositions associated with your e-mail address, request an access link from the home page.';
  }

  /**
   * Merge the server-authorized list with locally-open depositions that the
   * server didn't return (e.g. opened by ID without email/ORCID auth). Recompute
   * on every change to either source so the list stays in sync if the user
   * opens or closes a deposition while this page is mounted.
   */
  private recomputeDepositions(): void {
    const merged: Deposition[] = [];
    const seen = new Set<string>();
    for (const view of this.openViews) {
      if (this.serverDepositions.some(d => d.deposition_id === view.entryID)) continue;
      merged.push({
        deposition_id: view.entryID,
        nickname: view.nickname || 'Untitled deposition',
        authorized_via: [],
        entry_deposited: view.deposited,
        bmrbnum: view.bmrbnum ?? undefined,
      });
      seen.add(view.entryID);
    }
    for (const dep of this.serverDepositions) {
      if (seen.has(dep.deposition_id)) continue;
      merged.push(dep);
    }
    this.depositions = merged;
  }

  isActiveDeposition(depositionId: string): boolean {
    return depositionId === this.activeDepositionId;
  }

  isOpenDeposition(depositionId: string): boolean {
    return this.openDepositionIds.has(depositionId);
  }

  getAuthReasonText(authorizedVia: string[]): string {
    if (!authorizedVia || authorizedVia.length === 0) {
      return '';
    }
    const auths = authorizedVia.map(auth => {
      if (auth === 'email') {
        return 'E-mail address';
      }
      if (auth === 'orcid') {
        return 'ORCID iD';
      }
    });
    return auths.join(', ');
  }

  loadDeposition(deposition: Deposition): void {
    if (this.isActiveDeposition(deposition.deposition_id)) {
      return;
    }
    // Always go through the load route — for already-open depositions
    // loadEntry short-circuits to setActive, and LoadEntryComponent routes to
    // the first incomplete section (or review / pending-verification) so the
    // landing UI matches a fresh load instead of dropping the user at /entry.
    this.router.navigate(['/entry', 'load', deposition.deposition_id]).then();
  }
}
