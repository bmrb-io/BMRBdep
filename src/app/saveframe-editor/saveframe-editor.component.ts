import { ApiService } from '../api.service';
import { Entry } from '../nmrstar/entry';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { Saveframe } from '../nmrstar/saveframe';
import { Schema } from '../nmrstar/schema';
import { download } from '../nmrstar/nmrstar';
import { UiSwitchModule } from 'ngx-ui-switch';

@Component({
  selector: 'app-saveframe-editor',
  templateUrl: './saveframe-editor.component.html',
  styleUrls: ['./saveframe-editor.component.css']
})
export class SaveframeEditorComponent implements OnInit {
  saveframes: Saveframe[];
  showall: boolean;
  entry: Entry;
  saveframe_description: string;
  load_type: string;
  next_sf: string;
  prev_sf: string;

  constructor(private route: ActivatedRoute,
    private api: ApiService) {
    const sf = new Saveframe('', '', '', new Entry(''));
    const schem = new Schema({});
    sf.parent.schema = schem;
    this.saveframes = [sf];
    this.showall = true;
    this.entry = new Entry('');
    this.next_sf = null;
    this.prev_sf = null;
  }

  ngOnInit() {
    // Listen for the changing of the params string
    const parent = this;
    this.route.params.subscribe(function(params) {
      parent.load_type = params['load_type'];
      parent.saveframe_description = params['saveframe_description'];
      parent.loadEntry(params['entry']);
    });
  }

  loadEntry(entry: string) {
    const parent = this;
    parent.api.getEntry(entry)
      .subscribe(ret_entry => {
        parent.entry = ret_entry;
        this.reloadSaveframes();
      });
  }

  reloadSaveframes() {
    if (this.load_type === 'name') {
      this.saveframes = [this.entry.getSaveframeByName(this.saveframe_description)];
    } else if (this.load_type === 'category') {
      this.saveframes = this.entry.getSaveframesByCategory(this.saveframe_description);
    }
    this.updateCategoryLinks();
  }

  updateLoopData(event) {
    for (const sf of this.saveframes) {
      for (const loop of sf.loops) {
        loop.checkNull();
      }
    }
  }

  download(name: string, printable_object) {
    download(name, printable_object);
  }

  updateCategoryLinks() {
    let index = this.entry.saveframes.indexOf(this.saveframes[0]) - 1;
    if (index < 0 ) {
      this.prev_sf = null;
    } else {
      this.prev_sf =  this.entry.saveframes[index].category;
    }

    index = this.entry.saveframes.indexOf(this.saveframes[this.saveframes.length - 1]) + 1;
    if (index > this.entry.saveframes.length - 1 ) {
      this.next_sf = null;
    } else {
      this.next_sf =  this.entry.saveframes[index].category;
    }
  }

}
