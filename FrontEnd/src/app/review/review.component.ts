import {Component, inject, OnDestroy, OnInit} from '@angular/core';
import {DepositionPersistenceService} from '../deposition-persistence.service';
import {DepositionLifecycleService} from '../deposition-lifecycle.service';
import {MessagesService} from '../messages.service';
import {Location} from '@angular/common';
import {Entry} from '../nmrstar/entry';
import {ConfirmationDialogComponent} from '../confirmation-dialog/confirmation-dialog.component';
import {MatDialog, MatDialogRef} from '@angular/material/dialog';
import {Subscription} from 'rxjs';
import {FormControl, FormsModule, ReactiveFormsModule} from '@angular/forms';
import {MatCard, MatCardActions, MatCardContent, MatCardHeader, MatCardTitle} from '@angular/material/card';
import {MatNavList} from '@angular/material/list';
import {MatButton} from '@angular/material/button';
import {MatTooltip} from '@angular/material/tooltip';
import {RouterLink} from '@angular/router';
import {MatFormField} from '@angular/material/select';
import {MatInput} from '@angular/material/input';

@Component({
  selector: 'app-review',
  templateUrl: './review.component.html',
  styleUrls: ['./review.component.css'],
  standalone: true,
  imports: [MatCard, MatCardHeader, MatCardTitle, MatCardContent, MatNavList, MatButton, MatTooltip, RouterLink, MatFormField, MatInput, FormsModule, ReactiveFormsModule, MatCardActions]
})
export class ReviewComponent implements OnInit, OnDestroy {
  persistence = inject(DepositionPersistenceService);
  private lifecycle = inject(DepositionLifecycleService);
  private messagesService = inject(MessagesService);
  private location = inject(Location);
  private dialog = inject(MatDialog);

  dialogRef: MatDialogRef<ConfirmationDialogComponent> | null = null;
  entry: Entry | null = null;
  subscription$!: Subscription;
  messageControl = new FormControl<string>('', {nonNullable: true});

  ngOnInit() {
    this.subscription$ = this.persistence.entrySubject.subscribe({
      next: entry => this.entry = entry
    });
  }

  ngOnDestroy() {
    this.subscription$.unsubscribe();
  }

  goBack(): void {
    this.location.back();
  }

  submitEntry(): void {
    if (!this.entry) {
      return;
    }
    this.dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      disableClose: false
    });
    this.dialogRef.componentInstance.confirmMessage = `Are you sure you want to deposit the entry '${this.entry.depositionNickname}'?` +
      ' No changes are allowed after deposition via the BMRBdep interface. (You may continue to communicate changes after deposition via ' +
      ' the BMRB annotator assigned to your deposition, or by contacting help@bmrb.io".)';
    this.dialogRef.componentInstance.proceedMessage = 'Deposit';

    this.dialogRef.afterClosed().subscribe({
      next: result => {
        if (result) {
          // Submit the entry!
          this.lifecycle.depositEntry(this.messageControl.value).then();
        }
        this.dialogRef = null;
      }
    });
  }
}
