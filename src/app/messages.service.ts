import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

export enum MessageType {
  SuccessMessage,
  WarningMessage,
  ErrorMessage,
  NotificationMessage
}

export class Message {
  messageBody: string;
  messageType: MessageType;
  messageTimeout: number;

  constructor(messageBody: string,
              messageType: MessageType = MessageType.SuccessMessage,
              messageTimeout: number = 3000) {
    this.messageBody = messageBody;
    this.messageType = messageType;
    this.messageTimeout = messageTimeout;
  }

  getClass() {
    if (this.messageType === MessageType.SuccessMessage){
      return 'SuccessMessage';
    }
    if (this.messageType === MessageType.WarningMessage){
      return 'WarningMessage';
    }
    if (this.messageType === MessageType.ErrorMessage){
      return 'ErrorMessage';
    }
    if (this.messageType === MessageType.NotificationMessage){
      return 'NotificationMessage';
    }
  }
}

@Injectable({
  providedIn: 'root'
})
export class MessagesService {

  private subject = new Subject<any>();

  constructor() { }

  sendMessage(message: Message) {
    this.subject.next(message);
    setTimeout(() => {
      this.clearMessage();
    }, message.messageTimeout);
  }

  clearMessage() {
    this.subject.next();
  }

  getMessage(): Observable<any> {
    return this.subject.asObservable();
  }

}
