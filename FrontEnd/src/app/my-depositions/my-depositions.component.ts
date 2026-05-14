import {Component, inject, OnDestroy, OnInit} from '@angular/core';
import {DepositionPersistenceService} from '../deposition-persistence.service';
import {AuthService} from '../auth.service';
import {Router, RouterLink} from '@angular/router';
import {MatDialog} from '@angular/material/dialog';
import {ConfirmationDialogComponent} from '../confirmation-dialog/confirmation-dialog.component';
import {Subscription, take} from 'rxjs';
import {MatCard, MatCardContent, MatCardHeader, MatCardTitle} from '@angular/material/card';
import {MatNavList} from '@angular/material/list';
import {MatIcon} from '@angular/material/icon';
import {NgClass} from '@angular/common';
import {MatProgressSpinner} from '@angular/material/progress-spinner';
import {MatButton} from '@angular/material/button';
import {Entry} from '../nmrstar/entry';

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
  private dialog = inject(MatDialog);

  depositions: Deposition[] = [];
  currentDepositionId: string | null = null;
  loading = true;
  subscription$!: Subscription;

  ngOnInit() {
    // Grab the current in-memory entry (if any) so we can splice it in if the server list lacks it.
    this.subscription$ = this.persistence.entrySubject.pipe(take(1)).subscribe({
      next: (entry: Entry | null) => {
        this.currentDepositionId = entry ? entry.entryID : null;
        this.loadDepositionList(entry);
      }
    });
  }

  private loadDepositionList(currentEntry: Entry | null): void {
    this.subscription$.add(this.auth.getAuthorizedDepositions().subscribe({
      next: (depositions: Deposition[]) => {
        this.depositions = depositions;

        if (this.currentDepositionId) {
          const isCurrentIncluded = depositions.some(
            dep => dep.deposition_id === this.currentDepositionId
          );

          if (!isCurrentIncluded) {
            this.depositions = [
              {
                deposition_id: this.currentDepositionId,
                nickname: currentEntry?.depositionNickname || 'Current deposition',
                authorized_via: [],
                entry_deposited: currentEntry?.deposited ?? false,
                bmrbnum: currentEntry?.bmrbnum ?? undefined,
              },
              ...this.depositions
            ];
          }
        }

        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    }));
  }

  ngOnDestroy() {
    this.subscription$?.unsubscribe();
  }

  isCurrentDeposition(depositionId: string): boolean {
    return depositionId === this.currentDepositionId;
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
    // Don't show confirmation if it's already the current deposition
    if (this.isCurrentDeposition(deposition.deposition_id)) {
      return;
    }

    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {disableClose: false});
    dialogRef.componentInstance.confirmMessage = `Do you want to load deposition "${deposition.nickname}"? This will end your current session.`;
    dialogRef.componentInstance.proceedMessage = 'Yes, load deposition';
    dialogRef.componentInstance.cancelMessage = 'Cancel';

    dialogRef.afterClosed().subscribe({
      next: result => {
        if (result) {
          // Clear local storage
          this.persistence.clearDeposition();

          // Navigate to load endpoint
          this.router.navigate(['/entry', 'load', deposition.deposition_id]).then();
        }
      }
    });
  }
}
