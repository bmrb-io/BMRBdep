import {inject, Injectable} from '@angular/core';
import {HttpClient, HttpErrorResponse} from '@angular/common/http';
import {Observable, of, throwError} from 'rxjs';
import {catchError} from 'rxjs/operators';
import {environment} from '../environments/environment';
import {ApiErrorHandler} from './api-error-handler.service';

export interface AdminDeposition {
  deposition_id: string;
  nickname: string | null;
  author_emails: string[];
  author_orcids: string[];
  author_names: string[];
  bmrbnum: number | null;
  creation_date: string | null;
  email_validated: boolean;
  entry_deposited: boolean;
}

export interface UnlockResponse {
  commit: string;
  entry_deposited: boolean;
}

export interface ValidateEmailResponse {
  commit: string;
  email_validated: boolean;
}

@Injectable({providedIn: 'root'})
export class AdminService {
  private http = inject(HttpClient);
  private errorHandler = inject(ApiErrorHandler);

  search(query: string): Observable<AdminDeposition[]> {
    const apiEndPoint = `${environment.serverURL}/admin/search`;
    return this.http.get<AdminDeposition[]>(apiEndPoint, {
      params: {q: query},
      withCredentials: true,
    }).pipe(
      catchError((error: HttpErrorResponse) => {
        this.errorHandler.handle(error);
        return of([]);
      })
    );
  }

  unlockDeposition(depositionId: string): Observable<UnlockResponse> {
    const apiEndPoint = `${environment.serverURL}/admin/deposition/${depositionId}/unlock`;
    return this.http.post<UnlockResponse>(apiEndPoint, {}, {withCredentials: true})
      .pipe(
        catchError((error: HttpErrorResponse) => {
          this.errorHandler.handle(error);
          return throwError(() => error);
        })
      );
  }

  validateEmail(depositionId: string): Observable<ValidateEmailResponse> {
    const apiEndPoint = `${environment.serverURL}/admin/deposition/${depositionId}/validate-email`;
    return this.http.post<ValidateEmailResponse>(apiEndPoint, {}, {withCredentials: true})
      .pipe(
        catchError((error: HttpErrorResponse) => {
          this.errorHandler.handle(error);
          return throwError(() => error);
        })
      );
  }

  deleteDeposition(depositionId: string): Observable<{status: string}> {
    const apiEndPoint = `${environment.serverURL}/admin/deposition/${depositionId}`;
    return this.http.delete<{status: string}>(apiEndPoint, {withCredentials: true})
      .pipe(
        catchError((error: HttpErrorResponse) => {
          this.errorHandler.handle(error);
          return throwError(() => error);
        })
      );
  }
}
