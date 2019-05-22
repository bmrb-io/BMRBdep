import {Component, OnDestroy, OnInit} from '@angular/core';
import {ApiService} from '../api.service';
import {Router} from '@angular/router';
import {Entry} from '../nmrstar/entry';
import {Subscription, timer} from 'rxjs';

@Component({
    selector: 'app-pending-validation',
    templateUrl: './pending-validation.component.html',
    styleUrls: ['./pending-validation.component.css']
})
export class PendingValidationComponent implements OnInit, OnDestroy {

    entry: Entry;
    subscription$: Subscription;

    constructor(private api: ApiService,
                private router: Router) {
    }

    ngOnInit() {
        const parent: PendingValidationComponent = this;
        this.subscription$ = this.api.entrySubject.subscribe(entry => {
            parent.entry = entry;
            // Route straight to the entry if validated
            if (entry && entry.emailValidated) {
                if (entry.firstIncompleteCategory) {
                    parent.router.navigate(['/entry/', 'saveframe', entry.firstIncompleteCategory]);
                } else {
                    parent.router.navigate(['/entry/', 'review']);
                }
            }
        });

        // Check the validation status every 2.5 seconds
        this.subscription$.add(timer(0, 2500).subscribe(() => {
            parent.api.checkValid().then(status => {
                if (status) {
                    parent.entry.emailValidated = true;
                    parent.api.saveEntry(true, true);
                    if (parent.entry.firstIncompleteCategory) {
                        parent.router.navigate(['/entry/', 'saveframe', parent.entry.firstIncompleteCategory]);
                    } else {
                        parent.router.navigate(['/entry/', 'review']);
                    }
                }
            });
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
