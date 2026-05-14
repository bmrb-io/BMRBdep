import {ApiService} from '../api.service';
import {Entry} from '../nmrstar/entry';
import {Component, inject, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {Saveframe} from '../nmrstar/saveframe';
import {Subscription} from 'rxjs';
import {MatButton} from '@angular/material/button';
import {MatTooltip} from '@angular/material/tooltip';
import {SaveframeComponent} from '../saveframe/saveframe.component';
import {MatCard, MatCardActions, MatCardContent, MatCardTitle} from '@angular/material/card';

@Component({
  selector: 'app-saveframe-editor',
  templateUrl: './saveframe-editor.component.html',
  styleUrls: ['./saveframe-editor.component.css'],
  standalone: true,
  imports: [MatButton, MatTooltip, RouterLink, SaveframeComponent, MatCard, MatCardTitle, MatCardContent, MatCardActions]
})
export class SaveframeEditorComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ApiService);

  saveframes: Saveframe[];
  entry: Entry | null = null;
  saveframeCategory: string = '';
  subscription$!: Subscription;

  constructor() {
    this.saveframes = [];
  }

  ngOnInit() {

    this.subscription$ = this.api.entrySubject.subscribe({
      next: entry => {
        this.entry = entry;
        this.reloadSaveframes();
      }
    });

    // Listen for the changing of the params string
    const parent = this;
    this.subscription$.add(this.route.params.subscribe({
      next: function (params) {
        parent.saveframeCategory = params['saveframe_category'];
        parent.reloadSaveframes();
      }
    }));
  }

  ngOnDestroy() {
    if (this.subscription$) {
      this.subscription$.unsubscribe();
    }
  }

  reloadSaveframes(nextCategory: string | null = null): void {

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
    if (!this.entry) {
      return;
    }
    this.entry.restoreByCategory(category);
    this.entry.refresh();
    this.api.storeEntry(true);
    this.reloadSaveframes();
  }
}
