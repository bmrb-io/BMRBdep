import {Component, OnDestroy, OnInit} from '@angular/core';
import {UntypedFormControl, Validators} from '@angular/forms';
import {ApiService} from '../api.service';
import {Location} from '@angular/common';
import {Subscription} from 'rxjs';
import {Entry} from '../nmrstar/entry';

@Component({
  selector: 'app-support',
  templateUrl: './support.component.html',
  styleUrls: ['./support.component.scss']
})
export class SupportComponent implements OnInit, OnDestroy {

  messageControl = new UntypedFormControl('', [Validators.required]);
  emailControl = new UntypedFormControl('', [Validators.required]);
  submitted: boolean;
  entry: Entry;
  notificationMessage: string;
  subscription$: Subscription;
  caughtException: {};

  constructor(private api: ApiService,
              private location: Location) {
    this.submitted = false;
    this.notificationMessage = null;
    this.entry = null;
    this.caughtException = null;
  }

  ngOnInit() {
    this.subscription$ = this.api.entrySubject.subscribe(entry => this.entry = entry);

    if (history.state.data) {
      this.caughtException = history.state.data;
      this.messageControl = new UntypedFormControl('');
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
      supportMessage = `User reporting an exception.\nException URL: ${this.caughtException['url']}\nException message: ${this.caughtException['message']}\n`;
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

