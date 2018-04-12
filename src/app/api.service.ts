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

import { environment } from '../environments/environment';

@Injectable()
export class ApiService {

  cached_entry: Entry;

  constructor(private http: HttpClient) {
    this.cached_entry = new Entry('');
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
      console.log(this.cached_entry);
      return of(this.cached_entry);
    } else if ((entry_id === localStorage.getItem('entry_key')) && (!skip_cache)) {
      this.loadLocal();
      console.log(this.cached_entry);
      return of (this.cached_entry);
    } else {
      let entry_url = `https://webapi.bmrb.wisc.edu/v2/get_deposition/${entry_id}`;
      if (!environment.production) {
        entry_url = `http://localhost:8000/get_deposition/${entry_id}`;
      }
      return this.http.get(entry_url).map(json_data => {
         this.cached_entry = entryFromJSON(json_data);
         // TODO: This probably won't be necessary later
         this.cached_entry.entry_id = entry_id;
         console.log('Loaded entry from API.');
         this.saveLocal(true);
         console.log(this.cached_entry);
         return this.cached_entry;
       });
    }
  }
/*
  getSchema(): Observable<Schema> {
    const schema_url = 'http://localhost:8000/schema';
      return this.http.get(schema_url).map(json_data => {
        return new Schema(json_data['version'], json_data['headers'], json_data['tags'], json_data['data_types']);
     });

  }*/

  saveLocal(full_save: boolean = false): void {
    if (full_save) {
      localStorage.setItem('schema', JSON.stringify(this.cached_entry.schema));
    }
    localStorage.setItem('entry', JSON.stringify(this.cached_entry));
    localStorage.setItem('entry_key', this.cached_entry.entry_id);
    console.log('Saved entry to local storage.');
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
