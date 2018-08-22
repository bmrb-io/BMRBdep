import {Component, OnDestroy, OnInit} from '@angular/core';
import {Message, MessagesService, MessageType} from '../messages.service';
import {Subscription} from 'rxjs';

@Component({
  selector: 'app-message',
  templateUrl: './message.component.html',
  styleUrls: ['./message.component.css']
})
export class MessageComponent implements OnInit, OnDestroy {

  messageType = MessageType;
  subscription: Subscription;
  message: Message;

  constructor(private messagesService: MessagesService) {

    this.subscription = this.messagesService.getMessage().subscribe(message => {
      this.message = message;
    });
  }

  ngOnInit() {
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

}
