import {Component, OnDestroy, OnInit} from '@angular/core';
import {ApiService} from '../api.service';
import {MessagesService} from '../messages.service';
import {Location} from '@angular/common';
import {Entry} from '../nmrstar/entry';
import {ConfirmationDialogComponent} from '../confirmation-dialog/confirmation-dialog.component';
import {MatDialog, MatDialogRef} from '@angular/material';
import {Subscription} from 'rxjs';

@Component({
  selector: 'app-review',
  templateUrl: './review.component.html',
  styleUrls: ['./review.component.css']
})
export class ReviewComponent implements OnInit, OnDestroy {

  dialogRef: MatDialogRef<ConfirmationDialogComponent>;
  entry: Entry;
  subscription$: Subscription;

  constructor(private api: ApiService,
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
        ' No changes are allowed after deposition.';

    this.dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // Submit the entry!
        this.api.depositEntry().then();
      }
      this.dialogRef = null;
    });
  }
}
