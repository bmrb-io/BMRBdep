import {Component, EventEmitter, OnDestroy, OnInit, Output} from '@angular/core';
import {ApiService} from '../api.service';
import {ActivatedRoute, Router} from '@angular/router';
import {download} from '../nmrstar/nmrstar';
import {Entry} from '../nmrstar/entry';
import {combineLatest, Subscription} from 'rxjs';
import {map} from 'rxjs/operators';
import {environment} from '../../environments/environment';

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
  @Output() sessionEnd = new EventEmitter<boolean>();
  subscription$: Subscription;

  constructor(private api: ApiService,
              private router: Router,
              private route: ActivatedRoute) {
    this.developerMode = !environment.production;
    console.log(environment);
    this.page = '?';
  }

  ngOnInit() {

    const parent = this;
    this.subscription$ = combineLatest([this.router.events, this.route.queryParams]).pipe(
      map(() => {
        let r = this.route;
        while (r.firstChild) {
          r = r.firstChild;
        }

        const urlSegments = this.router.url.split('/');

        if (urlSegments[2] === 'saveframe') {
          parent.active = urlSegments[3];
          parent.page = 'category';
        } else {
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

  endSession(): void {
    this.api.clearDeposition();
    this.sessionEnd.emit(true);
  }

  logEntry(): void {
    console.log(this.entry);
  }

  timeRefresh(): void {
    const iterations = 50;
    // tslint:disable-next-line:no-console
    console.time('Refresh');
    for (let i = 0; i < iterations; i++ ) {
      this.entry.refresh();
    }
    // tslint:disable-next-line:no-console
    console.timeEnd('Refresh');
  }

  refresh(): void {
    this.api.loadEntry(this.entry.entryID, true);
    this.entry.refresh();
    this.api.storeEntry(false);
    localStorage.setItem('entry', JSON.stringify(this.entry));
    localStorage.setItem('entryID', this.entry.entryID);
    localStorage.setItem('schema', JSON.stringify(this.entry.schema));
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
