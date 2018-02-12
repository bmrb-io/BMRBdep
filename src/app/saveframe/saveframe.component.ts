import { ApiService } from '../api.service';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { Saveframe } from '../nmrstar/nmrstar';
import { UiSwitchModule } from 'angular2-ui-switch';

@Component({
  selector: 'app-saveframe',
  templateUrl: './saveframe.component.html',
  styleUrls: ['./saveframe.component.css']
})
export class SaveframeComponent implements OnInit {
  saveframe: Saveframe;
  showall: false;
  entry: string;
  saveframe_category: string;

  constructor(private route: ActivatedRoute,
              private api: ApiService) {
    this.saveframe = new Saveframe('', '', '');
  }

  ngOnInit() {
    // Refresh the current SF name


    // Listen for the changing of the params string
    const parent = this;
    this.route.params.subscribe(function(params) {
      parent.loadSaveframe(params['entry'], params['saveframe_category']);
    });
  }

  loadSaveframe(entry: string, saveframe_category: string) {

    const parent = this;
    parent.api.getSaveframe(entry, saveframe_category)
      .subscribe(
        sf => parent.saveframe = sf,
        error => alert('Error :: ' + error)
      );
    parent.entry = entry;
    parent.saveframe_category = saveframe_category;
  }

}
