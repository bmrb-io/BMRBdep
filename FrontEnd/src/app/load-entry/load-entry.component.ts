import {Component, OnInit} from '@angular/core';
import {ApiService} from '../api.service';
import {ActivatedRoute, Router} from '@angular/router';

@Component({
    selector: 'app-load-entry',
    templateUrl: './load-entry.component.html',
    styleUrls: ['./load-entry.component.css']
})
export class LoadEntryComponent implements OnInit {

    constructor(private api: ApiService,
                private route: ActivatedRoute,
                private router: Router) {
    }

    ngOnInit() {
        const parent: LoadEntryComponent = this;
        this.api.entrySubject.subscribe(entry => {
            if (entry) {
                if (entry.emailValidated) {
                    this.router.navigate(['/entry/', 'saveframe', 'deposited_data_files']);
                } else {
                    this.router.navigate(['/entry', 'pending-verification']);
                }
            }
        });

        this.route.params.subscribe(params => parent.api.loadEntry(params['entry']));
    }

}
