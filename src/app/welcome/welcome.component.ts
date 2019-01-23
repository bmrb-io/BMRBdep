import {Component, ElementRef, OnInit, ViewChild} from '@angular/core';
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
  validResumeID: 'valid' | 'adit' | 'invalid';
  @ViewChild('inputFile') fileUploadElement: ElementRef;

  constructor(private router: Router, private api: ApiService) {
    this.sessionID = '';
    this.authorEmail = '';
    this.authorORCID = '';
    this.bootstrapID = null;
    this.error = '';
  }

  ngOnInit() {
  }

  validate(): void {
    const regexp = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const aditRegexp = /[0-9]+-[0-9]+-[0-9]+(\.[\S]+)+\.[0-9]+\.[0-9]+/i;
    if (regexp.test(this.sessionID)) {
      this.validResumeID = 'valid';
    } else if (aditRegexp.test(this.sessionID)) {
      this.validResumeID = 'adit';
    } else {
      this.validResumeID = 'invalid';
    }
  }

  fileChangeEvent() {
    this.bootstrapID = null;
  }

  new() {
    this.api.newDeposition(this.authorEmail, this.authorORCID, this.fileUploadElement.nativeElement.files[0],
      this.bootstrapID).subscribe(response => {
      if (response) {
        this.router.navigate(['/entry/', response['deposition_id'], 'saveframe', 'deposited_data_files', 'category']);
      }
    });
  }
}
