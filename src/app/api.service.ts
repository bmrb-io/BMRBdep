import {Observable, of, Subscription} from 'rxjs';
import {catchError, map} from 'rxjs/operators';
import {Entry, entryFromJSON} from './nmrstar/entry';
import {Injectable} from '@angular/core';
import {HttpClient, HttpErrorResponse, HttpEvent, HttpHeaders, HttpParams, HttpRequest} from '@angular/common/http';
import {environment} from '../environments/environment';
import {Message, MessagesService, MessageType} from './messages.service';
import {Router} from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  cachedEntry: Entry;
  activeSaveRequest: Subscription;

  JSONOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json'
    })
  };

  constructor(private http: HttpClient,
              private messagesService: MessagesService,
              private router: Router) {
    this.cachedEntry = new Entry('');
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
        this.messagesService.sendMessage(new Message('File deleted.'));
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

  getEntry(entry_id: string, skip_cache: boolean = false): Observable<Entry> {
    // If all we did was reroute, we still have the entry
    if ((entry_id === this.cachedEntry.entryID) && (!skip_cache)) {
      this.cachedEntry['source'] = 'session memory';
    // The page is being reloaded, but we can get the entry from the browser cache
    } else if ((entry_id === localStorage.getItem('entry_key')) && (!skip_cache)) {

      // Make sure both the entry and schema are saved locally - if not, getEntry() but force load from server
      const raw_json = JSON.parse(localStorage.getItem('entry'));
      if (raw_json === null) {
        return this.getEntry(entry_id, true);
      }
      raw_json['schema'] = JSON.parse(localStorage.getItem('schema'));
      if (raw_json['schema'] === null) {
        return this.getEntry(entry_id, true);
      }

      this.cachedEntry = entryFromJSON(raw_json);
      this.cachedEntry['source'] = 'browser cache';
    // We either don't have the entry or have a different one, so fetch from the API
    } else {
      const entry_url = `${environment.serverURL}/${entry_id}`;
      return this.http.get(entry_url).pipe(
        map(json_data => {
          this.cachedEntry = entryFromJSON(json_data);
          this.cachedEntry['source'] = 'API server';
          this.saveEntry(true);
          return this.cachedEntry;
        }),
        catchError(error => {
          if (environment.production) {
            this.messagesService.sendMessage(new Message('Invalid entry ID. Returning to main page in 10 seconds.',
              MessageType.ErrorMessage, 10000));
            setTimeout(() => {
              this.router.navigate(['/']);
            }, 10000);
            return of(new Entry(entry_id));
          } else {
            throw error;
          }
        })
      );
    }

    return of(this.cachedEntry);
  }

  saveEntry(initial_save: boolean = false, skipMessage: boolean = true): void {

    // If the previous save action is still in progress, cancel it
    if (this.activeSaveRequest) {
      this.activeSaveRequest.unsubscribe();
    }

    if (initial_save) {
      localStorage.setItem('schema', JSON.stringify(this.cachedEntry.schema));
    }
    localStorage.setItem('entry', JSON.stringify(this.cachedEntry));
    localStorage.setItem('entry_key', this.cachedEntry.entryID);

    // Save to remote server if we haven't just loaded the entry
    if (!initial_save) {
      const entry_url = `${environment.serverURL}/${this.cachedEntry.entryID}`;
      const parent = this;
      this.activeSaveRequest = this.http.put(entry_url, JSON.stringify(this.cachedEntry), this.JSONOptions).subscribe(
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

  newDeposition(author_email: string, orcid: string): Observable<any> {
    const apiEndPoint = `${environment.serverURL}/new`;
    const body = {'email': author_email, 'orcid': orcid};
    this.messagesService.sendMessage(new Message('Creating deposition...',
      MessageType.NotificationMessage, 0));
    return this.http.post(apiEndPoint, JSON.stringify(body), this.JSONOptions)
      .pipe(
        map(json_data => {
          this.messagesService.clearMessage();
          return json_data;
        }),
        // Convert the error into something we can handle
        catchError((error: HttpErrorResponse) => this.handleError(error))
      );
  }

  submitEntry(): Observable<any> {
    const apiEndPoint = `${environment.serverURL}/${this.getEntryID()}/deposit`;

    this.messagesService.sendMessage(new Message('Submitting deposition...',
      MessageType.NotificationMessage, 0));
    return this.http.post(apiEndPoint, null)
      .pipe(
        map(json_data => {
          this.messagesService.clearMessage();
          return json_data;
        }),
        // Convert the error into something we can handle
        catchError((error: HttpErrorResponse) => this.handleError(error))
      );
  }

  getEntryID(): string {
    return this.cachedEntry.entryID;
  }

  /* If we need to compress in local storage in the future...
   * https://github.com/carlansley/angular-lz-string
   * http://pieroxy.net/blog/pages/lz-string/index.html
   * https://stackoverflow.com/questions/20773945/storing-compressed-json-data-in-local-storage
   */

  handleError(error: HttpErrorResponse) {
    if (error.status === 400) {
      this.messagesService.sendMessage(new Message(error.error.error,
        MessageType.WarningMessage, 15000));
    } else {
      this.messagesService.sendMessage(new Message('A network or server exception occurred.', MessageType.ErrorMessage, 15000));
      console.error('An unhandled server error code occurred:', error);
    }

    return of(null);
  }


}
