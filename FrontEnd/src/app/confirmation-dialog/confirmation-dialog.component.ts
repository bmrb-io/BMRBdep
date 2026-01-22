import {Component} from '@angular/core';
import {MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle} from '@angular/material/dialog';
import {MatFormField, MatLabel} from '@angular/material/select';
import {MatInput} from '@angular/material/input';
import {FormsModule} from '@angular/forms';
import {MatButton} from '@angular/material/button';

@Component({
  selector: 'app-confirmation-dialog',
  templateUrl: 'confirmation-dialog.component.html',
  styleUrls: ['./confirmation-dialog.component.scss'],
  standalone: true,
  imports: [MatDialogTitle, MatDialogContent, MatFormField, MatLabel, MatInput, FormsModule, MatDialogActions, MatButton]
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
