import { Injectable } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ProjectSavesService } from '../services/energy-total/project-saves.service';

const WRITES = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** After any confirmed write to the projects API, the stage pages' carbon bar reloads. */
@Injectable()
export class ProjectSavesInterceptor implements HttpInterceptor {
  constructor(private saves: ProjectSavesService) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (!WRITES.has(req.method) || !req.url.includes('/api-projects/')) return next.handle(req);
    return next.handle(req).pipe(
      tap(event => {
        if (event instanceof HttpResponse && event.ok) this.saves.notify();
      })
    );
  }
}
