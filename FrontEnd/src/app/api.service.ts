import {Observable, of, ReplaySubject, Subscription} from 'rxjs';
import {catchError, map} from 'rxjs/operators';
import {Entry, entryFromJSON} from './nmrstar/entry';
import {Injectable} from '@angular/core';
import {HttpClient, HttpErrorResponse, HttpEvent, HttpHeaders, HttpParams, HttpRequest} from '@angular/common/http';
import {environment} from '../environments/environment';
import {Message, MessagesService, MessageType} from './messages.service';
import {ActivatedRoute, NavigationEnd, Router} from '@angular/router';

@Injectable({
    providedIn: 'root'
})
export class ApiService {

    private cachedEntry: Entry;
    private activeSaveRequest: Subscription;
    entrySubject: ReplaySubject<Entry>;

    private JSONOptions = {
        headers: new HttpHeaders({
            'Content-Type': 'application/json'
        })
    };

    constructor(private http: HttpClient,
                private messagesService: MessagesService,
                private router: Router,
                private route: ActivatedRoute) {

        this.entrySubject = new ReplaySubject<Entry>();

        this.entrySubject.subscribe(entry => {
            this.cachedEntry = entry;
        });

        const rawJSON = JSON.parse(localStorage.getItem('entry'));
        const schema = JSON.parse(localStorage.getItem('schema'));
        if (rawJSON !== null && schema !== null) {
            rawJSON['schema'] = schema;
            const entry = entryFromJSON(rawJSON);
            this.entrySubject.next(entry);
        } else {
            const sub = this.router.events.subscribe(event => {
                if (event instanceof NavigationEnd) {
                    let r = this.route;
                    while (r.firstChild) {
                        r = r.firstChild;
                    }
                    r.params.subscribe(() => {
                        if (this.router.url.indexOf('/load/') < 0 && !this.cachedEntry) {
                            sub.unsubscribe();
                            router.navigate(['/']);
                        }
                    });
                }
            });
        }
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

    deleteFile(fileName: string): void {
        const apiEndPoint = `${environment.serverURL}/${this.getEntryID()}/file/${fileName}`;
        this.http.delete(apiEndPoint).subscribe(
            () => {
                this.messagesService.sendMessage(new Message('File \'' + fileName + '\' deleted.'));
                this.cachedEntry.dataStore.deleteFile(fileName);
                this.cachedEntry.updateUploadedData();
                this.cachedEntry.refresh();
                this.saveEntry(false, true);
            },
            () => {
                this.messagesService.sendMessage(new Message('Failed to delete file.',
                    MessageType.ErrorMessage, 15000));
            }
        );
    }

    checkValid(): Observable<boolean> {
        if (!this.cachedEntry) {
            return of(false);
        }

        const entryURL = `${environment.serverURL}/${this.cachedEntry.entryID}/check-valid`;
        return this.http.get(entryURL).pipe(
            map(response => {
                return response['status'];
            }),
            // Convert the error into something we can handle
            catchError((error: HttpErrorResponse) => this.handleError(error))
        );
    }

    loadEntry(entryID: string): void {
        const entryURL = `${environment.serverURL}/${entryID}`;
        this.messagesService.sendMessage(new Message(`Loading entry ${entryID}...`));
        this.http.get(entryURL).subscribe(
            jsonData => {
                this.messagesService.clearMessage();
                this.entrySubject.next(entryFromJSON(jsonData));
                this.saveEntry(true);
            },
            error => this.handleError(error)
        );
    }

    saveEntry(initialSave: boolean = false, skipMessage: boolean = true): void {

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
            const parent = this;
            this.activeSaveRequest = this.http.put(entryURL, JSON.stringify(this.cachedEntry), this.JSONOptions).subscribe(
                () => {
                    if (!skipMessage) {
                        this.messagesService.sendMessage(new Message('Changes saved.'));
                    }
                    parent.activeSaveRequest = null;
                },
                err => this.handleError(err)
            );
        }
    }

    newDeposition(authorEmail: string,
                  depositionNickname: string,
                  orcid: string = null,
                  file: File = null,
                  bootstrapID: string = null): Observable<any> {
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

        return this.http.post(apiEndPoint, body, options)
            .pipe(
                map(jsonData => {
                    this.messagesService.clearMessage();
                    return jsonData;
                }),
                // Convert the error into something we can handle
                catchError((error: HttpErrorResponse) => this.handleError(error))
            );
    }

    depositEntry(): Observable<any> {

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

        return this.http.post(apiEndPoint, formData)
            .pipe(
                map(jsonData => {
                    // Trigger everything watching the entry to see that it changed - because "deposited" changed
                    this.cachedEntry.deposited = true;
                    this.entrySubject.next(this.cachedEntry);

                    this.messagesService.clearMessage();
                    return jsonData;
                }),
                // Convert the error into something we can handle
                catchError((error: HttpErrorResponse) => this.handleError(error))
            );
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

    handleError(error: HttpErrorResponse) {
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
