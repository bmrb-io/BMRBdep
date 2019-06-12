import {Component, OnInit} from '@angular/core';
import {FormControl, Validators} from '@angular/forms';
import {ApiService} from '../api.service';

@Component({
  selector: 'app-contact-us',
  templateUrl: './contact-us.component.html',
  styleUrls: ['./contact-us.component.css']
})
export class ContactUsComponent implements OnInit {

  messageControl = new FormControl('', [Validators.required]);
  submitted: boolean;
  notificationMessage: string;

  constructor(private api: ApiService) {
    this.submitted = false;
    this.notificationMessage = null;
  }

  ngOnInit() {
  }

  sendRequest() {
    this.api.newSupportRequest(this.messageControl.value).then(() => {
      this.messageControl.disable();
      this.notificationMessage = 'Your message has been sent to BMRB support.';
    }, () => {
      this.notificationMessage = 'An error happened when submitting your message. Please try again.';
    });
  }

}

