import {Component, OnDestroy, OnInit} from '@angular/core';
import {ApiService} from '../api.service';
import {Router, RouterLink} from '@angular/router';
import {MatDialog} from '@angular/material/dialog';
import {ConfirmationDialogComponent} from '../confirmation-dialog/confirmation-dialog.component';
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
  styleUrls: ['./my-depositions.component.css'],
  standalone: true,
  imports: [MatCard, MatCardHeader, MatCardTitle, MatCardContent, MatNavList, MatIcon, NgClass, MatProgressSpinner, MatButton, RouterLink]
})
export class MyDepositionsComponent implements OnInit, OnDestroy {
  depositions: Deposition[] = [];
  currentDepositionId: string | null = null;
  loading = true;
  subscription$: Subscription;

  constructor(
    private api: ApiService,
    private router: Router,
    private dialog: MatDialog
  ) {
  }

  ngOnInit() {
    // Get current deposition ID from localStorage
    this.currentDepositionId = localStorage.getItem('entryID');

    // Fetch authorized depositions from API
    this.subscription$ = this.api.getAuthorizedDepositions().subscribe({
      next: (depositions: Deposition[]) => {
        this.depositions = depositions;

        // Add current deposition from localStorage if not already included
        if (this.currentDepositionId) {
          const isCurrentIncluded = depositions.some(
            dep => dep.deposition_id === this.currentDepositionId
          );

          if (!isCurrentIncluded) {
            // Get nickname from localStorage entry
            let nickname = 'Current deposition';
            let entryDeposited = false;
            let bmrbnum: number | undefined;
            try {
              const entryData = JSON.parse(localStorage.getItem('entry'));
              if (entryData && entryData.deposition_nickname) {
                nickname = entryData.deposition_nickname;
              }
              if (entryData && entryData.entry_deposited) {
                entryDeposited = true;
                bmrbnum = entryData.bmrbnum;
              }
            } catch (e) {
              // If parsing fails, use default nickname
            }

            this.depositions = [
              {
                deposition_id: this.currentDepositionId,
                nickname: nickname,
                authorized_via: [],
                entry_deposited: entryDeposited,
                bmrbnum: bmrbnum
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
    });
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
          this.api.clearDeposition();

          // Navigate to load endpoint
          this.router.navigate(['/entry', 'load', deposition.deposition_id]).then();
        }
      }
    });
  }
}
