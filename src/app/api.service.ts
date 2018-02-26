import { Entry, entryFromJSON } from './nmrstar/entry';
import { Saveframe } from './nmrstar/saveframe';
import { Schema } from './nmrstar/schema';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Observable } from 'rxjs/Observable';
import { of } from 'rxjs/observable/of';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/catch';
import 'rxjs/add/observable/throw';


@Injectable()
export class ApiService {

  cached_entry: Entry;
  schema: Schema;

  constructor(private http: HttpClient) {
    this.cached_entry = new Entry('');
    this.schema = null;
    this.getSchema();
  }

/*
 import 'rxjs/add/observable/interval';

   Observable.interval(100000)
    .subscribe(i => {
      console.log('sss');
        // This will be called every 10 seconds until `stopCondition` flag is set to true
    });
*/

  getEntry(entry_id: string, skip_cache: boolean = false): Observable<Entry> {

    if ((entry_id === this.cached_entry.entry_id) && (!skip_cache)) {
      console.log('Loaded entry from session memory.');
      this.saveLocal();
      return of(this.cached_entry);
    } else if ((entry_id === localStorage.getItem('entry_key')) && (!skip_cache)) {
      this.loadLocal();
      return of (this.cached_entry);
    } else {
      const entry_url = `https://webapi.bmrb.wisc.edu/v2/entry/${entry_id}`;
      return this.http.get(entry_url).map(json_data => {
         this.cached_entry = entryFromJSON(json_data[entry_id]);
         console.log('Loaded entry from API.');
         this.saveLocal();
         return this.cached_entry;
       });
    }
  }

  getSchema(): Observable<Schema> {
    const schema_url = 'http://localhost:8000/schema';
    if (this.schema != null) {
      return of(this.schema);
    } else {
        return this.http.get(schema_url).map(json_data => {
          this.schema = new Schema(json_data['version'], json_data['headers'], json_data['tags'], json_data['data_types']);
          return this.schema;
       });
    }
  }

  private saveLocal(): void {
    localStorage.setItem('entry', JSON.stringify(this.cached_entry));
    localStorage.setItem('entry_key', this.cached_entry.entry_id);
    console.log('Saved entry to local storage.');
  }

  private loadLocal(): void {
    this.cached_entry = entryFromJSON(JSON.parse(localStorage.getItem('entry')));
    console.log('Loaded entry from local storage.');
  }

  getEntryID(): string {
    return this.cached_entry.entry_id;
  }

  /* obsolete but kept for now for reference
   getSaveframeByName(entry_id: string, saveframe_name: string): Observable<Saveframe> {
     const saveframe_url = `https://webapi.bmrb.wisc.edu/v2/entry/${entry_id}?saveframe_name=${saveframe_name}`;
     return this.http.get(saveframe_url).map(json_data => {
       return saveframeFromJSON(json_data[entry_id][saveframe_name]);
     });
  }

  getSaveframesByCategory(entry_id: string, saveframe_category: string): Observable<Saveframe[]> {
     const saveframe_url = `https://webapi.bmrb.wisc.edu/v2/entry/${entry_id}?saveframe_category=${saveframe_category}`;
     return this.http.get(saveframe_url).map(json_data => {
       return saveframesFromJSON(json_data[entry_id][saveframe_category]);
     });
  } */

  // .catch(this.handleError)
  private handleError(error: Response) {
    return Observable.throw(error.statusText);
  }

}
