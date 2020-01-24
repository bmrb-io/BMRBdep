import {ApiService} from '../api.service';
import {Entry} from '../nmrstar/entry';
import {Component, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {Saveframe} from '../nmrstar/saveframe';
import {Subscription} from 'rxjs';

@Component({
  selector: 'app-saveframe-editor',
  templateUrl: './saveframe-editor.component.html',
  styleUrls: ['./saveframe-editor.component.css']
})
export class SaveframeEditorComponent implements OnInit, OnDestroy {
  saveframes: Saveframe[];
  entry: Entry;
  saveframeCategory: string;
  subscription$: Subscription;

  constructor(private route: ActivatedRoute,
              private router: Router,
              private api: ApiService) {
    this.saveframes = [];
  }

  ngOnInit() {

    this.subscription$ = this.api.entrySubject.subscribe(entry => {
      this.entry = entry;
      this.reloadSaveframes();
    });

    // Listen for the changing of the params string
    const parent = this;
    this.subscription$.add(this.route.params.subscribe(function (params) {
      parent.saveframeCategory = params['saveframe_category'];
      parent.reloadSaveframes();
    }));
  }

  ngOnDestroy() {
    if (this.subscription$) {
      this.subscription$.unsubscribe();
    }
  }

  reloadSaveframes(nextCategory: string = null): void {

    if (this.entry === null || !this.saveframeCategory) {
      this.saveframes = [];
      return;
    }

    const allCategorySaveframes = this.entry.getSaveframesByCategory(this.saveframeCategory);
    this.saveframes = [];
    for (const saveframe of allCategorySaveframes) {
      if (!saveframe.deleted) {
        this.saveframes.push(saveframe);
      }
    }

    // If there are no saveframes of the category we are trying to display, reroute
    if (nextCategory && this.saveframes.length === 0) {
      this.router.navigate(['/entry', 'saveframe', nextCategory]).then();
    }

    this.entry.updateCategories();
  }

  restoreCategory(category: string): void {
    this.entry.restoreByCategory(category);
    this.entry.refresh();
    this.api.storeEntry(true);
    this.reloadSaveframes();
  }
}
