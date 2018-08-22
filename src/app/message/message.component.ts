import {Component, Input, OnInit} from '@angular/core';
import {Message, MessageType} from '../messages.service';

@Component({
  selector: 'app-message',
  templateUrl: './message.component.html',
  styleUrls: ['./message.component.css']
})
export class MessageComponent implements OnInit {

  @Input() message: Message;
  messageType = MessageType;

  constructor() { }

  ngOnInit() {
  }

}
