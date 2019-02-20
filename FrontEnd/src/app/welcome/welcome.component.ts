import {Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {Router} from '@angular/router';
import {ApiService} from '../api.service';
import {FormControl, FormGroup, Validators} from '@angular/forms';

@Component({
  selector: 'app-welcome',
  templateUrl: './welcome.component.html',
  styleUrls: ['./welcome.component.css']
})
export class WelcomeComponent implements OnInit {
  @ViewChild('inputFile') fileUploadElement: ElementRef;

  constructor(private router: Router, private api: ApiService) {
  }

  sessionType = new FormControl('', [Validators.required]);
  authorEmail = new FormControl('', [
    Validators.required,
    Validators.email,
  ]);
  depositionNickname = new FormControl('', [Validators.required]);
  authorORCID = new FormControl('', [Validators.pattern(/^\d{4}-\d{4}-\d{4}-(\d{3}X|\d{4})$/)]);
  bootstrapID = new FormControl('', [Validators.required, Validators.pattern(/^[0-9]+$/)]);

  createDepositionForm: FormGroup = new FormGroup({
    sessionType: this.sessionType,
    authorEmail: this.authorEmail,
    depositionNickname: this.depositionNickname,
    authorORCID: this.authorORCID,
  });

  getEmailErrorMessage(emailForm: FormControl) {
    return emailForm.hasError('required') ? 'You must enter your email address.' :
      emailForm.hasError('email') ? 'Not a valid email address.' : '';
  }

  getBootstrapErrorMessage(bootstrapForm: FormControl) {
    return bootstrapForm.hasError('required') ? 'You must enter the ID of an existing entry.' :
      bootstrapForm.hasError('pattern') ? 'Not a valid BMRB ID.' : '';
  }

  ngOnInit() {
  }

  // This is needed for angular to detect the file upload
  fileChangeEvent() {
  }

  new(f: FormGroup) {

    if (!f.valid) {
      return;
    }

    if (f.value.sessionType === 'bmrb_id' && !this.bootstrapID.value) {
      return;
    }

    let fileElement = null;
    if (f.value.sessionType === 'file') {
      fileElement = this.fileUploadElement.nativeElement.files[0];
    }

    this.api.newDeposition(f.value.authorEmail, f.value.depositionNickname, f.value.authorORCID, fileElement,
      this.bootstrapID.value).subscribe(
      response => {
        if (response) {
          this.router.navigate(['/entry/', response['deposition_id']]);
        }
      });

  }
}
