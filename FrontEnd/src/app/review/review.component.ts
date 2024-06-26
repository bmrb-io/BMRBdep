import {Component, OnDestroy, OnInit} from '@angular/core';
import {ApiService} from '../api.service';
import {MessagesService} from '../messages.service';
import {Location} from '@angular/common';
import {Entry} from '../nmrstar/entry';
import {ConfirmationDialogComponent} from '../confirmation-dialog/confirmation-dialog.component';
import {MatLegacyDialog as MatDialog, MatLegacyDialogRef as MatDialogRef} from '@angular/material/legacy-dialog';
import {Subscription} from 'rxjs';
import {UntypedFormControl} from '@angular/forms';

@Component({
  selector: 'app-review',
  templateUrl: './review.component.html',
  styleUrls: ['./review.component.css']
})
export class ReviewComponent implements OnInit, OnDestroy {
  dialogRef: MatDialogRef<ConfirmationDialogComponent>;
  entry: Entry;
  subscription$: Subscription;
  messageControl = new UntypedFormControl('');

  constructor(public api: ApiService,
              private messagesService: MessagesService,
              private location: Location,
              private dialog: MatDialog) {
  }

  ngOnInit() {
    this.subscription$ = this.api.entrySubject.subscribe(entry => this.entry = entry);
  }

  ngOnDestroy() {
    this.subscription$.unsubscribe();
  }

  goBack(): void {
    this.location.back();
  }

  submitEntry(): void {
    this.dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      disableClose: false
    });
    this.dialogRef.componentInstance.confirmMessage = `Are you sure you want to deposit the entry '${this.entry.depositionNickname}'?` +
      ' No changes are allowed after deposition via the BMRBdep interface. (You may continue to communicate changes after deposition via ' +
      ' the BMRB annotator assigned to your deposition, or by contacting help@bmrb.io".)';
    this.dialogRef.componentInstance.proceedMessage = 'Deposit';

    this.dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // Submit the entry!
        this.api.depositEntry(this.messageControl.value).then();
      }
      this.dialogRef = null;
    });
  }
}
