import { ApiService } from '../api.service';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { Saveframe, DEMO, SaveframeTag } from '../nmrstar/nmrstar';
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
      console.log(params);
      parent.loadSaveframe(params['entry'], params['saveframe_category']);
      parent.entry = params['entry'];
      parent.saveframe_category = params['saveframe_category'];
    });

  }

  loadSaveframe(entry: string, saveframe: string) {

    const parent = this;

    this.api.getSaveframe(entry, saveframe)
      .subscribe(
        function(result) {
          const test: Saveframe = new Saveframe(result[entry][saveframe][0]['name'],
                                                result[entry][saveframe][0]['category'],
                                                result[entry][saveframe][0]['tag_prefix']);
          test.addTags(result[entry][saveframe][0]['tags']);
          window.h = test;
          parent.saveframe = test;
        }
    );
  }

}
