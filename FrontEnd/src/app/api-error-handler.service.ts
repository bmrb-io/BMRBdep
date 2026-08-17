import {Injectable, inject} from '@angular/core';
import {HttpErrorResponse} from '@angular/common/http';
import {Observable, of} from 'rxjs';
import {Message, MessagesService, MessageType} from './messages.service';
import {environment} from '../environments/environment';

@Injectable({providedIn: 'root'})
export class ApiErrorHandler {
  private messagesService = inject(MessagesService);

  handle(error: HttpErrorResponse): Observable<null> {
    if (error.error && error.error.error) {
      this.messagesService.sendMessage(new Message(error.error.error, MessageType.ErrorMessage, 15000), error.error.error);
    } else {
      this.messagesService.sendMessage(new Message('A network or server exception occurred.', MessageType.ErrorMessage, 15000),
        error.message);
    }
    if (!environment.production) {
      throw error;
    }
    return of(null);
  }
}
