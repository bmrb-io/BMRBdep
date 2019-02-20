import {Component, OnInit} from '@angular/core';
import {ApiService} from '../api.service';
import {Router} from '@angular/router';
import {Entry} from '../nmrstar/entry';

@Component({
    selector: 'app-pending-validation',
    templateUrl: './pending-validation.component.html',
    styleUrls: ['./pending-validation.component.css']
})
export class PendingValidationComponent implements OnInit {

    entry: Entry;
    constructor(private api: ApiService,
                private router: Router) {
    }

    ngOnInit() {
        const parent: PendingValidationComponent = this;
        this.api.entrySubject.subscribe(entry => {
            parent.entry = entry;
            // Route straight to the entry if validated
            if (entry && entry.emailValidated) {
                parent.router.navigate(['/entry/', 'saveframe', 'deposited_data_files']);
            }
        });

        // Check the validation status every 5 seconds
        const timer = setInterval(() => {
            parent.api.checkValid().subscribe(valid => {
                if (valid) {
                    clearInterval(timer);
                    parent.entry.emailValidated = true;
                    parent.api.saveEntry(true, true);
                    parent.router.navigate(['/entry/', 'saveframe', 'deposited_data_files']);
                }
            });
        }, 2500);
    }

    resendValidationEmail(): void {
        this.api.resendValidationEmail().subscribe();
    }
}
