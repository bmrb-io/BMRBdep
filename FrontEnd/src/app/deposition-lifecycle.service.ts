import {inject, Injectable} from '@angular/core';
import {HttpClient, HttpErrorResponse, HttpParams} from '@angular/common/http';
import {Observable, of} from 'rxjs';
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

export interface UnlockStatusResponse {
  entry_deposited: boolean;
  ets_status: string | null;
  unlockable: boolean;
}

export interface UnlockResponse {
  commit: string;
  entry_deposited: boolean;
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
    const entry = this.persistence.currentEntry;
    if (!entry) return;
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {disableClose: false});
    dialogRef.componentInstance.confirmMessage = `This will create a new deposition pre-filled with all of the data from '${entry.depositionNickname}',` +
      ' except any uploaded data files. Are you sure you want to proceed?';
    dialogRef.componentInstance.proceedMessage = 'Yes, create new deposition';
    dialogRef.componentInstance.cancelMessage = 'No, cancel';
    dialogRef.componentInstance.inputBoxText = 'Enter a nickname for the new deposition';

    dialogRef.afterClosed().subscribe({
      next: result => {
        if (result) {
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

  /**
   * Ask the server whether a deposited entry can still be unlocked by the depositor. An entry is
   * unlockable only while its ETS status is still 'nd' (annotation has not begun). Returns null on
   * error so callers can fail closed (show neither the unlock option nor a misleading message).
   */
  getUnlockStatus(entryID: string): Observable<UnlockStatusResponse | null> {
    const apiEndPoint = `${environment.serverURL}/${entryID}/unlock-status`;
    return this.http.get<UnlockStatusResponse>(apiEndPoint, {withCredentials: true})
      .pipe(catchError(() => of(null)));
  }

  /**
   * Re-open the depositor's own deposited entry for editing, gated server-side on the e-mail session.
   * On success the entry is refetched (it comes back as not-deposited and therefore editable) and the
   * depositor is reminded that they must complete the deposition again.
   */
  unlockDeposition(): void {
    const entry = this.persistence.currentEntry;
    if (!entry) {
      return;
    }
    const entryID = entry.entryID;

    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {disableClose: false});
    dialogRef.componentInstance.confirmMessage =
      'This will unlock your deposition so you can make further changes. After unlocking you must ' +
      'complete the deposition process again (press "Submit deposition to BMRB") or your changes will ' +
      'not be processed by BMRB annotators. Are you sure you want to proceed?';
    dialogRef.componentInstance.proceedMessage = 'Yes, unlock deposition';
    dialogRef.componentInstance.cancelMessage = 'No, cancel';

    dialogRef.afterClosed().subscribe({
      next: confirmed => {
        if (!confirmed) {
          return;
        }
        const apiEndPoint = `${environment.serverURL}/${entryID}/unlock`;
        this.messagesService.sendMessage(new Message('Unlocking deposition...',
          MessageType.NotificationMessage, 0));
        this.http.post<UnlockResponse>(apiEndPoint, {}, {withCredentials: true}).subscribe({
          next: () => {
            this.messagesService.sendMessage(new Message(
              'Deposition unlocked. Make your changes, then submit the deposition again so it is processed.',
              MessageType.NotificationMessage, 15000));
            // Refetch so the in-memory copy reflects the now not-deposited (editable) state, then send
            // the depositor to the section that still needs attention — or straight to the review/deposit
            // page (where the "Submit deposition to BMRB" button lives) if the entry is already complete.
            this.persistence.refetchEntry(entryID, true).then(entry => {
              if (entry.firstIncompleteCategory) {
                this.router.navigate(['/entry', 'saveframe', entry.firstIncompleteCategory]).then();
              } else {
                this.router.navigate(['/entry', 'review']).then();
              }
            }).catch(() => { /* load failure is already surfaced by the load path */ });
          },
          error: error => this.errorHandler.handle(error)
        });
      }
    });
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
