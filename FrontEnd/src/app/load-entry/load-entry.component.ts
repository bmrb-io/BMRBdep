import {Component, OnDestroy, OnInit} from '@angular/core';
import {ApiService} from '../api.service';
import {ActivatedRoute, Router} from '@angular/router';
import {combineLatest, Subscription} from 'rxjs';
import {map} from 'rxjs/operators';

@Component({
    selector: 'app-load-entry',
    templateUrl: './load-entry.component.html',
    styleUrls: ['./load-entry.component.css']
})
export class LoadEntryComponent implements OnInit, OnDestroy {

    subscription$: Subscription;
    constructor(private api: ApiService,
                private route: ActivatedRoute,
                private router: Router) {
    }

    ngOnInit() {
        const parent: LoadEntryComponent = this;

        this.subscription$ = combineLatest(this.route.params, this.api.entrySubject).pipe(
          map(results => {
            const entryID = results[0]['entry'];
            parent.api.loadEntry(entryID);

            // Wait for the specific entry we want to load
            if (results[1] && results[1].entryID === entryID) {
              if (results[1].emailValidated) {
                if (results[1].deposited) {
                  this.router.navigate(['/entry']);
                } else {
                  this.router.navigate(['/entry/', 'saveframe', results[1].firstIncompleteCategory]);
                }
              } else {
                this.router.navigate(['/entry', 'pending-verification']);
              }
            }
          })
        ).subscribe();
    }

    ngOnDestroy() {
        if (this.subscription$) {
            this.subscription$.unsubscribe();
        }
    }
}
