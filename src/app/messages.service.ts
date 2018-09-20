import {Injectable} from '@angular/core';
import {Observable, Subject} from 'rxjs';
import {environment} from '../environments/environment';

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
}

@Injectable({
  providedIn: 'root'
})
export class MessagesService {

  private subject = new Subject<any>();
  private lastTimeout;

  constructor() {
    this.lastTimeout = null;
  }

  private cancelTimeout(): void {
    if (this.lastTimeout) {
      clearTimeout(this.lastTimeout);
    }
    this.lastTimeout = null;
  }

  sendMessage(message: Message) {
    this.cancelTimeout();
    // Send the message
    this.subject.next(message);
    // Store the timeout in case we need to cancel it
    if (message.messageTimeout) {
      this.lastTimeout = setTimeout(() => {
        this.clearMessage();
      }, message.messageTimeout);
    }

    // Log messages to the console if in development mode
    if (!environment.production) {
      console.log('Sent message: ', message);
    }
  }

  clearMessage() {
    this.cancelTimeout();
    this.subject.next();
  }

  getMessage(): Observable<any> {
    return this.subject.asObservable();
  }

}
