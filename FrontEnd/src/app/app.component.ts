import {AfterViewInit, Component, inject, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {DepositionPersistenceService, OpenDepositionView} from './deposition-persistence.service';
import {versions} from 'environments/versions';
import {Entry} from './nmrstar/entry';
import {Subscription} from 'rxjs';
import {SidenavService} from './sidenav.service';
import {MatSidenav, MatSidenavContainer, MatSidenavContent} from '@angular/material/sidenav';
import {LoadingBarService} from '@ngx-loading-bar/core';
import {MatToolbar, MatToolbarRow} from '@angular/material/toolbar';
import {AsyncPipe, NgClass} from '@angular/common';
import {MatTooltip} from '@angular/material/tooltip';
import {MatIcon} from '@angular/material/icon';
import {Router, RouterLink, RouterOutlet} from '@angular/router';
import {MatProgressBar} from '@angular/material/progress-bar';
import {TreeViewComponent} from './treeview/tree-view.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  imports: [MatToolbar, MatToolbarRow, NgClass, MatTooltip, MatIcon, RouterLink, MatProgressBar, MatSidenavContainer, MatSidenav, TreeViewComponent, MatSidenavContent, RouterOutlet, AsyncPipe]
})
export class AppComponent implements OnInit, OnDestroy, AfterViewInit {
  private persistence = inject(DepositionPersistenceService);
  private sidenavService = inject(SidenavService);
  private router = inject(Router);
  loader = inject(LoadingBarService);


  sidenav_open: boolean;
  entry: Entry | null = null;
  openDepositions: OpenDepositionView[] = [];
  subscription$ = new Subscription();
  @ViewChild('sidenav') public sidenav!: MatSidenav;

  constructor() {
    this.sidenav_open = false;
  }

  ngOnInit() {
    console.info('Running git commit: ' + versions.branch + ':' + versions.revision +
      '. View commit on GitHub: https://github.com/bmrb-io/BMRBDep/commit/' + versions.revision);

    this.subscription$.add(this.persistence.entrySubject.subscribe({
      next: entry => this.entry = entry
    }));
    this.subscription$.add(this.persistence.openDepositionsSubject.subscribe({
      next: views => this.openDepositions = views
    }));
  }

  ngAfterViewInit(): void {
    this.sidenavService.setSidenav(this.sidenav);
  }

  ngOnDestroy() {
    this.subscription$.unsubscribe();
  }

  clearEntry(): void {
    this.persistence.signOut().then(done => {
      if (done) {
        this.router.navigate(['/']).then();
      }
    });
  }

  activateDeposition(entryID: string): void {
    if (this.entry?.entryID === entryID) return;
    this.persistence.setActive(entryID);
    if (!this.router.url.startsWith('/entry')) {
      this.router.navigate(['/entry']).then();
    }
  }

  closeChip(event: Event, entryID: string): void {
    event.stopPropagation();
    this.persistence.confirmDiscardUnsaved('close this deposition', entryID).then(confirmed => {
      if (!confirmed) return;
      this.persistence.closeDeposition(entryID).then(() => {
        if (this.persistence.getOpenDepositionRecords().length === 0) {
          this.router.navigate(['/']).then();
        }
      });
    });
  }

  trackChip(_index: number, view: OpenDepositionView): string {
    return view.entryID;
  }
}
