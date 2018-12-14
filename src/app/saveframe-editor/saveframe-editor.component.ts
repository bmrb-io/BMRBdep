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
  nextSaveframe: string;
  previousSaveframe: string;

  constructor(private route: ActivatedRoute,
              private api: ApiService) {
    const sf = new Saveframe('', '', '', new Entry(''));
    sf.parent.schema = new Schema({});
    this.saveframes = [sf];
    this.entry = new Entry('');
    this.nextSaveframe = null;
    this.previousSaveframe = null;
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
      this.saveframes = [this.entry.getSaveframeByName(this.saveframeDescription)];
    } else if (this.loadType === 'category') {
      this.saveframes = this.entry.getSaveframesByCategory(this.saveframeDescription);
    }
    this.updateCategoryLinks();
  }

  updateCategoryLinks(): void {

    if (!this.saveframes.length) {
      return;
    }

    let index = this.entry.saveframes.indexOf(this.saveframes[0]) - 1;
    while (index > 0 && ['Y', 'N'].indexOf(this.entry.saveframes[index].display) < 0 ||
           (!this.entry.showAll && this.entry.saveframes[index].display === 'N') ) {
      index--;
    }

    if (index <= 0) {
      this.previousSaveframe = null;
    } else {
      this.previousSaveframe = this.entry.saveframes[index].category;
    }


    index = this.entry.saveframes.indexOf(this.saveframes[this.saveframes.length - 1]) + 1;
    while (index <= this.entry.saveframes.length - 1 &&  ['Y', 'N'].indexOf(this.entry.saveframes[index].display) < 0 ||
           (!this.entry.showAll && this.entry.saveframes[index].display === 'N')) {
      index++;
    }
    if (index > this.entry.saveframes.length - 1) {
      this.nextSaveframe = null;
    } else {
      this.nextSaveframe = this.entry.saveframes[index].category;
    }
  }
}
