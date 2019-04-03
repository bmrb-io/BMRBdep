import {Component, OnInit} from '@angular/core';
import {ApiService} from '../api.service';
import {Router} from '@angular/router';
import {Message, MessagesService, MessageType} from '../messages.service';
import {Location} from '@angular/common';
import {Entry} from '../nmrstar/entry';

@Component({
  selector: 'app-review',
  templateUrl: './review.component.html',
  styleUrls: ['./review.component.scss']
})
export class ReviewComponent implements OnInit {

  entry: Entry;

  constructor(private api: ApiService,
              private messagesService: MessagesService,
              private router: Router,
              private location: Location) {
  }

  ngOnInit() {
    this.api.entrySubject.subscribe(entry => this.entry = entry);
  }

  goBack(): void {
    this.location.back();
  }

  submitEntry(): void {
    this.api.depositEntry().subscribe(() => {
      this.messagesService.sendMessage(new Message('Submission accepted!',
        MessageType.NotificationMessage, 15000));
      this.router.navigate(['/']);
    });
  }
}
