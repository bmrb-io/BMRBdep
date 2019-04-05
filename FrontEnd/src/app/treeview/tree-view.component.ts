import {Component, EventEmitter, OnDestroy, OnInit, Output} from '@angular/core';
import {ApiService} from '../api.service';
import {ActivatedRoute, Router} from '@angular/router';
import {download} from '../nmrstar/nmrstar';
import {Entry} from '../nmrstar/entry';
import {Subscription} from 'rxjs';
import {combineLatest} from 'rxjs/internal/observable/combineLatest';
import {map} from 'rxjs/operators';

@Component({
  selector: 'app-tree-view',
  templateUrl: './tree-view.component.html',
  styleUrls: ['./tree-view.component.css']
})
export class TreeViewComponent implements OnInit, OnDestroy {
  active: string;
  developerMode: boolean;
  entry: Entry;
  page: string;
  showInvalidOnly: boolean;
  @Output() sessionEnd = new EventEmitter<boolean>();
  subscription$: Subscription;

  constructor(private api: ApiService,
              private router: Router,
              private route: ActivatedRoute) {
    this.developerMode = false;
    this.page = '?';
    this.showInvalidOnly = false;
  }

  ngOnInit() {

    const parent = this;
    this.subscription$ = combineLatest(this.router.events, this.route.queryParams).pipe(
      map(results => {
        let r = this.route;
        while (r.firstChild) {
          r = r.firstChild;
        }

        if (results[1]['saveframe_category'] !== undefined) {
          parent.active = results[1]['saveframe_category'];
          parent.page = 'category';
        } else {
          const urlSegments = this.router.url.split('/');
          parent.page = urlSegments[urlSegments.length - 1];
          if (parent.page === '') {
            parent.page = 'new';
          }
        }
      })
    ).subscribe();

    this.subscription$.add(this.api.entrySubject.subscribe(entry => this.entry = entry));
  }

  ngOnDestroy() {
    if (this.subscription$) {
      this.subscription$.unsubscribe();
    }
  }

  download(name: string, printable_object): void {
    download(name, printable_object);
  }

  logEntry(): void {
    console.log(this.entry);
  }

  endSession(): void {
    this.api.clearDeposition();
    this.sessionEnd.emit(true);
  }

  refresh(): void {
    this.api.loadEntry(this.entry.entryID);
  }

  scrollSideNav(): void {
    let element: HTMLElement;
    if (this.page === 'category') {
      element = document.getElementById(this.active);
    } else {
      element = document.getElementById(this.page);
    }
    if (element) {
      element.parentElement.scrollIntoView({behavior: 'smooth'});
    }
  }
}
