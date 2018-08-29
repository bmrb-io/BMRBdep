import {Observable, of} from 'rxjs';
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

  cached_entry: Entry;
  server_url: string;

  JSONOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json'
    })
  };

  constructor(private http: HttpClient,
              public messagesService: MessagesService,
              private router: Router) {
    this.cached_entry = new Entry('');
    this.server_url = 'https://webapi.bmrb.wisc.edu/devel/deposition';
    if (!environment.production) {
      this.server_url = 'http://localhost:9000/deposition';
    }
  }

  // file from event.target.files[0]
  uploadFile(file: File): Observable<HttpEvent<any>> {

    const apiEndPoint = `${this.server_url}/${this.getEntryID()}/file`;

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
    const apiEndPoint = `${this.server_url}/${this.getEntryID()}/file/${fileName}`;
    this.http.delete(apiEndPoint).subscribe(
      () => {this.messagesService.sendMessage(new Message('File deleted.') ); return of(true); },
      () => {this.messagesService.sendMessage(new Message('Failed to delete file.',
                                                               MessageType.ErrorMessage, 15000 )); return of(false); }
    );
    return of(false);
  }

  getEntry(entry_id: string, skip_cache: boolean = false): Observable<Entry> {
    // If all we did was reroute, we still have the entry
    if ((entry_id === this.cached_entry.entry_id) && (!skip_cache)) {
      this.cached_entry['source'] = 'session memory';
    // The page is being reloaded, but we can get the entry from the browser cache
    } else if ((entry_id === localStorage.getItem('entry_key')) && (!skip_cache)) {
      this.loadLocal();
      this.cached_entry['source'] = 'browser cache';
    // We either don't have the entry or have a different one, so fetch from the API
    } else {
      const entry_url = `${this.server_url}/${entry_id}`;
      return this.http.get(entry_url).pipe(
          map(json_data => {
              this.cached_entry = entryFromJSON(json_data);
              // TODO: This probably won't be necessary later
              this.cached_entry.entry_id = entry_id;
              this.cached_entry['source'] = 'API server';
              this.saveEntry(true);
              console.log(this.cached_entry);
              return this.cached_entry;
           }),
        catchError(() => {
          this.messagesService.sendMessage(new Message('Invalid entry ID. Returning to main page in 10 seconds.',
                                                       MessageType.ErrorMessage, 10000));
          setTimeout(() => {this.router.navigate(['/']); }, 10000);
          return of(new Entry(entry_id));
        })
      );
    }

    console.log(this.cached_entry);
    return of(this.cached_entry);
  }

  saveEntry(initial_save: boolean = false, skipMessage: boolean = false): void {
    if (initial_save) {
      localStorage.setItem('schema', JSON.stringify(this.cached_entry.schema));
    }
    localStorage.setItem('entry', JSON.stringify(this.cached_entry));
    localStorage.setItem('entry_key', this.cached_entry.entry_id);

    // Save to remote server if we haven't just loaded the entry
    if (!initial_save) {
      const entry_url = `${this.server_url}/${this.cached_entry.entry_id}`;
      this.http.put(entry_url, JSON.stringify(this.cached_entry), this.JSONOptions).subscribe(
        () => {if (!skipMessage) {this.messagesService.sendMessage(new Message('Changes saved.')); }},
        err => this.handleError(err)
      );
    }
  }

  newDeposition(author_email: string, orcid: string): Observable<any> {
    const entry_url = `${this.server_url}/new`;
    const body = {'email': author_email, 'orcid': orcid};
    this.messagesService.sendMessage(new Message('Creating deposition...',
      MessageType.NotificationMessage, 0 ));
    return this.http.post(entry_url, JSON.stringify(body), this.JSONOptions)
      .pipe(
        map(json_data => {
          this.messagesService.clearMessage();
          return json_data;
        }),
        // Convert the error into something we can handle
        catchError((error: HttpErrorResponse) => this.handleError(error))
      );
  }

  private loadLocal(): void {
    // TODO: This will throw an uncaught exception if entry_key in local storage but the entry itself isn't
    const raw_json = JSON.parse(localStorage.getItem('entry'));
    raw_json['schema'] = JSON.parse(localStorage.getItem('schema'));
    this.cached_entry = entryFromJSON(raw_json);
    console.log('Loaded entry from local storage.');
  }

  getEntryID(): string {
    return this.cached_entry.entry_id;
  }

  /* If we need to compress in local storage in the future...
   * https://github.com/carlansley/angular-lz-string
   * http://pieroxy.net/blog/pages/lz-string/index.html
   * https://stackoverflow.com/questions/20773945/storing-compressed-json-data-in-local-storage
   */

  handleError(error: HttpErrorResponse) {
    if (error.status === 400) {
      this.messagesService.sendMessage(new Message(error.error.error,
        MessageType.WarningMessage, 15000 ));
    } else {
      this.messagesService.sendMessage(new Message('A network or server exception occurred.', MessageType.ErrorMessage, 15000));
      console.error('An unhandled server error code occurred:', error);
    }

    return of(null);
  }


}
