import {Component, OnInit} from '@angular/core';
import {ApiService} from '../api.service';
import {ActivatedRoute, Router} from '@angular/router';
import {Entry} from '../nmrstar/entry';

@Component({
    selector: 'app-pending-validation',
    templateUrl: './pending-validation.component.html',
    styleUrls: ['./pending-validation.component.css']
})
export class PendingValidationComponent implements OnInit {

    entry: Entry;
    constructor(private api: ApiService,
                private route: ActivatedRoute,
                private router: Router) {
    }

    ngOnInit() {
        const parent: PendingValidationComponent = this;
        this.api.entrySubject.subscribe(entry => {
            this.entry = entry;
            if (entry.emailValidated) {
                parent.router.navigate(['/entry/', parent.entry.entryID, 'saveframe', 'deposited_data_files', 'category']);
            }
        });

        this.route.params.subscribe(function (params) {
            parent.api.loadEntry(params['entry'], true);
        });
    }

    resendValidationEmail(): void {
        this.api.resendValidationEmail().subscribe();
    }
}
