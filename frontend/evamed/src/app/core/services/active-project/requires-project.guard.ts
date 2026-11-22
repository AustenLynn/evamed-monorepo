import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

const ID = /^[1-9]\d*$/;

/**
 * Opens a project page only when a project is active; otherwise goes home, where
 * the user picks one (audit A-26, 2026-11-22). Stage pages read the project from
 * localStorage['idProyectoConstrucción'] (ActiveProjectService); Resultados from
 * sessionStorage['projectID'].
 */
export function requiresProject(page: 'stage' | 'results'): CanActivateFn {
  return () => {
    let id: string | null = null;
    try {
      id = page === 'stage' ? localStorage.getItem('idProyectoConstrucción') : sessionStorage.getItem('projectID');
    } catch {
      /* Blocked storage: no active project. */
    }
    return id !== null && ID.test(id) ? true : inject(Router).parseUrl('/home-evamed');
  };
}
