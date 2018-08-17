import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Message, MessagesService } from './messages.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy {

  subscription: Subscription;
  message: Message;

  constructor(private router: Router,
              private messagesService: MessagesService) {

    this.subscription = this.messagesService.getMessage().subscribe(message => {
      this.message = message;
      setTimeout(() => {this.message = null; }, message.messageTimeout);
    });
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  ngOnInit() {
    console.log('InstantDep version .2');

    // Scroll to the top of the page on route change
    this.router.events.subscribe((evt) => {
      if (!(evt instanceof NavigationEnd)) {
        return;
      }
      window.scrollTo(0, 0);
    });
  }

}
