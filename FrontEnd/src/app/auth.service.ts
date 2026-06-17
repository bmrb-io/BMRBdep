import {inject, Injectable} from '@angular/core';
import {HttpClient, HttpErrorResponse} from '@angular/common/http';
import {Observable, of} from 'rxjs';
import {catchError, map} from 'rxjs/operators';
import {environment} from '../environments/environment';
import {Message, MessagesService, MessageType} from './messages.service';
import {Deposition} from './my-depositions/my-depositions.component';
import {ApiErrorHandler} from './api-error-handler.service';

export interface EmailAccessTokenResponse {
  status: string;
}

export interface SessionInfo {
  email?: string;
  orcid?: string;
  admin?: boolean;
}

@Injectable({providedIn: 'root'})
export class AuthService {
  private http = inject(HttpClient);
  private messagesService = inject(MessagesService);
  private errorHandler = inject(ApiErrorHandler);

  sendEmailAccessToken(email: string): Promise<string> {

    const apiEndPoint = `${environment.serverURL}/request-email-access`;

    const body = new FormData();
    body.append('email', email);

    return new Promise(((resolve, reject) => {
      this.http.post<EmailAccessTokenResponse>(apiEndPoint, body).subscribe({
        next: jsonData => {
          console.log(jsonData);

          this.messagesService.sendMessage(new Message('Email sent. Please check your inbox and also check your spam folder if you don\'t see it.',
            MessageType.NotificationMessage, 15000));
          resolve(jsonData.status);
        },
        error: error => {
          this.errorHandler.handle(error);
          reject();
        }
      });
    }));
  }

  getAuthorizedDepositions(): Observable<Deposition[]> {
    const apiEndPoint = `${environment.serverURL}/authorized-depositions`;
    return this.http.get<Deposition[]>(apiEndPoint, {withCredentials: true})
      .pipe(
        catchError((error: HttpErrorResponse) => {
          this.errorHandler.handle(error);
          return of([]);
        })
      );
  }

  getSessionInfo(): Observable<SessionInfo> {
    const apiEndPoint = `${environment.serverURL}/session-info`;
    return this.http.get<SessionInfo>(apiEndPoint, {withCredentials: true})
      .pipe(
        catchError(() => of({} as SessionInfo))
      );
  }

  isAdmin(): Observable<boolean> {
    return this.getSessionInfo().pipe(map(info => !!info.admin));
  }
}
