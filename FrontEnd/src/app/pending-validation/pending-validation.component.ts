import {Component, OnInit} from '@angular/core';
import {ApiService} from '../api.service';
import {ActivatedRoute, Router} from '@angular/router';

@Component({
    selector: 'app-pending-validation',
    templateUrl: './pending-validation.component.html',
    styleUrls: ['./pending-validation.component.css']
})
export class PendingValidationComponent implements OnInit {

    constructor(public api: ApiService,
                private route: ActivatedRoute,
                private router: Router) {
    }

    ngOnInit() {
        const parent = this;
        this.route.params.subscribe(function (params) {
            parent.api.getEntry(params['entry'], true).subscribe(() => {
                if (parent.api.cachedEntry.emailValidated) {
                    parent.router.navigate(['/entry/', parent.api.cachedEntry.entryID, 'saveframe', 'deposited_data_files', 'category']);
                }
            });
        });
        setTimeout(() => {
            localStorage.removeItem('entry_key');
            localStorage.removeItem('entry');
            localStorage.removeItem('schema');
            window.location.reload();
        }, 30000);
    }

    resendValidationEmail(): void {
        this.api.resendValidationEmail().subscribe();
    }
}
