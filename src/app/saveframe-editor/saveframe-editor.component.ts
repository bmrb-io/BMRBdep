import {ApiService} from '../api.service';
import {Entry} from '../nmrstar/entry';
import {Component, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {Saveframe} from '../nmrstar/saveframe';

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
              private router: Router,
              private api: ApiService) {
    this.saveframes = [];
  }

  ngOnInit() {
    // Listen for the changing of the params string
    const parent = this;
    this.route.params.subscribe(function (params) {
      parent.loadType = params['load_type'];
      parent.saveframeDescription = params['saveframe_description'];

      parent.api.getEntry(params['entry'])
        .subscribe(ret_entry => {
          parent.entry = ret_entry;
          parent.reloadSaveframes();
        });
    });
  }

  reloadSaveframes(nextCategory: string = null): void {
    if (this.loadType === 'name') {
      const theSaveframe = this.entry.getSaveframeByName(this.saveframeDescription);
      if (theSaveframe !== null) {
        this.saveframes = [theSaveframe];
      } else {
        this.saveframes = [];
      }
    } else if (this.loadType === 'category') {
      const allCategorySaveframes = this.entry.getSaveframesByCategory(this.saveframeDescription);
      this.saveframes = [];
      for (const saveframe of allCategorySaveframes) {
        if (!saveframe.deleted) {
          this.saveframes.push(saveframe);
        }
      }
    }

    // If there are no saveframes of the category we are trying to display, reroute
    if (nextCategory && this.saveframes.length === 0) {
      this.router.navigate(['/entry', this.entry.entryID, 'saveframe', nextCategory, 'category']);
    }

    this.entry.updateCategories();
  }

  restoreCategory(category: string): void {
    this.entry.restoreByCategory(category);
    this.entry.refresh();
    this.api.saveEntry();
    this.reloadSaveframes();
  }
}
