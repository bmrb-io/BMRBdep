import { Component, OnInit } from '@angular/core';
import {Router} from '@angular/router';
import {ApiService} from '../api.service';

@Component({
  selector: 'app-welcome',
  templateUrl: './welcome.component.html',
  styleUrls: ['./welcome.component.css']
})
export class WelcomeComponent implements OnInit {
  session_id: string;
  author_email: string;
  author_orcid: string;
  error: string;

  constructor(private router: Router, private api: ApiService) {
    this.session_id = '';
    this.author_email = '';
    this.author_orcid = '';
    this.error = '';
  }

  ngOnInit() {
  }

  validate() {
      const regexp = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      return regexp.test(this.session_id);
  }

  new() {
    this.api.newDeposition(this.author_email, this.author_orcid).subscribe(response => {
      if (response) {
        this.router.navigate(['/entry/', response['deposition_id']]);
      }
    });
  }
}
