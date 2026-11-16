import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { UsageChange, UsageState } from '../usage.models';

@Injectable({providedIn: 'root'})
export class UsageApiService {
  constructor(private http: HttpClient) {}
  load(projectId: number, operationId?: string): Observable<UsageState> {
    const params = operationId ? new HttpParams().set('operation_id', operationId) : new HttpParams();
    return this.http.get<UsageState>(this.url(projectId), {params});
  }
  save(projectId: number, change: UsageChange): Observable<UsageState> {
    return this.http.put<UsageState>(this.url(projectId), change);
  }
  private url(projectId: number): string {return `${environment.api_projects}${projectId}/usage/`;}
}
