import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable()
export class ApiService {



  constructor(private http: HttpClient) { }

  getEntry(entry_id: string) {
    const entry_url = `https://webapi.bmrb.wisc.edu/v2/entry/${entry_id}`;
    return this.http.get(entry_url);
  }

   getSaveframe(entry_id: string, saveframe: string) {
    const entry_url = `https://webapi.bmrb.wisc.edu/v2/entry/${entry_id}?saveframe=${saveframe}`;
    return this.http.get(entry_url);
  }

}
