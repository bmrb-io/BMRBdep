import {Component, inject, OnDestroy, OnInit} from '@angular/core';
import {ApiService} from '../api.service';
import {Router} from '@angular/router';
import {Entry} from '../nmrstar/entry';
import {Subscription, timer} from 'rxjs';
import {MatCard, MatCardContent, MatCardHeader, MatCardTitle} from '@angular/material/card';
import {MatButton} from '@angular/material/button';

@Component({
  selector: 'app-pending-validation',
  templateUrl: './pending-validation.component.html',
  styleUrls: ['./pending-validation.component.css'],
  standalone: true,
  imports: [MatCard, MatCardHeader, MatCardTitle, MatCardContent, MatButton]
})
export class PendingValidationComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private router = inject(Router);


  entry: Entry | null = null;
  subscription$!: Subscription;

  ngOnInit() {
    this.subscription$ = this.api.entrySubject.subscribe({
      next: entry => {
        this.entry = entry;
        // Route straight to the entry if validated
        if (entry && entry.emailValidated) {
          if (entry.deposited) {
            this.router.navigate(['/entry']).then();
          } else if (entry.firstIncompleteCategory) {
            this.router.navigate(['/entry/', 'saveframe', entry.firstIncompleteCategory]).then();
          } else {
            this.router.navigate(['/entry/', 'review']).then();
          }
        }
      }
    });

    // Check the validation status every 2.5 seconds
    this.subscription$.add(timer(0, 2500).subscribe({
      next: () => {
        this.api.checkValidatedEmail().then(status => {
          if (status && this.entry) {
            this.entry.emailValidated = true;
            this.api.storeEntry(false);
            if (this.entry.deposited) {
              this.router.navigate(['/entry']).then();
            } else if (this.entry.firstIncompleteCategory) {
              this.router.navigate(['/entry/', 'saveframe', this.entry.firstIncompleteCategory]).then();
            } else {
              this.router.navigate(['/entry/', 'review']).then();
            }
          }
        });
      }
    }));
  }

  ngOnDestroy() {
    if (this.subscription$) {
      this.subscription$.unsubscribe();
    }
  }

  resendValidationEmail(): void {
    this.api.resendValidationEmail().subscribe();
  }
}
