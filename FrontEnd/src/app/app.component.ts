import {Component, OnDestroy, OnInit, AfterViewInit, ViewChild} from '@angular/core';
import {ApiService} from './api.service';
import {versions} from 'environments/versions';
import {Entry} from './nmrstar/entry';
import {Subscription} from 'rxjs';
import {SidenavService} from './sidenav.service';
import {MatSidenav} from '@angular/material/sidenav';
import {LoadingBarService} from '@ngx-loading-bar/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy, AfterViewInit {

  sidenav_open: boolean;
  entry: Entry;
  subscription$: Subscription;
  @ViewChild('sidenav') public sidenav: MatSidenav;

  constructor(private api: ApiService,
              private sidenavService: SidenavService,
              public loader: LoadingBarService) {
    this.sidenav_open = false;
  }

  ngOnInit() {
    console.info('Running git commit: ' + versions.branch + ':' + versions.revision +
      '. View commit on GitHub: https://github.com/uwbmrb/BMRBDep/commit/' + versions.revision);

    this.subscription$ = this.api.entrySubject.subscribe(entry => this.entry = entry);
  }

  ngAfterViewInit(): void {
    this.sidenavService.setSidenav(this.sidenav);
  }

  ngOnDestroy() {
    if (this.subscription$) {
      this.subscription$.unsubscribe();
    }
  }

  clearEntry(): void {
    this.api.clearDeposition();
  }
}
