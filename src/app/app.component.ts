import {Component, OnInit} from '@angular/core';
import {Router, NavigationEnd} from '@angular/router';
import {Entry} from './nmrstar/entry';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {

  entry: Entry;
  sidenav_open: boolean;

  constructor(private router: Router) {
    this.sidenav_open = false;
  }

  ngOnInit() {
    console.log('InstantDep version .3');

    // Scroll to the top of the page on route change
    this.router.events.subscribe((evt) => {
      if (!(evt instanceof NavigationEnd)) {
        return;
      }
      window.scrollTo(0, 0);
    });
  }

}
