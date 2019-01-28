import {Component, OnInit} from '@angular/core';
import {ApiService} from '../api.service';
import {ActivatedRoute} from '@angular/router';

@Component({
  selector: 'app-restore',
  templateUrl: './restore.component.html',
  styleUrls: ['./restore.component.css']
})
export class RestoreComponent implements OnInit {

  constructor(private route: ActivatedRoute,
              public api: ApiService) {
  }

  ngOnInit() {
    const parent = this;
    this.route.params.subscribe(function (params) {
      parent.api.getEntry(params['entry']).subscribe();
    });
  }

}
