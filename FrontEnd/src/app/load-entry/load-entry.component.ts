import {Component, inject, OnDestroy, OnInit} from '@angular/core';
import {ApiService} from '../api.service';
import {ActivatedRoute, Router} from '@angular/router';
import {Subscription} from 'rxjs';

@Component({
  selector: 'app-load-entry',
  templateUrl: './load-entry.component.html',
  standalone: true,
  styleUrls: ['./load-entry.component.css']
})
export class LoadEntryComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);


  subscription$!: Subscription;
  subscription2$!: Subscription;

  ngOnInit() {
    const parent: LoadEntryComponent = this;

    this.subscription$ = this.route.params.subscribe({
      next: params => {
        parent.api.loadEntry(params['entry']);

        this.subscription2$ = this.api.entrySubject.subscribe(entry => {
          // Wait for the specific entry we want to load
          if (entry && entry.entryID === params['entry']) {
            if (entry.emailValidated) {
              if (entry.deposited) {
                this.router.navigate(['/entry']).then();
              } else {
                if (entry.firstIncompleteCategory) {
                  this.router.navigate(['/entry/', 'saveframe', entry.firstIncompleteCategory]).then();
                } else {
                  this.router.navigate(['/entry/', 'review']).then();
                }
              }
            } else {
              this.router.navigate(['/entry', 'pending-verification']).then();
            }
          }
        });
      }
    });
  }

  ngOnDestroy() {
    if (this.subscription$) {
      this.subscription$.unsubscribe();
    }
    if (this.subscription2$) {
      this.subscription2$.unsubscribe();
    }
  }
}
