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
import {MatDialog} from '@angular/material';

@Injectable({
  providedIn: 'root'
})
export class ApiService implements OnDestroy {

  private cachedEntry: Entry;
  private activeSaveRequest: Subscription;
  entrySubject: ReplaySubject<Entry>;
  subscription$: Subscription;

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
              private dialog: MatDialog) {

    this.entrySubject = new ReplaySubject<Entry>();

    this.entrySubject.subscribe(entry => {
      this.cachedEntry = entry;
      if (entry) {
        this.titleService.setTitle(`BMRBDep: ${entry.depositionNickname}`);
      }
    });

    const rawJSON = JSON.parse(localStorage.getItem('entry'));
    const schema = JSON.parse(localStorage.getItem('schema'));
    if (rawJSON !== null && schema !== null) {
      rawJSON['schema'] = schema;
      const entry = entryFromJSON(rawJSON);
      this.entrySubject.next(entry);
      if (entry.unsaved) {
        this.saveEntry(false, false);
      }
    } else {
      this.subscription$ = this.router.events.subscribe(
        event => {
          if (event instanceof NavigationEnd) {
            if (this.router.url.indexOf('/load/') < 0 && this.router.url.indexOf('help') < 0 && !this.cachedEntry) {
              this.subscription$.unsubscribe();
              router.navigate(['/']);
            }
          }
        }
      );
    }

    // Used to open verification links in same tab
    window.name = 'BMRBDep';
  }

  ngOnDestroy() {
    this.subscription$.unsubscribe();
  }

  clearDeposition(): void {
    localStorage.removeItem('entry');
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
        this.cachedEntry.commit = response['commit'];
        this.saveEntry(false, true);
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

  checkValid(): Promise<boolean> {
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

  loadEntry(entryID: string, skipMessage: boolean = false): void {
    const entryURL = `${environment.serverURL}/${entryID}`;
    if (!skipMessage) {
      this.messagesService.sendMessage(new Message(`Loading entry ${entryID}...`));
    }
    this.http.get(entryURL).subscribe(
      jsonData => {
        if (!skipMessage) {
          this.messagesService.clearMessage();
        }
        this.entrySubject.next(entryFromJSON(jsonData));
        this.saveEntry(true);
      },
      error => this.handleError(error)
    );
  }

  saveEntry(initialSave: boolean = false, skipMessage: boolean = true, override: boolean = false): void {

    // If the previous save action is still in progress, cancel it
    if (this.activeSaveRequest) {
      this.activeSaveRequest.unsubscribe();
    }

    if (initialSave) {
      localStorage.setItem('schema', JSON.stringify(this.cachedEntry.schema));
    }
    localStorage.setItem('entry', JSON.stringify(this.cachedEntry));

    // Save to remote server if we haven't just loaded the entry
    if (!initialSave) {
      const entryURL = `${environment.serverURL}/${this.cachedEntry.entryID}`;
      const jsonObject = this.cachedEntry.toJSON();
      if (override) {
        jsonObject['force'] = true;
      }
      this.activeSaveRequest = this.http.put(entryURL, JSON.stringify(jsonObject), this.JSONOptions).subscribe(
        response => {
          if ('error' in response && response['error'] === 'reload') {

            this.cachedEntry.unsaved = true;
            const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
              disableClose: false
            });

            dialogRef.componentInstance.confirmMessage = 'Changes to this deposition have been detected on the server - changes most ' +
              ' likely made from a different tab, browser, or computer. Would you like to load the changes from the server, ' +
              'losing your most recent changes, or push your changes to the server, overriding what is stored there? (If you are ' +
              'unsure, load changes from the server.)';
            dialogRef.componentInstance.proceedMessage = 'Load changes from server';
            dialogRef.componentInstance.cancelMessage = 'Push changes to server';

            dialogRef.afterClosed().subscribe(result => {
              if (result) {
                this.loadEntry(this.cachedEntry.entryID, true);
              } else if (result === false) {
                this.saveEntry(false, false, true);
              } else if (result === undefined) {
                this.cachedEntry.unsaved = true;
              }
            });

          } else {
            if (!skipMessage) {
              this.messagesService.sendMessage(new Message('Changes saved.'));
            }
            this.activeSaveRequest = null;
            this.cachedEntry.commit = response['commit'];
            this.cachedEntry.unsaved = false;
            localStorage.setItem('entry', JSON.stringify(this.cachedEntry));
          }
        },
        () => {
          if (!this.cachedEntry.unsaved) {
            this.messagesService.sendMessage(new Message('Save attempt failed. Perhaps you have lost your internet' +
              ' connection? Changes can still be made to the deposition, but please don\'t clear your browser cache until internet' +
              ' is restored and the entry can be saved.'));
          }
          this.cachedEntry.unsaved = true;
        }
      );
    }
  }

  newDeposition(authorEmail: string,
                depositionNickname: string,
                orcid: string = null,
                file: File = null,
                bootstrapID: string = null): Promise<string> {
    const apiEndPoint = `${environment.serverURL}/new`;
    this.messagesService.sendMessage(new Message('Creating deposition...',
      MessageType.NotificationMessage, 0));

    const body = new FormData();
    body.append('email', authorEmail);
    body.append('deposition_nickname', depositionNickname);
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
          this.messagesService.clearMessage();
          resolve(jsonData['deposition_id']);
        }, error => {
          this.handleError(error);
          reject();
        });
    });
  }

  depositEntry(): Promise<boolean> {

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
        // Trigger everything watching the entry to see that it changed - because "deposited" changed
        this.cachedEntry.deposited = true;
        this.saveEntry(true);
        this.entrySubject.next(this.cachedEntry);

        this.messagesService.sendMessage(new Message('Submission accepted!',
          MessageType.NotificationMessage, 15000));
        this.router.navigate(['/entry']);
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
    if (error.status === 400 || (error.status === 500 && error.error)) {
      this.messagesService.sendMessage(new Message(error.error.error,
        MessageType.ErrorMessage, 15000));
    } else {
      this.messagesService.sendMessage(new Message('A network or server exception occurred.', MessageType.ErrorMessage, 15000));
    }
    if (environment.debug) {
      throw error;
    }

    return of(null);
  }


}
