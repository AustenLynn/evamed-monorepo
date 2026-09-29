import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

import { ProjectsService } from '../projects/projects.service';

// The stage pages identify the project they work on from
// localStorage['idProyectoConstrucción'] and sessionStorage['primaryDataProject'];
// the new-project pages also read the imported Excel from
// sessionStorage['dataProject']. Creating a project sets all three, but opening
// an existing one used to set only the first, so a stage page could crash or
// show (and save into) whichever project this tab created last.
@Injectable({ providedIn: 'root' })
export class ActiveProjectService {
  constructor(private projects: ProjectsService) {}

  /** Makes `id` the project every stage page works on. Emits once, when it's safe to navigate. */
  open(id: number | string): Observable<void> {
    localStorage.setItem('idProyectoConstrucción', String(id));
    // An existing project has no imported Excel in this tab, and nothing from
    // another project may survive, even if the fetch below fails.
    sessionStorage.removeItem('dataProject');
    sessionStorage.removeItem('primaryDataProject');

    return this.projects.getProjectById(String(id)).pipe(
      tap(project => sessionStorage.setItem('primaryDataProject', JSON.stringify(project))),
      catchError(error => {
        console.error('No se pudo cargar el proyecto', error);
        return of(null);
      }),
      map(() => undefined)
    );
  }
}
