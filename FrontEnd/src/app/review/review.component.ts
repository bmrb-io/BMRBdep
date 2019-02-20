import {Component, OnInit} from '@angular/core';
import {ApiService} from '../api.service';
import {ActivatedRoute, Router} from '@angular/router';
import {Message, MessagesService, MessageType} from '../messages.service';
import {Location} from '@angular/common';
import {Entry} from '../nmrstar/entry';

@Component({
  selector: 'app-review',
  templateUrl: './review.component.html',
  styleUrls: ['./review.component.css']
})
export class ReviewComponent implements OnInit {

  entry: Entry;

  constructor(private api: ApiService,
              private route: ActivatedRoute,
              private messagesService: MessagesService,
              private router: Router,
              private location: Location) {
  }

  ngOnInit() {

    this.api.entrySubject.subscribe(entry => this.entry = entry);

    const parent: ReviewComponent = this;
    this.route.params.subscribe(function (params) {
      parent.api.loadEntry(params['entry']);
    });
  }

  goBack(): void {
    this.location.back();
  }

  submitEntry(): void {
    this.api.submitEntry().subscribe(() => {
      this.messagesService.sendMessage(new Message('Submission accepted! Redirecting to home page.',
        MessageType.NotificationMessage, 10000));
      setTimeout(() => {
        this.router.navigate(['/']);
      }, 10000);
    });
  }
}
