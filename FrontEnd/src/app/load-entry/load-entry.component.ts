import {Component, OnDestroy, OnInit} from '@angular/core';
import {ApiService} from '../api.service';
import {ActivatedRoute, Router} from '@angular/router';
import {Subscription} from 'rxjs';

@Component({
    selector: 'app-load-entry',
    templateUrl: './load-entry.component.html',
    styleUrls: ['./load-entry.component.css']
})
export class LoadEntryComponent implements OnInit, OnDestroy {

    loadingID: string;
    subscription$: Subscription;
    constructor(private api: ApiService,
                private route: ActivatedRoute,
                private router: Router) {
    }

    ngOnInit() {
        const parent: LoadEntryComponent = this;

        this.subscription$ = this.route.params.subscribe(params => {
          parent.api.loadEntry(params['entry']);
          parent.loadingID = params['entry'];
        });

        // TODO: Chain these two subscriptions together - theoretically this subscription could return before the previous one and
        // then the code would fail
        this.subscription$.add(this.api.entrySubject.subscribe(entry => {
            if (entry && parent.loadingID === entry.entryID) {
                if (entry.emailValidated) {
                    if (entry.deposited) {
                        this.router.navigate(['/entry']);
                    } else {
                        this.router.navigate(['/entry/', 'saveframe', entry.firstIncompleteCategory]);
                    }

                } else {
                    this.router.navigate(['/entry', 'pending-verification']);
                }
            }
        }));
    }

    ngOnDestroy() {
        if (this.subscription$) {
            this.subscription$.unsubscribe();
        }
    }
}
