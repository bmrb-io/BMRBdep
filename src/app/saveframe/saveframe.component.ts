import { ApiService } from '../api.service';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { Saveframe, DEMO, SaveframeTag } from '../nmrstar/nmrstar';
import { SaveframeTagComponent } from './saveframe-tag/saveframe-tag.component';
import { UiSwitchModule } from 'angular2-ui-switch';

@Component({
  selector: 'app-saveframe',
  templateUrl: './saveframe.component.html',
  styleUrls: ['./saveframe.component.css']
})
export class SaveframeComponent implements OnInit {
  saveframe_name: string;
  saveframe: Saveframe;
  showall: false;
  entry: String;
  saveframe_category: String;

  constructor(private route: ActivatedRoute,
              private api: ApiService) { }

  ngOnInit() {
    // Refresh the current SF name
    this.route.params.forEach(params => {
        this.saveframe_name = params['saveframe_name'];
    });

    this.saveframe = DEMO;
    this.entry = '15000';
    this.saveframe_category = 'entry_information';
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
