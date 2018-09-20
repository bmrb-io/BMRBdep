import { Component, OnInit } from '@angular/core';
import {Router} from '@angular/router';
import {ApiService} from '../api.service';

@Component({
  selector: 'app-welcome',
  templateUrl: './welcome.component.html',
  styleUrls: ['./welcome.component.css']
})
export class WelcomeComponent implements OnInit {
  sessionID: string;
  authorEmail: string;
  authorORCID: string;
  bootstrapID: string;
  error: string;

  constructor(private router: Router, private api: ApiService) {
    this.sessionID = '';
    this.authorEmail = '';
    this.authorORCID = '';
    this.bootstrapID = '';
    this.error = '';
  }

  ngOnInit() {
  }

  validate() {
      const regexp = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      return regexp.test(this.sessionID);
  }

  new() {
    this.api.newDeposition(this.authorEmail, this.authorORCID).subscribe(response => {
      if (response) {
        this.router.navigate(['/entry/', response['deposition_id'], 'saveframe', 'deposited_data_files', 'category']);
      }
    });
  }
}
