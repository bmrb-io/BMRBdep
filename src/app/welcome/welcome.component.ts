import {Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {Router} from '@angular/router';
import {ApiService} from '../api.service';

@Component({
  selector: 'app-welcome',
  templateUrl: './welcome.component.html',
  styleUrls: ['./welcome.component.css']
})
export class WelcomeComponent implements OnInit {
  authorEmail: string;
  depositionNickname: string;
  authorORCID: string;
  bootstrapID: string;
  sessionType: string;
  error: string;
  validResumeID: 'valid' | 'adit' | 'invalid';
  @ViewChild('inputFile') fileUploadElement: ElementRef;

  constructor(private router: Router, private api: ApiService) {
    this.authorEmail = '';
    this.depositionNickname = '';
    this.authorORCID = '';
    this.bootstrapID = null;
    this.error = '';
    this.sessionType = 'new';
  }

  ngOnInit() {
  }

  validate(sessionID): void {
    const regexp = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const aditRegexp = /[0-9]+-[0-9]+-[0-9]+(\.[\S]+)+\.[0-9]+\.[0-9]+/i;
    if (regexp.test(sessionID)) {
      this.validResumeID = 'valid';
    } else if (aditRegexp.test(sessionID)) {
      this.validResumeID = 'adit';
    } else {
      this.validResumeID = 'invalid';
    }
  }

  // This is needed for angular to detect the file upload
  fileChangeEvent() {}

  new() {
    let bootstrapID = this.bootstrapID;
    let fileElement = null;
    if (this.sessionType === 'file') {
      fileElement = this.fileUploadElement.nativeElement.files[0];
    } else if (this.sessionType === 'bmrb_id') {
      bootstrapID = this.bootstrapID;
    } else {

    }
    this.api.newDeposition(this.authorEmail, this.depositionNickname, this.authorORCID, fileElement, bootstrapID).subscribe(
      response => {
        if (response) {
          this.router.navigate(['/entry/', response['deposition_id'], 'saveframe', 'deposited_data_files', 'category']);
        }
      });
  }
}
