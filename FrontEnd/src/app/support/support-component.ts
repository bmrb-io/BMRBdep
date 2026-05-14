import {Component, inject, OnDestroy, OnInit} from '@angular/core';
import {FormControl, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {ApiService} from '../api.service';
import {Location} from '@angular/common';
import {Subscription} from 'rxjs';
import {Entry} from '../nmrstar/entry';
import {MatCard, MatCardContent, MatCardHeader, MatCardTitle} from '@angular/material/card';
import {MatFormField} from '@angular/material/select';
import {MatInput} from '@angular/material/input';
import {MatButton} from '@angular/material/button';

@Component({
  selector: 'app-support',
  templateUrl: './support.component.html',
  styleUrls: ['./support.component.scss'],
  standalone: true,
  imports: [MatCard, MatCardHeader, MatCardTitle, MatCardContent, MatFormField, MatInput, FormsModule, ReactiveFormsModule, MatButton]
})
export class SupportComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private location = inject(Location);


  messageControl = new FormControl<string>('', {nonNullable: true, validators: [Validators.required]});
  emailControl = new FormControl<string>('', {nonNullable: true, validators: [Validators.required]});
  submitted: boolean;
  entry: Entry | null;
  notificationMessage: string | null;
  subscription$!: Subscription;
  caughtException: { url?: string; message?: string } | null;

  constructor() {
    this.submitted = false;
    this.notificationMessage = null;
    this.entry = null;
    this.caughtException = null;
  }

  ngOnInit() {
    this.subscription$ = this.api.entrySubject.subscribe({
      next: entry => this.entry = entry
    });

    if (history.state.data) {
      this.caughtException = history.state.data;
      this.messageControl = new FormControl<string>('', {nonNullable: true});
    }
  }

  ngOnDestroy() {
    if (this.subscription$) {
      this.subscription$.unsubscribe();
    }
  }

  sendRequest() {
    let supportMessage = this.messageControl.value;
    if (this.caughtException) {
      supportMessage = `User reporting an exception.\nException URL: ${this.caughtException.url}\nException message: ${this.caughtException.message}\n`;
      if (this.messageControl.value) {
        supportMessage += 'User message: ' + this.messageControl.value;
      }
    }
    this.api.newSupportRequest(supportMessage, undefined, this.emailControl.value).then(() => {
      this.messageControl.disable();
      this.notificationMessage = 'Your message has been sent to BMRB support.';
    }, () => {
      this.notificationMessage = 'An error happened when submitting your message. Please try again.';
    });
  }

  goBack(): void {
    this.location.back();
  }

}

