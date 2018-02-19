import { Entry, entryFromJSON } from './nmrstar/entry';
import { Saveframe } from './nmrstar/saveframe';
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

  constructor(private http: HttpClient) {
    this.cached_entry = new Entry('');
  }

  getEntry(entry_id: string, skip_cache: boolean = false): Observable<Entry> {

    if ((entry_id === this.cached_entry.data_name) && (!skip_cache)) {
      return of(this.cached_entry);
    } else {
      const entry_url = `https://webapi.bmrb.wisc.edu/v2/entry/${entry_id}`;
      return this.http.get(entry_url).map(json_data => {
         this.cached_entry = entryFromJSON(json_data[entry_id]);
         return this.cached_entry;
       });
    }
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
