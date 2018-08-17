import {Observable, of, throwError} from 'rxjs';
import {map, catchError} from 'rxjs/operators';
import {Entry, entryFromJSON} from './nmrstar/entry';
import {Injectable} from '@angular/core';
import {HttpClient, HttpErrorResponse, HttpHeaders} from '@angular/common/http';
import {environment} from '../environments/environment';
import {Message, MessagesService, MessageType} from './messages.service';

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
              private messagesService: MessagesService) {
    this.cached_entry = new Entry('');
    this.server_url = 'https://webapi.bmrb.wisc.edu/devel/deposition';
    if (!environment.production) {
      this.server_url = 'http://localhost:9000/deposition';
    }
  }

  getEntry(entry_id: string, skip_cache: boolean = false): Observable<Entry> {
    if ((entry_id === this.cached_entry.entry_id) && (!skip_cache)) {
      console.log('Loaded entry from session memory.');
      console.log(this.cached_entry);
      return of(this.cached_entry);
    } else if ((entry_id === localStorage.getItem('entry_key')) && (!skip_cache)) {
      this.loadLocal();
      console.log(this.cached_entry);
      return of (this.cached_entry);
    } else {
      console.log(environment);
      const entry_url = `${this.server_url}/${entry_id}`;
      return this.http.get(entry_url).pipe(
          map(json_data => {
            this.cached_entry = entryFromJSON(json_data);
         // TODO: This probably won't be necessary later
         this.cached_entry.entry_id = entry_id;
         console.log('Loaded entry from API.');
         this.saveEntry(true);
         console.log(this.cached_entry);
         return this.cached_entry;
       }));
    }
  }

  saveEntry(initial_save: boolean = false): void {
    if (initial_save) {
      localStorage.setItem('schema', JSON.stringify(this.cached_entry.schema));
    }
    localStorage.setItem('entry', JSON.stringify(this.cached_entry));
    localStorage.setItem('entry_key', this.cached_entry.entry_id);

    // Save to remote server if we haven't just loaded the entry
    if (!initial_save) {
      const entry_url = `${this.server_url}/${this.cached_entry.entry_id}`;
      this.http.put(entry_url, JSON.stringify(this.cached_entry), this.JSONOptions).subscribe(
        () => this.messagesService.sendMessage(new Message('Changes saved.') ),
        () => this.messagesService.sendMessage(new Message('Failed to save changes on the server. Changes are saved ' +
          'locally in your browser. If this message persists, <a href="mailto:bmrbhelp@bmrb.wisc.edu">please contact us</a>.',
                                                                 MessageType.WarningMessage, 10000 ))
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
        catchError((error: HttpErrorResponse) => {
          if (error.status === 400) {
            this.messagesService.sendMessage(new Message(error.error.error,
              MessageType.WarningMessage, 10000 ))
            return of(null);
          }
        })
      );
  }

  private loadLocal(): void {
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

  private handleError(error: HttpErrorResponse) {
    if (error.error instanceof ErrorEvent) {
      // A client-side or network error occurred. Handle it accordingly.
      console.error('An error occurred:', error.error.message);
    } else {
      // The backend returned an unsuccessful response code.
      // The response body may contain clues as to what went wrong,
      console.error(
        `Backend returned code ${error.status}, ` +
        'body was:', error.error);
    }
    // return an observable with a user-facing error message
    return throwError(
      'Something bad happened; please try again later.');
  }

}
