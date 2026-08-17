import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {environment} from '../environments/environment';
import {Loop} from './nmrstar/loop';
import {DepositionPersistenceService} from './deposition-persistence.service';
import {ApiErrorHandler} from './api-error-handler.service';

export interface ZendeskRequestResponse {
  request: {
    id: number;
    [key: string]: unknown;
  };
}

@Injectable({providedIn: 'root'})
export class SupportService {
  private http = inject(HttpClient);
  private persistence = inject(DepositionPersistenceService);
  private errorHandler = inject(ApiErrorHandler);

  newSupportRequest(comment: string, subject = 'BMRBdep Support Request', userEmail: string | null = null): Promise<ZendeskRequestResponse> {

    // Reference: https://developer.zendesk.com/rest_api/docs/support/requests#create-request

    let userName = 'Unknown User';
    const entry = this.persistence.currentEntry;
    if (entry) {
      const contactLoop: Loop = entry.getLoopsByCategory('_Contact_person')[0];
      userEmail = contactLoop.data[0][contactLoop.tags.indexOf('Email_address')].value;
      userName = contactLoop.data[0][contactLoop.tags.indexOf('Given_name')].value + ' ' +
        contactLoop.data[0][contactLoop.tags.indexOf('Family_name')].value;
      if (userName.length < 2) {
        userName = 'Unknown User';
      }
      comment = `${comment}\n\nDeposition ID: ${entry.entryID}`;
    } else {
      if (!userEmail) {
        throw new Error('Invalid function use. Please provide user e-mail if no active deposition session.');
      }
    }

    const jsonData = {
      'request': {
        'requester': {
          'name': userName,
          'email': userEmail
        },
        'subject': subject,
        'comment': {
          'body': comment
        }
      }
    };

    return new Promise((resolve, reject) => {

      this.http.post<ZendeskRequestResponse>(environment.supportURL, jsonData)
        .subscribe({
          next: responseJson => {
            resolve(responseJson);
          },
          error: error => {
            this.errorHandler.handle(error);
            reject();
          }
        });
    });
  }
}
