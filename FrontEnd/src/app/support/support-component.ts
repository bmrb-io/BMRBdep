import {Component, OnDestroy, OnInit} from '@angular/core';
import {FormControl, Validators} from '@angular/forms';
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

  messageControl = new FormControl('', [Validators.required]);
  emailControl = new FormControl('', [Validators.required]);
  submitted: boolean;
  entry: Entry;
  notificationMessage: string;
  subscription$: Subscription;

  constructor(private api: ApiService,
              private location: Location) {
    this.submitted = false;
    this.notificationMessage = null;
    this.entry = null;
  }

  ngOnInit() {
    this.subscription$ = this.api.entrySubject.subscribe(entry => this.entry = entry);
  }

  ngOnDestroy() {
    if (this.subscription$) {
      this.subscription$.unsubscribe();
    }
  }

  sendRequest() {
    this.api.newSupportRequest(this.messageControl.value, undefined, this.emailControl.value).then(() => {
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

