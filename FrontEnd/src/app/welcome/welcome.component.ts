import {Component, ElementRef, inject, ViewChild} from '@angular/core';
import {Router, RouterLink} from '@angular/router';
import {DepositionLifecycleService} from '../deposition-lifecycle.service';
import {AuthService} from '../auth.service';
import {FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {environment} from '../../environments/environment';
import {SidenavService} from '../sidenav.service';
import {MatButton} from '@angular/material/button';
import {MatError, MatFormField, MatOption, MatSelect} from '@angular/material/select';
import {MatInput} from '@angular/material/input';
import {MatCheckbox} from '@angular/material/checkbox';

@Component({
  selector: 'app-welcome',
  templateUrl: './welcome.component.html',
  styleUrls: ['./welcome.component.scss'],
  standalone: true,
  imports: [MatButton, RouterLink, FormsModule, ReactiveFormsModule, MatFormField, MatSelect, MatOption, MatError, MatInput, MatCheckbox]
})
export class WelcomeComponent {
  private router = inject(Router);
  lifecycle = inject(DepositionLifecycleService);
  private auth = inject(AuthService);
  private sidenavService = inject(SidenavService);

  @ViewChild('inputFile') fileUploadElement!: ElementRef;
  public skipEmailValidation: boolean;
  public emailValidationError: boolean;
  public production: boolean;

  constructor() {
    this.skipEmailValidation = false;
    this.emailValidationError = false;
    this.production = environment.production;
  }

  sessionType = new FormControl<string>('', {nonNullable: true, validators: [Validators.required]});
  authorEmail = new FormControl<string>('', {
    nonNullable: true,
    validators: [Validators.required, Validators.email],
  });
  depositionNickname = new FormControl<string>('', {nonNullable: true, validators: [Validators.required]});
  authorORCID = new FormControl<string>('', {nonNullable: true, validators: [Validators.pattern(/^\d{4}-\d{4}-\d{4}-(\d{3}X|\d{4})$/)]});
  bootstrapID = new FormControl<string>('', {nonNullable: true, validators: [Validators.required, Validators.pattern(/^[0-9]+$/)]});
  depositionType = new FormControl<string>('macromolecule', {nonNullable: true});
  resumeEmail = new FormControl<string>('', {nonNullable: true, validators: [Validators.required, Validators.email]});

  createDepositionForm = new FormGroup({
    sessionType: this.sessionType,
    authorEmail: this.authorEmail,
    depositionNickname: this.depositionNickname,
    authorORCID: this.authorORCID,
    depositionType: this.depositionType
  });

  getEmailErrorMessage(emailForm: FormControl<string>) {
    return emailForm.hasError('required') ? 'You must enter your email address.' :
      emailForm.hasError('email') ? 'Not a valid email address.' : '';
  }

  getBootstrapErrorMessage(bootstrapForm: FormControl<string>) {
    return bootstrapForm.hasError('required') ? 'You must enter the ID of an existing entry.' :
      bootstrapForm.hasError('pattern') ? 'Not a valid BMRB ID. BMRB IDs consist only of numbers. (For example: 15000)' : '';
  }

  // No-op handler so Angular re-runs change detection when a file is picked,
  // refreshing the @if blocks that read #inputFile.files in the template.
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  fileChangeEvent() {}

  openInput() {
    this.fileUploadElement.nativeElement.click();
  }

  new(f: typeof this.createDepositionForm) {

    if (!f.valid) {
      return;
    }

    const values = f.getRawValue();

    let bootstrapID: string | null = null;
    if (values.sessionType === 'bmrb_id') {
      if (!this.bootstrapID.value) {
        return;
      }
      bootstrapID = this.bootstrapID.value;
    }

    let fileElement: File | null = null;
    if (values.sessionType === 'file') {
      fileElement = this.fileUploadElement.nativeElement.files[0];
    }

    this.lifecycle.newDeposition(values.authorEmail, values.depositionNickname, values.depositionType, values.authorORCID,
      this.skipEmailValidation, fileElement, bootstrapID).then(
      deposition_id => {
        this.router.navigate(['/entry', 'load', deposition_id]).then(() => {
          this.sidenavService.open().then();
        });
      }, error => {
        if (error === 'Invalid e-mail') {
          this.emailValidationError = true;
        }
      });
  }

  requestEmailAccess() {
    if (this.resumeEmail.valid) {
      this.auth.sendEmailAccessToken(this.resumeEmail.value).then();
    }
  }
}
