import { Saveframe, saveframeFromJSON } from './nmrstar/nmrstar';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import {Observable} from 'rxjs/Observable';
import 'rxjs/add/operator/map';
import { of } from 'rxjs/observable/of';

@Injectable()
export class ApiService {



  constructor(private http: HttpClient) { }

  getEntry(entry_id: string) {
    const entry_url = `https://webapi.bmrb.wisc.edu/v2/entry/${entry_id}`;
    return this.http.get(entry_url);
  }

   getSaveframe(entry_id: string, saveframe: string): Observable<Saveframe> {
    const entry_url = `https://webapi.bmrb.wisc.edu/v2/entry/${entry_id}?saveframe=${saveframe}`;
     return this.http.get(entry_url).map(json_data => {
       return saveframeFromJSON(json_data[entry_id][saveframe]);
     });
  }

}
