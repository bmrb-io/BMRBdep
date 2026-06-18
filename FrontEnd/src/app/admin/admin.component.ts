import {Component, inject, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {Subscription} from 'rxjs';
import {FormControl, ReactiveFormsModule} from '@angular/forms';
import {MatCard, MatCardContent, MatCardHeader, MatCardTitle} from '@angular/material/card';
import {MatFormField} from '@angular/material/form-field';
import {MatInput} from '@angular/material/input';
import {MatButton} from '@angular/material/button';
import {MatIcon} from '@angular/material/icon';
import {MatProgressSpinner} from '@angular/material/progress-spinner';
import {MatTooltip} from '@angular/material/tooltip';
import {MatDialog} from '@angular/material/dialog';
import {AdminDeposition, AdminService} from '../admin.service';
import {ConfirmationDialogComponent} from '../confirmation-dialog/confirmation-dialog.component';
import {Message, MessagesService} from '../messages.service';
import {DepositionPersistenceService} from '../deposition-persistence.service';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss'],
  standalone: true,
  imports: [ReactiveFormsModule, MatCard, MatCardHeader, MatCardTitle, MatCardContent, MatFormField,
    MatInput, MatButton, MatIcon, MatProgressSpinner, MatTooltip]
})
export class AdminComponent implements OnInit, OnDestroy {
  private adminService = inject(AdminService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private dialog = inject(MatDialog);
  private messages = inject(MessagesService);
  private persistence = inject(DepositionPersistenceService);

  searchControl = new FormControl('', {nonNullable: true});
  results: AdminDeposition[] = [];
  searching = false;
  // Distinguishes "haven't searched yet" from "searched and found nothing".
  hasSearched = false;
  // The deposition currently having an action applied, so we can disable its row buttons.
  pendingId: string | null = null;

  private subscription$ = new Subscription();
  // Deposition IDs already open in this tab, so the "Open" button can reflect that state.
  openIds = new Set<string>();

  // Client-side sort state for the two boolean status fields. null = natural (server) order.
  sortField: 'email_validated' | 'entry_deposited' | null = null;
  sortAsc = true;

  ngOnInit(): void {
    // The URL's `q` param is the single source of truth: searching just updates the param, and this
    // subscription performs the actual lookup — so a page refresh re-runs the same search.
    this.subscription$.add(this.route.queryParamMap.subscribe({
      next: params => {
        const query = (params.get('q') ?? '').trim();
        this.searchControl.setValue(query);
        if (query) {
          this.runSearch(query);
        } else {
          this.results = [];
          this.hasSearched = false;
        }
      }
    }));

    this.subscription$.add(this.persistence.openDepositionsSubject.subscribe({
      next: views => this.openIds = new Set(views.map(v => v.entryID))
    }));
  }

  ngOnDestroy(): void {
    this.subscription$.unsubscribe();
  }

  search(): void {
    const query = this.searchControl.value.trim();
    if (!query) {
      return;
    }
    // Push the term into the URL; the queryParamMap subscription runs the actual search.
    this.router.navigate([], {relativeTo: this.route, queryParams: {q: query}}).then();
  }

  private runSearch(query: string): void {
    this.searching = true;
    this.adminService.search(query).subscribe({
      next: results => {
        this.results = results;
        this.applySort();
        this.hasSearched = true;
        this.searching = false;
      },
      error: () => {
        this.searching = false;
      }
    });
  }

  /** Toggle/apply a client-side sort on one of the boolean status fields. */
  sortBy(field: 'email_validated' | 'entry_deposited'): void {
    if (this.sortField === field) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortField = field;
      this.sortAsc = true;
    }
    this.applySort();
  }

  private applySort(): void {
    if (!this.sortField) {
      return;
    }
    const field = this.sortField;
    const dir = this.sortAsc ? 1 : -1;
    this.results = [...this.results].sort((a, b) => (Number(a[field]) - Number(b[field])) * dir);
  }

  openDeposition(deposition: AdminDeposition): void {
    // Open in the background: add the deposition to this tab's open set (it appears in the
    // "Open depositions" toolbar strip) without switching the current view away from the admin
    // search results. Loading by ID is not auth-gated on the backend, so an admin can open any
    // deposition the same way a depositor would.
    if (this.openIds.has(deposition.deposition_id)) {
      return;
    }
    // "Background" means "don't navigate away from this page" — not "never activate". If nothing is
    // currently active there's no view to protect, so make this one active (which populates the
    // toolbar + side menu) while staying on the admin page. If another deposition is already active,
    // open this one truly in the background so it doesn't steal the current view.
    const activate = !this.persistence.currentEntry;
    this.pendingId = deposition.deposition_id;
    this.persistence.loadEntry(deposition.deposition_id, true, activate).then(
      () => {
        this.pendingId = null;
        this.messages.sendMessage(new Message(activate
          ? 'Deposition opened. Use the Menu button (top left) to navigate it.'
          : 'Deposition opened in the background. Switch to it from the "Open depositions" bar at the top.'));
      },
      // The error message was already surfaced by the load path.
      () => this.pendingId = null
    );
  }

  unlockDeposition(deposition: AdminDeposition): void {
    this.confirm(
      `Re-open deposition "${deposition.nickname || deposition.deposition_id}" for editing? ` +
      'This sets the entry back to not-deposited so the depositor can make changes and re-submit. ' +
      'The assigned BMRB ID (if any) is retained.',
      'Yes, unlock'
    ).then(confirmed => {
      if (!confirmed) {
        return;
      }
      this.pendingId = deposition.deposition_id;
      this.adminService.unlockDeposition(deposition.deposition_id).subscribe({
        next: response => {
          deposition.entry_deposited = response.entry_deposited;
          this.pendingId = null;
          this.refreshIfOpen(deposition.deposition_id);
          this.messages.sendMessage(new Message('Deposition unlocked.'));
        },
        error: () => {
          this.pendingId = null;
        }
      });
    });
  }

  validateEmail(deposition: AdminDeposition): void {
    this.confirm(
      `Manually mark the e-mail address for deposition "${deposition.nickname || deposition.deposition_id}" ` +
      'as validated?',
      'Yes, mark validated'
    ).then(confirmed => {
      if (!confirmed) {
        return;
      }
      this.pendingId = deposition.deposition_id;
      this.adminService.validateEmail(deposition.deposition_id).subscribe({
        next: response => {
          deposition.email_validated = response.email_validated;
          this.pendingId = null;
          this.refreshIfOpen(deposition.deposition_id);
          this.messages.sendMessage(new Message('E-mail marked as validated.'));
        },
        error: () => {
          this.pendingId = null;
        }
      });
    });
  }

  deleteDeposition(deposition: AdminDeposition): void {
    this.confirm(
      `Permanently delete deposition "${deposition.nickname || deposition.deposition_id}"? ` +
      'This removes the deposition directory and all of its data files from the server. ' +
      'This cannot be undone.',
      'Yes, delete permanently'
    ).then(confirmed => {
      if (!confirmed) {
        return;
      }
      this.pendingId = deposition.deposition_id;
      this.adminService.deleteDeposition(deposition.deposition_id).subscribe({
        next: () => {
          this.pendingId = null;
          // Drop any locally-open copy so auto-save doesn't keep PUTting to a now-deleted entry.
          if (this.persistence.isOpen(deposition.deposition_id)) {
            this.persistence.closeDeposition(deposition.deposition_id);
          }
          // Remove it from the visible results immediately.
          this.results = this.results.filter(d => d.deposition_id !== deposition.deposition_id);
          this.messages.sendMessage(new Message('Deposition deleted.'));
        },
        error: () => {
          this.pendingId = null;
        }
      });
    });
  }

  /**
   * If the just-mutated deposition is currently open in this tab, refetch it from the server so the
   * in-memory copy reflects the change (e.g. an unlocked entry becomes editable again, or a now-
   * validated e-mail clears the pending-verification state) instead of showing stale locked state.
   */
  private refreshIfOpen(depositionId: string): void {
    if (this.persistence.isOpen(depositionId)) {
      this.persistence.refetchEntry(depositionId, true);
    }
  }

  private confirm(message: string, proceedMessage: string): Promise<boolean> {
    return new Promise<boolean>(resolve => {
      const dialogRef = this.dialog.open(ConfirmationDialogComponent, {disableClose: false});
      dialogRef.componentInstance.confirmMessage = message;
      dialogRef.componentInstance.proceedMessage = proceedMessage;
      dialogRef.componentInstance.cancelMessage = 'Cancel';
      dialogRef.afterClosed().subscribe({next: result => resolve(result === true)});
    });
  }
}
