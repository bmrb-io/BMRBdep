import {Component, OnDestroy, OnInit} from '@angular/core';
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
  entry: Entry;
  subscription$: Subscription;
  emailValidationError: boolean;
  public production;

  constructor(private router: Router,
              public api: ApiService,
              private sidenavService: SidenavService) {
    this.entry = null;
    this.emailValidationError = false;
    this.production = environment.production;
  }

  authorEmail = new UntypedFormControl('', [
    Validators.required,
    Validators.email,
  ]);
  depositionNickname = new UntypedFormControl('', [Validators.required]);
  authorORCID = new UntypedFormControl('', [Validators.required, Validators.pattern(/^\d{4}-\d{4}-\d{4}-(\d{3}X|\d{4})$/)]);
  sessionVisibility = new UntypedFormControl('', [Validators.required]);

  createDepositionForm: UntypedFormGroup = new UntypedFormGroup({
    authorEmail: this.authorEmail,
    depositionNickname: this.depositionNickname,
    authorORCID: this.authorORCID,
  });

  getEmailErrorMessage(emailForm: UntypedFormControl) {
    return emailForm.hasError('required') ? 'You must enter your email address.' :
      emailForm.hasError('email') ? 'Not a valid email address.' : '';
  }

  ngOnInit() {
    this.subscription$ = this.api.entrySubject.subscribe(entry => {
      this.entry = entry;
    });
  }

  ngOnDestroy() {
    this.subscription$.unsubscribe();
  }

  new(f: UntypedFormGroup) {

    if (!f.valid) {
      return;
    }

    this.api.clearDeposition();
    this.api.newDeposition(f.value.authorEmail, f.value.depositionNickname, f.value.authorORCID, 'public').then(
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
