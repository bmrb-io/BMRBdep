import {Component, EventEmitter, inject, OnDestroy, OnInit, Output} from '@angular/core';
import {ApiService} from '../api.service';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {download} from '../nmrstar/nmrstar';
import {Entry} from '../nmrstar/entry';
import {combineLatest, Subscription} from 'rxjs';
import {map} from 'rxjs/operators';
import {MatCard, MatCardContent, MatCardTitle} from '@angular/material/card';
import {MatDivider, MatListItem, MatNavList} from '@angular/material/list';
import {MatLine} from '@angular/material/core';
import {MatTooltip} from '@angular/material/tooltip';
import {MatIcon} from '@angular/material/icon';
import {NgClass} from '@angular/common';
import {MatSlideToggle} from '@angular/material/slide-toggle';
import {FormsModule} from '@angular/forms';

@Component({
  selector: 'app-tree-view',
  templateUrl: './tree-view.component.html',
  styleUrls: ['./tree-view.component.css'],
  standalone: true,
  imports: [MatCard, MatCardTitle, MatCardContent, MatNavList, MatLine, MatTooltip, MatIcon, RouterLink, MatDivider, MatListItem, NgClass, MatSlideToggle, FormsModule]
})
export class TreeViewComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  active: string = '';
  developerMode: boolean;
  entry: Entry | null = null;
  page: string;
  @Output() sessionEnd = new EventEmitter<boolean>();
  subscription$!: Subscription;

  constructor() {
    this.developerMode = false;
    this.page = '?';
  }

  ngOnInit() {

    this.subscription$ = combineLatest([this.router.events, this.route.queryParams]).pipe(
      map(() => {
        let r = this.route;
        while (r.firstChild) {
          r = r.firstChild;
        }

        const urlSegments = this.router.url.split('/');

        if (urlSegments[2] === 'saveframe') {
          this.active = urlSegments[3];
          this.page = 'category';
        } else {
          this.page = urlSegments[urlSegments.length - 1];
          if (this.page === '') {
            this.page = 'new';
          }
        }
      })
    ).subscribe();

    this.subscription$.add(this.api.entrySubject.subscribe({
      next: entry => this.entry = entry
    }));
  }

  ngOnDestroy() {
    if (this.subscription$) {
      this.subscription$.unsubscribe();
    }
  }

  download(name: string, printable_object: Entry): void {
    download(name, printable_object);
  }

  endSession(): void {
    this.api.clearDeposition();
    this.sessionEnd.emit(true);
  }

  logEntry(): void {
    console.log(this.entry);
  }

  timeRefresh(): void {
    if (!this.entry) {
      return;
    }
    const iterations = 50;
    console.time('Refresh');
    for (let i = 0; i < iterations; i++) {
      this.entry.refresh();
    }
    console.timeEnd('Refresh');
  }

  refresh(): void {
    if (!this.entry) {
      return;
    }
    this.api.loadEntry(this.entry.entryID, true);
    this.entry.refresh();
    this.api.storeEntry(false);
  }

  scrollSideNav(): void {
    let element: HTMLElement | null;
    if (this.page === 'category') {
      element = document.getElementById(this.active);
    } else {
      element = document.getElementById(this.page);
    }
    if (element && element.parentElement) {
      element.parentElement.scrollIntoView({behavior: 'smooth'});
    }
  }
}
