import {Injectable} from '@angular/core';
import {environment} from '../environments/environment';
import {MatSnackBar, MatSnackBarRef, SimpleSnackBar} from '@angular/material/snack-bar';

export enum MessageType {
  ErrorMessage,
  NotificationMessage
}

export const MessageTypeLabel = new Map<number, string>([
  [MessageType.ErrorMessage, 'ErrorMessage'],
  [MessageType.NotificationMessage, 'NotificationMessage'],
]);


export class Message {
  messageBody: string;
  messageType: MessageType;
  messageTimeout: number;

  constructor(messageBody: string,
              messageType: MessageType = MessageType.NotificationMessage,
              messageTimeout: number = 15000) {
    this.messageBody = messageBody;
    this.messageType = messageType;
    this.messageTimeout = messageTimeout;
  }
}

@Injectable({
  providedIn: 'root'
})
export class MessagesService {

  snackBarRef: MatSnackBarRef<SimpleSnackBar>;

  constructor(private snackBar: MatSnackBar) {
  }

  sendMessage(message: Message) {
    let action = null;
    if (message.messageType === MessageType.ErrorMessage) {
      action = 'Notify Us';
    }
    this.snackBarRef = this.snackBar.open(message.messageBody, action, {
      duration: message.messageTimeout,
      panelClass: MessageTypeLabel.get(message.messageType)
    });

    this.snackBarRef.onAction().subscribe(() => {
      const mail = document.createElement('a');
      mail.href = 'mailto:' + environment.contactEmail + '?subject=' + 'An BMRBdep error occurred: ' + message.messageBody;
      mail.click();
    });

    // Log messages to the console if in development mode
    console.log('Sent message: ', message);
  }

  clearMessage() {
    this.snackBarRef.dismiss();
  }
}
