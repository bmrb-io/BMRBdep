import {Injectable} from '@angular/core';
import {MatSnackBar, MatSnackBarRef, SimpleSnackBar} from '@angular/material/snack-bar';
import {Router} from '@angular/router';

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

  constructor(private snackBar: MatSnackBar,
              private router: Router) {
  }

  sendMessage(message: Message, actualException = null) {
    let action = null;
    if (message.messageType === MessageType.ErrorMessage) {
      action = 'Notify Us';
    }
    this.snackBarRef = this.snackBar.open(message.messageBody, action, {
      duration: message.messageTimeout,
      panelClass: MessageTypeLabel.get(message.messageType)
    });

    this.snackBarRef.onAction().subscribe(() => {
      let errorMessage = message.messageBody;
      if (actualException) {
        errorMessage = actualException;
      }
      this.router.navigate(['support'], {state: {data: {message: errorMessage, url: this.router.url}}}).then();
    });

    // Log messages to the console if in development mode
    console.log('Sent message: ', message);
  }

  clearMessage() {
    this.snackBarRef.dismiss();
  }
}
