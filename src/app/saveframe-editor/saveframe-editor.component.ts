import {ApiService} from '../api.service';
import {Entry} from '../nmrstar/entry';
import {Component, OnInit} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {Saveframe} from '../nmrstar/saveframe';
import {Schema} from '../nmrstar/schema';

@Component({
  selector: 'app-saveframe-editor',
  templateUrl: './saveframe-editor.component.html',
  styleUrls: ['./saveframe-editor.component.css']
})
export class SaveframeEditorComponent implements OnInit {
  saveframes: Saveframe[];
  entry: Entry;
  saveframeDescription: string;
  loadType: string;

  constructor(private route: ActivatedRoute,
              private api: ApiService) {
    const sf = new Saveframe('', '', '', new Entry(''));
    sf.parent.schema = new Schema({});
    this.saveframes = [sf];
    this.entry = new Entry('');
  }

  ngOnInit() {
    // Listen for the changing of the params string
    const parent = this;
    this.route.params.subscribe(function (params) {
      parent.loadType = params['load_type'];
      parent.saveframeDescription = params['saveframe_description'];
      parent.loadEntry(params['entry']);
    });
  }

  loadEntry(entry: string): void {
    const parent = this;
    parent.api.getEntry(entry)
      .subscribe(ret_entry => {
        parent.entry = ret_entry;
        this.reloadSaveframes();
      });
  }

  reloadSaveframes(): void {
    if (this.loadType === 'name') {
      const theSaveframe = this.entry.getSaveframeByName(this.saveframeDescription);
      if (theSaveframe !== null) {
        this.saveframes = [theSaveframe];
      } else {
        this.saveframes = [];
      }
    } else if (this.loadType === 'category') {
      this.saveframes = this.entry.getSaveframesByCategory(this.saveframeDescription);
    }
    this.entry.updateCategories();
  }
}
