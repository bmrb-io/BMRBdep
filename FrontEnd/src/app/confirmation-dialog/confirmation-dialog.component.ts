import {Component} from '@angular/core';
import {MatDialogRef} from '@angular/material/dialog';

@Component({
  selector: 'app-confirmation-dialog',
  templateUrl: 'confirmation-dialog.component.html',
})
export class ConfirmationDialogComponent {
  public confirmMessage: string;
  public proceedMessage: string;
  public cancelMessage: string;

  constructor(public dialogRef: MatDialogRef<ConfirmationDialogComponent>) {
    this.proceedMessage = 'Proceed';
    this.cancelMessage = 'Cancel';
  }
}
