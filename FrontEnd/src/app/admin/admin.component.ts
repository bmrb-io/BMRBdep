import {Component, inject} from '@angular/core';
import {Router} from '@angular/router';
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
export class AdminComponent {
  private adminService = inject(AdminService);
  private router = inject(Router);
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

  search(): void {
    const query = this.searchControl.value.trim();
    if (!query) {
      return;
    }
    this.searching = true;
    this.adminService.search(query).subscribe({
      next: results => {
        this.results = results;
        this.hasSearched = true;
        this.searching = false;
      },
      error: () => {
        this.searching = false;
      }
    });
  }

  openDeposition(deposition: AdminDeposition): void {
    // Loading by ID is not auth-gated on the backend, so the admin can open any deposition the
    // same way a depositor would — landing on its first incomplete section.
    this.router.navigate(['/entry', 'load', deposition.deposition_id]).then();
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
