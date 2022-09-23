import {Component, ElementRef, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {Router} from '@angular/router';
import {ApiService} from '../api.service';
import {UntypedFormControl, UntypedFormGroup, Validators} from '@angular/forms';
import {Entry} from '../nmrstar/entry';
import {Subscription} from 'rxjs';
import {environment} from '../../environments/environment';
import {SidenavService} from '../sidenav.service';

@Component({
  selector: 'app-welcome',
  templateUrl: './welcome.component.html',
  styleUrls: ['./welcome.component.scss']
})
export class WelcomeComponent implements OnInit, OnDestroy {
  public entry: Entry;
  @ViewChild('inputFile') fileUploadElement: ElementRef;
  public skipEmailValidation: boolean;
  public emailValidationError: boolean;
  public production;
  private subscription$: Subscription;

  constructor(private router: Router,
              public api: ApiService,
              private sidenavService: SidenavService) {
    this.entry = null;
    this.skipEmailValidation = false;
    this.emailValidationError = false;
    this.production = environment.production;
  }

  sessionType = new UntypedFormControl('', [Validators.required]);
  authorEmail = new UntypedFormControl('', [
    Validators.required,
    Validators.email,
  ]);
  depositionNickname = new UntypedFormControl('', [Validators.required]);
  authorORCID = new UntypedFormControl('', [Validators.pattern(/^\d{4}-\d{4}-\d{4}-(\d{3}X|\d{4})$/)]);
  bootstrapID = new UntypedFormControl('', [Validators.required, Validators.pattern(/^[0-9]+$/)]);
  depositionType = new UntypedFormControl('macromolecule');

  createDepositionForm: UntypedFormGroup = new UntypedFormGroup({
    sessionType: this.sessionType,
    authorEmail: this.authorEmail,
    depositionNickname: this.depositionNickname,
    authorORCID: this.authorORCID,
    depositionType: this.depositionType
  });

  getEmailErrorMessage(emailForm: UntypedFormControl) {
    return emailForm.hasError('required') ? 'You must enter your email address.' :
      emailForm.hasError('email') ? 'Not a valid email address.' : '';
  }

  getBootstrapErrorMessage(bootstrapForm: UntypedFormControl) {
    return bootstrapForm.hasError('required') ? 'You must enter the ID of an existing entry.' :
      bootstrapForm.hasError('pattern') ? 'Not a valid BMRB ID. BMRB IDs consist only of numbers. (For example: 15000)' : '';
  }

  ngOnInit() {
    this.subscription$ = this.api.entrySubject.subscribe(entry => {
      this.entry = entry;
    });
  }

  ngOnDestroy() {
    this.subscription$.unsubscribe();
  }

  // This is needed for angular to detect the file upload
  fileChangeEvent() {
  }

  openInput() {
    this.fileUploadElement.nativeElement.click();
  }

  new(f: UntypedFormGroup) {

    if (!f.valid) {
      return;
    }

    let bootstrapID = null;
    if (f.value.sessionType === 'bmrb_id') {
      if (!this.bootstrapID.value) {
        return;
      }
      if (f.value.sessionType === 'bmrb_id') {
        bootstrapID = this.bootstrapID.value;
      }
    }

    let fileElement = null;
    if (f.value.sessionType === 'file') {
      fileElement = this.fileUploadElement.nativeElement.files[0];
    }

    this.api.clearDeposition();
    this.api.newDeposition(f.value.authorEmail, f.value.depositionNickname, f.value.depositionType, f.value.authorORCID,
      this.skipEmailValidation, fileElement, bootstrapID).then(
      deposition_id => {
        this.router.navigate(['/entry', 'load', deposition_id]).then(() => {
          this.sidenavService.open().then();
          location.reload();
        });
      }, error => {
        if (error === 'Invalid e-mail') {
          this.emailValidationError = true;
        }
      });
  }
}
