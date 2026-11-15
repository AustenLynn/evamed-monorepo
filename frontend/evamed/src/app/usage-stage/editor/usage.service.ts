import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { UsageChange, UsageState } from './usage.models';

@Injectable({providedIn: 'root'})
export class UsageService {
  constructor(private http: HttpClient) {}
  load(projectId: number, operationId?: string): Observable<UsageState> {
    return this.http.get<UsageState>(`${environment.api_projects}${projectId}/usage/`,
      {params: operationId ? {operation_id: operationId} : {}});
  }
  save(projectId: number, change: UsageChange): Observable<UsageState> {
    return this.http.put<UsageState>(`${environment.api_projects}${projectId}/usage/`, change);
  }
}
