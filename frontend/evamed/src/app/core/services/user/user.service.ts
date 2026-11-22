import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { finalize, shareReplay, tap } from 'rxjs/operators';
import { environment } from './../../../../environments/environment';


export interface Me {
  email: string;
  is_admin: boolean;
  email_verified: boolean;
  can_access_ecoplatform: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private mePendiente?: Observable<Me>;

  constructor(
    private http: HttpClient,
  ) { }

  addUser( userData: object ) {
    return this.http.post<any>(
      environment.api_users,
      userData
    ).pipe(
      tap(data => {
        return data;
      })
    );
  }

  getUsers() {
    return this.http.get<any>(environment.api_users).pipe(
      tap(data => {
        return data;
      })
    );
  }

  searchUser( email ) {
    return this.http.get<any>(
      environment.api_users + '?search=' + email,
    ).pipe(
      tap(data => {
        return data;
      })
    );
  }

  /**
   * Callers asking at the same time share one request; once it answers, the next
   * call asks again, so a change of rights is still seen (audit A-03).
   */
  getMe(): Observable<Me> {
    if (!this.mePendiente) {
      this.mePendiente = this.http.get<Me>(environment.api_me).pipe(
        finalize(() => (this.mePendiente = undefined)),
        shareReplay({ bufferSize: 1, refCount: false })
      );
    }
    return this.mePendiente;
  }
}
