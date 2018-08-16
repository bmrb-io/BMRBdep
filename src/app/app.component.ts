import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { MessagesService } from './messages.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy {

  subscription: Subscription;
  message: string;

  constructor(private router: Router,
              private messagesService: MessagesService) {
    this.subscription = this.messagesService.getMessage().subscribe(message => { this.message = message['text']; });
  }

  ngOnDestroy() {
    // unsubscribe to ensure no memory leaks
    this.subscription.unsubscribe();
  }

  ngOnInit() {
    console.log('InstantDep version .2');

    // Scroll to the top of the page on route change
    this.router.events.subscribe((evt) => {
      if (!(evt instanceof NavigationEnd)) {
        return;
      }
      // TODO: This breaks scrolling when pressing the back button...
      window.scrollTo(0, 0);
    });
  }

}
