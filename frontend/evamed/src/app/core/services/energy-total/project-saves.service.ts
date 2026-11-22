import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

/** Signals that project data was saved. It has no dependencies, so the HTTP
 *  interceptor can use it without a DI cycle through HttpClient. */
@Injectable({ providedIn: 'root' })
export class ProjectSavesService {
  private readonly saves = new Subject<void>();
  readonly saved$: Observable<void> = this.saves.asObservable();

  notify(): void {
    this.saves.next();
  }
}
