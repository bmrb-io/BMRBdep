import {BehaviorSubject, Observable, of, Subscription} from 'rxjs';
import {catchError, map} from 'rxjs/operators';
import {Entry, entryFromJSON} from './nmrstar/entry';
import {Injectable} from '@angular/core';
import {HttpClient, HttpErrorResponse, HttpEvent, HttpHeaders, HttpParams, HttpRequest} from '@angular/common/http';
import {environment} from '../environments/environment';
import {Message, MessagesService, MessageType} from './messages.service';

@Injectable({
    providedIn: 'root'
})
export class ApiService {

    private cachedEntry: Entry;
    private activeSaveRequest: Subscription;
    entrySubject: BehaviorSubject<Entry>;

    private JSONOptions = {
        headers: new HttpHeaders({
            'Content-Type': 'application/json'
        })
    };

    constructor(private http: HttpClient,
                private messagesService: MessagesService) {


        const rawJSON = JSON.parse(localStorage.getItem('entry'));
        const schema = JSON.parse(localStorage.getItem('schema'));
        if (rawJSON !== null && schema !== null) {
            rawJSON['schema'] = schema;
            const entry = entryFromJSON(rawJSON);
            this.entrySubject = new BehaviorSubject<Entry>(entry);
        } else {
            this.entrySubject = new BehaviorSubject<Entry>(null);
        }

        this.entrySubject.subscribe(entry => {
            this.cachedEntry = entry;
        });
    }

    clearDeposition(): void {
        localStorage.removeItem('entry_key');
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

    deleteFile(fileName: string): Observable<boolean> {
        const apiEndPoint = `${environment.serverURL}/${this.getEntryID()}/file/${fileName}`;
        this.http.delete(apiEndPoint).subscribe(
            () => {
                this.messagesService.sendMessage(new Message('File \'' + fileName + '\' deleted.'));
                return of(true);
            },
            () => {
                this.messagesService.sendMessage(new Message('Failed to delete file.',
                    MessageType.ErrorMessage, 15000));
                return of(false);
            }
        );
        return of(false);
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

    loadEntry(entryID: string, skipCache: boolean = false): void {
        // If all we did was reroute, we still have the entry
        if ((this.cachedEntry && entryID === this.cachedEntry.entryID) && (!skipCache)) {
            return;
            // The page is being reloaded, but we can get the entry from the browser cache
        } else if ((entryID === localStorage.getItem('entry_key')) && (!skipCache)) {

            // Make sure both the entry and schema are saved locally - if not, loadEntry() but force load from server
            const rawJSON = JSON.parse(localStorage.getItem('entry'));
            if (rawJSON === null) {
                return this.loadEntry(entryID, true);
            }
            rawJSON['schema'] = JSON.parse(localStorage.getItem('schema'));
            if (rawJSON['schema'] === null) {
                return this.loadEntry(entryID, true);
            }

            this.entrySubject.next(entryFromJSON(rawJSON));
            // We either don't have the entry or have a different one, so fetch from the API
        } else {
            const entryURL = `${environment.serverURL}/${entryID}`;
            this.messagesService.sendMessage(new Message(`Loading entry ${entryID}...`));
            this.http.get(entryURL).subscribe(
                jsonData => {
                    this.entrySubject.next(entryFromJSON(jsonData));
                    this.saveEntry(true);
                    this.messagesService.clearMessage();
                },
                error => this.handleError(error)
            );
        }
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
        localStorage.setItem('entry_key', this.cachedEntry.entryID);

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

    submitEntry(): Observable<any> {

        if (!this.cachedEntry.valid) {
            this.messagesService.sendMessage(new Message('Can not submit deposition: it is still incomplete!',
                MessageType.ErrorMessage, 15000));
            return;
        }

        const apiEndPoint = `${environment.serverURL}/${this.getEntryID()}/deposit`;

        this.messagesService.sendMessage(new Message('Submitting deposition...',
            MessageType.NotificationMessage, 0));
        return this.http.post(apiEndPoint, null)
            .pipe(
                map(jsonData => {
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
