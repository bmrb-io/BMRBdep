import {inject, Injectable} from '@angular/core';
import {HttpClient, HttpErrorResponse, HttpParams} from '@angular/common/http';
import {Observable} from 'rxjs';
import {catchError, map} from 'rxjs/operators';
import {Router} from '@angular/router';
import {MatDialog} from '@angular/material/dialog';
import {environment} from '../environments/environment';
import {Message, MessagesService, MessageType} from './messages.service';
import {ConfirmationDialogComponent} from './confirmation-dialog/confirmation-dialog.component';
import {checkValueIsNull} from './nmrstar/nmrstar';
import {CommitResponse, DepositionPersistenceService} from './deposition-persistence.service';
import {SupportService} from './support.service';
import {ApiErrorHandler} from './api-error-handler.service';

export interface DepositionIdResponse {
  deposition_id: string;
}

export interface ResendValidationEmailResponse {
  status: 'validated' | 'unvalidated';
}

@Injectable({providedIn: 'root'})
export class DepositionLifecycleService {
  private http = inject(HttpClient);
  private messagesService = inject(MessagesService);
  private router = inject(Router);
  private dialog = inject(MatDialog);
  private persistence = inject(DepositionPersistenceService);
  private support = inject(SupportService);
  private errorHandler = inject(ApiErrorHandler);

  newDeposition(authorEmail: string,
                depositionNickname: string,
                depositionType: string,
                orcid: string | null = null,
                skipEmailValidation = false,
                file: File | null = null,
                bootstrapID: string | null = null): Promise<string> {
    const apiEndPoint = `${environment.serverURL}/new`;
    this.messagesService.sendMessage(new Message('Creating deposition...',
      MessageType.NotificationMessage, 0));

    const body = new FormData();
    body.append('email', authorEmail);
    body.append('deposition_nickname', depositionNickname);
    body.append('deposition_type', depositionType);
    if (skipEmailValidation) {
      body.append('skip_validation', 'true');
    }
    if (orcid) {
      body.append('orcid', orcid);
    }
    if (file) {
      body.append('nmrstar_file', file);
    }
    if (bootstrapID) {
      body.append('bootstrapID', bootstrapID);
    }

    const options = {
      params: new HttpParams(),
      reportProgress: true,
    };

    return new Promise((resolve, reject) => {

      this.http.post<DepositionIdResponse>(apiEndPoint, body, options)
        .subscribe({
          next: jsonData => {
            this.persistence.clearDeposition();
            this.messagesService.clearMessage();
            resolve(jsonData.deposition_id);
          },
          error: error => {
            if (error.error && error.error.error && error.error.error.includes('invalid') && error.error.error.includes('e-mail')) {
              reject('Invalid e-mail');
            }
            this.errorHandler.handle(error);
            reject(error);
          }
        });
    });
  }

  cloneDeposition() {
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {disableClose: false});
    dialogRef.componentInstance.confirmMessage = 'This will create a new deposition pre-filled with all of the data from the current' +
      ' deposition, except any uploaded data files. Are you sure you want to proceed?';
    dialogRef.componentInstance.proceedMessage = 'Yes, create new deposition';
    dialogRef.componentInstance.cancelMessage = 'No, cancel';
    dialogRef.componentInstance.inputBoxText = 'Enter a nickname for the new deposition';

    dialogRef.afterClosed().subscribe({
      next: result => {
        const entry = this.persistence.currentEntry;
        if (result && entry) {
          const formData = new FormData();
          formData.append('deposition_nickname', dialogRef.componentInstance.name);

          const duplicateURL = `${environment.serverURL}/${entry.entryID}/duplicate`;
          this.http.post<DepositionIdResponse>(duplicateURL, formData).subscribe(jsonData => {
            this.router.navigate(['/entry', 'load', jsonData.deposition_id]).then();
          });
        }
      }
    });
  }

  depositEntry(feedback: string | null = null): Promise<void> {

    const entry = this.persistence.currentEntry;
    if (!entry || !entry.valid) {
      this.messagesService.sendMessage(new Message('Can not submit deposition: it is still incomplete!',
        MessageType.ErrorMessage, 15000));
      return Promise.resolve();
    }

    const apiEndPoint = `${environment.serverURL}/${entry.entryID}/deposit`;

    const formData = new FormData();
    formData.append('deposition_contents', entry.print());

    this.messagesService.sendMessage(new Message('Submitting deposition...',
      MessageType.NotificationMessage, 0));

    return new Promise(((resolve, reject) => {
      this.http.post<CommitResponse>(apiEndPoint, formData).subscribe({
        next: () => {
          if (!checkValueIsNull(feedback)) {
            this.support.newSupportRequest(feedback!, 'BMRBdep Feedback Message').then();
          }

          // Trigger everything watching the entry to see that it changed - because "deposited" changed
          entry.deposited = true;
          entry.refresh();
          this.persistence.storeEntry();

          this.messagesService.sendMessage(new Message('Submission accepted!',
            MessageType.NotificationMessage, 15000));
          this.router.navigate(['/entry']).then();
          resolve();
        },
        error: error => {
          this.errorHandler.handle(error);
          reject();
        }
      });
    }));
  }

  resendValidationEmail(): Observable<ResendValidationEmailResponse | null> {

    const apiEndPoint = `${environment.serverURL}/${this.persistence.getEntryID()}/resend-validation-email`;

    this.messagesService.sendMessage(new Message('Requesting new validation e-mail...',
      MessageType.NotificationMessage, 0));
    return this.http.get<ResendValidationEmailResponse>(apiEndPoint)
      .pipe(
        map(jsonData => {
          this.messagesService.clearMessage();
          return jsonData;
        }),
        // Convert the error into something we can handle
        catchError((error: HttpErrorResponse) => this.errorHandler.handle(error))
      );
  }
}
