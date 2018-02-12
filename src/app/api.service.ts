import { Saveframe, saveframeFromJSON, entryFromJSON } from './nmrstar/nmrstar';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Observable } from 'rxjs/Observable';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/catch';
import 'rxjs/add/observable/throw';

@Injectable()
export class ApiService {



  constructor(private http: HttpClient) { }

  getEntry(entry_id: string) {
    const entry_url = `https://webapi.bmrb.wisc.edu/v2/entry/${entry_id}`;
    return this.http.get(entry_url).map(json_data => {
       return entryFromJSON(json_data[entry_id]);
     }).catch(this.handleError);
  }

   getSaveframe(entry_id: string, saveframe: string): Observable<Saveframe> {
     const saveframe_url = `https://webapi.bmrb.wisc.edu/v2/entry/${entry_id}?saveframe=${saveframe}`;
     return this.http.get(saveframe_url).map(json_data => {
       return saveframeFromJSON(json_data[entry_id][saveframe]);
     }).catch(this.handleError);
  }

  private handleError(error: Response) {
    return Observable.throw(error.statusText);
  }

}
