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

  validate() {
    const regexp = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return regexp.test(this.sessionID);
  }

  fileChangeEvent() {
    this.bootstrapID = null;
    console.log(this.fileUploadElement.nativeElement.files[0]);
  }

  new() {
    this.api.newDeposition(this.authorEmail, this.authorORCID, this.fileUploadElement.nativeElement.files[0], this.bootstrapID).subscribe(response => {
      if (response) {
        this.router.navigate(['/entry/', response['deposition_id'], 'saveframe', 'deposited_data_files', 'category']);
      }
    });
  }
}
