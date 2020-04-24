import {Observable, of, ReplaySubject, Subscription} from 'rxjs';
import {catchError, map} from 'rxjs/operators';
import {Entry, entryFromJSON} from './nmrstar/entry';
import {Injectable, OnDestroy} from '@angular/core';
import {HttpClient, HttpErrorResponse, HttpEvent, HttpHeaders, HttpParams, HttpRequest} from '@angular/common/http';
import {environment} from '../environments/environment';
import {Message, MessagesService, MessageType} from './messages.service';
import {ActivatedRoute, NavigationEnd, Router} from '@angular/router';
import {Title} from '@angular/platform-browser';
import {ConfirmationDialogComponent} from './confirmation-dialog/confirmation-dialog.component';
import {MatDialog} from '@angular/material/dialog';
import {Loop} from './nmrstar/loop';
import {checkValueIsNull} from './nmrstar/nmrstar';
import {SidenavService} from './sidenav.service';

function getTime(): number {
  return (new Date()).getTime();
}

@Injectable({
  providedIn: 'root'
})
export class ApiService implements OnDestroy {

  private cachedEntry: Entry;
  entrySubject: ReplaySubject<Entry>;
  subscription$: Subscription;
  entryChangeCheckTimer;
  saveTimer;
  lastChangeTime: number;
  saveInProgress: boolean;

  private JSONOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json'
    })
  };

  constructor(private http: HttpClient,
              private messagesService: MessagesService,
              private router: Router,
              private route: ActivatedRoute,
              private titleService: Title,
              private dialog: MatDialog,
              private sidenavService: SidenavService) {

    this.entrySubject = new ReplaySubject<Entry>();

    this.subscription$ = this.entrySubject.subscribe(entry => {
      this.cachedEntry = entry;
      if (entry) {
        this.titleService.setTitle(`BMRbig: ${entry.depositionNickname}`);
      } else {
        this.titleService.setTitle('BMRbig');
      }
    });

    let rawJSON, schema;
    try {
      rawJSON = JSON.parse(localStorage.getItem('entry'));
      schema = JSON.parse(localStorage.getItem('schema'));
    } catch (err) {
      console.error('Invalid cached entry!');
      rawJSON = null;
      schema = null;
    }
    if (rawJSON !== null && schema !== null) {
      rawJSON['schema'] = schema;
      const entry = entryFromJSON(rawJSON);
      this.entrySubject.next(entry);
      this.checkLastCommit().then(foundCommit => {
        if (!foundCommit) {
          if (entry.unsaved) {
            this.messagesService.sendMessage(new Message('You have unsaved local changes (perhaps from working offline) but ' +
              'we must reload your entry due to a change to your deposition that occurred on the server. Unfortunately this means ' +
              'that your most recent changes may be lost. Please review your entry in entirety before depositing to make sure that it is ' +
              'up to date.', MessageType.ErrorMessage));
          }
          this.loadEntry(entry.entryID, true);
        } else {
          // The stored entry is unsaved, so save it now!
          if (entry.unsaved) {
            this.saveEntry();
          }
        }
      });
    } else {
      this.subscription$.add(this.router.events.subscribe(
        event => {
          if (event instanceof NavigationEnd) {
            if (this.router.url.indexOf('/load/') < 0 && this.router.url.indexOf('/help') < 0 && this.router.url.indexOf('/support') < 0
              && !this.cachedEntry) {
              this.subscription$.unsubscribe();
              router.navigate(['/']).then();
            }
          }
        }
      ));
    }

    // Used to open verification links in same tab
    window.name = 'BMRbig';

    this.entryChangeCheckTimer = setInterval(() => {
      const savedID = localStorage.getItem('entryID');

      // First check that the entry hasn't changed
      if (savedID && this.cachedEntry && savedID !== this.cachedEntry.entryID) {
        this.entrySubject.next(null);
        this.router.navigate(['/']).then();
        this.messagesService.sendMessage(new Message('You were signed out on this tab because you loaded a different' +
          ' deposition in another tab.', MessageType.NotificationMessage, 60000));
      }
    }, 100);

    this.lastChangeTime = null;
    this.saveInProgress = false;
    this.saveTimer = setInterval(() => {
      // If there is an active entry, that is old enough to need saving
      if (this.cachedEntry && this.cachedEntry.unsaved && this.lastChangeTime !== null && !this.saveInProgress) {
        this.saveEntry();
      }
    }, 5000);
  }

  ngOnDestroy() {
    this.subscription$.unsubscribe();
    clearInterval(this.saveTimer);
    clearInterval(this.entryChangeCheckTimer);
  }

  clearDeposition(): void {
    localStorage.removeItem('entry');
    localStorage.removeItem('entryID');
    localStorage.removeItem('schema');
    this.entrySubject.next(null);
  }

  // file from event.target.files[0]
  uploadFile(file: File): Observable<HttpEvent<any>> {

    const apiEndPoint = `${environment.serverURL}/${this.getEntryID()}/file`;

    const formData = new FormData();
    formData.append('file', file);

    const options = {
      params: new HttpParams(),
      reportProgress: true,
    };

    const req = new HttpRequest('POST', apiEndPoint, formData, options);
    return this.http.request(req);
  }

  deleteFile(fileName: string, verifyDeleted: boolean = false): void {
    const apiEndPoint = `${environment.serverURL}/${this.getEntryID()}/file/${fileName}`;
    this.http.delete(apiEndPoint).subscribe(
      response => {
        this.messagesService.sendMessage(new Message('File \'' + fileName + '\' deleted.'));
        this.cachedEntry.dataStore.deleteFile(fileName);
        this.cachedEntry.updateUploadedData();
        this.cachedEntry.refresh();
        this.cachedEntry.addCommit(response['commit']);
        this.storeEntry(true);
      },
      () => {
        // verifyDeleted will be set if they cancel an upload
        if (!verifyDeleted) {
          this.messagesService.sendMessage(new Message('Failed to delete file. Do you have an internet connection?',
            MessageType.ErrorMessage, 15000));
        } else {
          this.messagesService.clearMessage();
          this.cachedEntry.dataStore.deleteFile(fileName);
          this.cachedEntry.updateUploadedData();
          this.cachedEntry.refresh();
        }
      }
    );
  }

  checkValidatedEmail(): Promise<boolean> {
    return new Promise(((resolve, reject) => {
      const entryURL = `${environment.serverURL}/${this.cachedEntry.entryID}/check-valid`;
      this.http.get(entryURL).subscribe(response => {
          resolve(response['status']);
        }, error => {
          this.handleError(error);
          reject();
        }
      );
    }));
  }

  checkLastCommit(): Promise<boolean> {
    return new Promise(((resolve, reject) => {
      const entryURL = `${environment.serverURL}/${this.cachedEntry.entryID}/check-valid`;
      this.http.get(entryURL).subscribe(response => {
          resolve(this.cachedEntry.checkCommit(response['commit']));
        }, error => {
          this.handleError(error);
          reject();
        }
      );
    }));
  }


  cloneDeposition() {
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {disableClose: false});
    dialogRef.componentInstance.confirmMessage = 'This will create a new deposition pre-filled with all of the data from the current' +
      ' deposition, except any uploaded data files. Are you sure you want to proceed?';
    dialogRef.componentInstance.proceedMessage = 'Yes, create new deposition';
    dialogRef.componentInstance.cancelMessage = 'No, cancel';
    dialogRef.componentInstance.inputBoxText = 'Enter a nickname for the new deposition';

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        const formData = new FormData();
        formData.append('deposition_nickname', dialogRef.componentInstance.name);

        const duplicateURL = `${environment.serverURL}/${this.cachedEntry.entryID}/duplicate`;
        this.http.post(duplicateURL, formData).subscribe(jsonData => {
          this.router.navigate(['/entry', 'load', jsonData['deposition_id']]).then();
        });
      }
    });
  }

  loadEntry(entryID: string, skipMessage: boolean = false): void {
    const entryURL = `${environment.serverURL}/${entryID}`;
    if (!skipMessage) {
      this.messagesService.sendMessage(new Message(`Loading deposition ${entryID}...`));
    }
    this.http.get(entryURL).subscribe(
      jsonData => {
        if (!skipMessage) {
          this.messagesService.clearMessage();
        }
        const loadedEntry: Entry = entryFromJSON(jsonData);

        // Verify that the NMR-STAR matches the uploaded files
        let filesOutOfSync = false;
        if ('data_files' in jsonData) {
          const files: Array<string> = jsonData['data_files'];
          for (const dataFile of files) {
            if (!(dataFile in loadedEntry.dataStore.dataFileMap)) {
              loadedEntry.dataStore.addFile(dataFile).percent = 100;
              filesOutOfSync = true;
            }
          }
        }

        this.entrySubject.next(loadedEntry);
        localStorage.setItem('entry', JSON.stringify(loadedEntry));
        localStorage.setItem('entryID', loadedEntry.entryID);
        localStorage.setItem('schema', JSON.stringify(loadedEntry.schema));

        // Somehow the NMR-STAR data got out of sync with the uploaded files. Trigger a regeneration of the NMR-STAR, and a save.
        if (filesOutOfSync) {
          console.warn('Files detected as uploaded which are not present in NMR-STAR. Triggering re-save.');
          loadedEntry.updateUploadedData();
          loadedEntry.refresh();
          this.saveEntry();
        }
      },
      error => this.handleError(error)
    );
  }

  storeEntry(dirty: boolean = false): void {

    if (this.cachedEntry) {
      // Saves an entry locally, and mark it as dirty first if need be
      if (dirty) {
        this.cachedEntry.unsaved = dirty;
        this.lastChangeTime = getTime();
      }
      localStorage.setItem('entry', JSON.stringify(this.cachedEntry));
      localStorage.setItem('entryID', this.cachedEntry.entryID);
    } else {
      console.error('Asked to storeEntry, but no entry cached!');
    }
  }

  saveEntry(override: boolean = true): void {

    const saveOriginTime = this.lastChangeTime;
    this.saveInProgress = true;

    const entryURL = `${environment.serverURL}/${this.cachedEntry.entryID}`;
    const jsonObject = this.cachedEntry.toJSON();
    if (override) {
      jsonObject['force'] = true;
    }
    this.http.put(entryURL, JSON.stringify(jsonObject), this.JSONOptions).subscribe(
      response => {
        if ('error' in response && response['error'] === 'reload') {

          this.cachedEntry.unsaved = true;
          const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
            disableClose: false
          });

          dialogRef.componentInstance.confirmMessage = 'Changes to this deposition have been detected on the server - changes most ' +
            ' likely made from a different tab, browser, or computer. Would you like to load the changes from the server, ' +
            'losing your most recent changes, or push your changes to the server, overriding what is stored there? (If you are ' +
            'unsure, load changes from the server.) Note that you should only edit one deposition at a time, in one tab.';
          dialogRef.componentInstance.proceedMessage = 'Load changes from server';
          dialogRef.componentInstance.cancelMessage = 'Push changes to server';

          dialogRef.afterClosed().subscribe(result => {
            if (result) {
              this.loadEntry(this.cachedEntry.entryID, true);
            } else if (result === false) {
              this.saveEntry(true);
            } else if (result === undefined) {
              // Nothing needs to happen here, the next save will trigger the same message
              // Preserving the clause just to make it clear there is an "escape" condition where the user
              // doesn't select either option.
            }
            this.saveInProgress = false;
          });

        } else {
          // Commit is successful!
          this.cachedEntry.addCommit(response['commit']);
          if (saveOriginTime === this.lastChangeTime) {
            this.cachedEntry.unsaved = false;
            this.lastChangeTime = null;
          }
          this.storeEntry(false);
          this.saveInProgress = false;
        }
      },
      () => {
        if (!this.cachedEntry.unsaved) {
          this.messagesService.sendMessage(new Message('Save attempt failed. Perhaps you have lost your internet' +
            ' connection? Changes can still be made to the deposition, but please don\'t clear your browser cache until internet' +
            ' is restored and the entry can be saved.'));
        }
        this.saveInProgress = false;
      }
    );
  }

  newSupportRequest(comment: string, subject: string = 'BMRBbig Support Request', userEmail: string = null): Promise<any> {

    // Reference: https://developer.zendesk.com/rest_api/docs/support/requests#create-request

    let userName = 'Unknown User';
    if (this.cachedEntry) {
      const contactLoop: Loop = this.cachedEntry.getLoopsByCategory('_Contact_person')[0];
      userEmail = contactLoop.data[0][contactLoop.tags.indexOf('Email_address')].value;
      userName = contactLoop.data[0][contactLoop.tags.indexOf('Given_name')].value + ' ' +
        contactLoop.data[0][contactLoop.tags.indexOf('Family_name')].value;
      if (userName.length < 2) {
        userName = 'Unknown User';
      }
      comment = `${comment}\n\nDeposition ID: ${this.cachedEntry.entryID}`;
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

      this.http.post(environment.supportURL, jsonData)
        .subscribe(responseJson => {
          resolve(responseJson);
        }, error => {
          this.handleError(error);
          reject();
        });
    });
  }

  newMicroDeposition(authorEmail: string,
                     depositionNickname: string,
                     orcid: string,
                     sessionValidity: string): Promise<string> {
    const apiEndPoint = `${environment.serverURL}/newmicro`;
    this.messagesService.sendMessage(new Message('Creating deposition...',
      MessageType.NotificationMessage, 0));

    const body = new FormData();
    body.append('email', authorEmail);
    body.append('deposition_nickname', depositionNickname);
    body.append('orcid', orcid);
    body.append('session_validity', sessionValidity);

    const options = {
      params: new HttpParams(),
      reportProgress: true,
    };

    return new Promise((resolve, reject) => {

      this.http.post(apiEndPoint, body, options)
        .subscribe(jsonData => {
          this.clearDeposition();
          this.messagesService.clearMessage();
          resolve(jsonData['deposition_id']);
        }, error => {
          if (error.error && error.error.error && error.error.error.includes('invalid') && error.error.error.includes('e-mail')) {
            reject('Invalid e-mail');
          }
          this.handleError(error);
          reject(error);
        });
    });
  }

  newDeposition(authorEmail: string,
                depositionNickname: string,
                depositionType: string,
                orcid: string = null,
                skipEmailValidation: boolean = false,
                file: File = null,
                bootstrapID: string = null): Promise<string> {
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

      this.http.post(apiEndPoint, body, options)
        .subscribe(jsonData => {
          this.clearDeposition();
          this.sidenavService.open().then();
          this.messagesService.clearMessage();
          resolve(jsonData['deposition_id']);
        }, error => {
          if (error.error && error.error.error && error.error.error.includes('invalid') && error.error.error.includes('e-mail')) {
            reject('Invalid e-mail');
          }
          this.handleError(error);
          reject(error);
        });
    });
  }

  depositEntry(feedback: string = null): Promise<boolean> {

    if (!this.cachedEntry.valid) {
      this.messagesService.sendMessage(new Message('Can not submit deposition: it is still incomplete!',
        MessageType.ErrorMessage, 15000));
      return;
    }

    const apiEndPoint = `${environment.serverURL}/${this.getEntryID()}/deposit`;

    const formData = new FormData();
    formData.append('deposition_contents', this.cachedEntry.print());

    this.messagesService.sendMessage(new Message('Submitting deposition...',
      MessageType.NotificationMessage, 0));

    return new Promise(((resolve, reject) => {
      this.http.post(apiEndPoint, formData).subscribe(jsonData => {
        if (!checkValueIsNull(feedback)) {
          this.newSupportRequest(feedback, 'BMRbig Feedback Message').then();
        }

        // Trigger everything watching the entry to see that it changed - because "deposited" changed
        this.cachedEntry.deposited = true;
        this.cachedEntry.refresh();
        this.storeEntry();

        this.messagesService.sendMessage(new Message('Submission accepted!',
          MessageType.NotificationMessage, 15000));
        this.router.navigate(['/entry']).then();
        resolve(jsonData['status']);
      }, error => {
        this.handleError(error);
        reject();
      });
    }));
  }

  resendValidationEmail(): Observable<any> {

    const apiEndPoint = `${environment.serverURL}/${this.getEntryID()}/resend-validation-email`;

    this.messagesService.sendMessage(new Message('Requesting new validation e-mail...',
      MessageType.NotificationMessage, 0));
    return this.http.get(apiEndPoint)
      .pipe(
        map(jsonData => {
          this.messagesService.clearMessage();
          return jsonData;
        }),
        // Convert the error into something we can handle
        catchError((error: HttpErrorResponse) => this.handleError(error))
      );
  }

  getEntryID(): string {
    if (this.cachedEntry === null) {
      return null;
    }
    return this.cachedEntry.entryID;
  }

  handleError(error: HttpErrorResponse): Observable<null> | null {
    if (error.error && error.error.error) {
      this.messagesService.sendMessage(new Message(error.error.error, MessageType.ErrorMessage, 15000));
    } else {
      this.messagesService.sendMessage(new Message('A network or server exception occurred.', MessageType.ErrorMessage, 15000));
    }
    if (!environment.production) {
      throw error;
    }

    return of(null);
  }


}
