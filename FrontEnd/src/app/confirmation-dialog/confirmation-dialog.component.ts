import {Component} from '@angular/core';
import {MatDialogRef} from '@angular/material/dialog';

@Component({
  selector: 'app-confirmation-dialog',
  templateUrl: 'confirmation-dialog.component.html',
  styleUrls: ['./confirmation-dialog.component.scss']
})
export class ConfirmationDialogComponent {
  public confirmMessage: string;
  public proceedMessage: string;
  public cancelMessage: string;
  public inputBoxText: string;
  public name: string;

  constructor(public dialogRef: MatDialogRef<ConfirmationDialogComponent>) {
    this.proceedMessage = 'Proceed';
    this.cancelMessage = 'Cancel';
    this.inputBoxText = null;
  }
}
