import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from './../../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ProjectsService {
  constructor(private http: HttpClient) {}

  addProject(projectData: object) {
    return this.http.post<any>(environment.api_projects, projectData).pipe(
      tap(data => {
        return data;
      })
    );
  }

  getProjectById(id: string) {
    return this.http.get(`${environment.api_projects}${id}/`).pipe(
      tap(data => {
        return data;
      })
    );
  }

  updateProyect(id: string, changes) {
    return this.http.put(`${environment.api_projects}${id}/`, changes).pipe(
      tap(data => {
        return data;
      })
    );
  }

  deleteProject(id: number) {
    return this.http.delete(`${environment.api_projects}${id}/`).pipe(
      tap(data => {
        return data;
      })
    );
  }

  addSchemeProject(schemeData: object) {
    return this.http.post<any>(environment.api_scheme_project, schemeData).pipe(
      tap(data => {
        return data;
      })
    );
  }

  addSchemeProjectOriginal(schemeData: object) {
    return this.http
      .post<any>(environment.api_scheme_project_original, schemeData)
      .pipe(
        tap(data => {
          return data;
        })
      );
  }

  getMaterialSchemeProyect(): Observable<any[]> {
    // The signed-in user's own rows: never cached.
    return this.http.get<any[]>(environment.api_scheme_project);
  }

  updateMaterialSchemeProject(id: string, changes: any): Observable<any> {
    return this.http
      .put(`${environment.api_scheme_project}${id}/`, changes)
      .pipe(
       tap(data => {
        return data;
        })
      );
  }

  deleteSchemeProject(id: number): Observable<any> {
    return this.http
      .delete(`${environment.api_scheme_project}${id}/`)
      .pipe(
        tap(data => {
          return data;
        })
      );
  }
  /**
   * Sets the project's material rows for `origins` x `sections` to exactly `items`
   * (server-side, atomically). Rows the API can't store come back in `skipped`.
   */
  replaceMaterialScheme(
    projectId: number,
    origins: number[],
    sections: number[],
    items: object[]
  ): Observable<{ items: any[]; skipped: { index: number; errors: any }[] }> {
    return this.http
      .put<{ items: any[]; skipped: { index: number; errors: any }[] }>(
        `${environment.api_projects}${projectId}/material-scheme/`,
        { origins, sections, items }
      );
  }


  getMaterialSchemeProyectOrigin() {
    return this.http.get<any>(environment.api_scheme_project_original).pipe(
      tap(data => {
        return data;
      })
    );
  }

  getProjects() {
    return this.http.get<any>(environment.api_projects).pipe(
      tap(data => {
        return data;
      })
    );
  }

  searchProject(project) {
    console.log(environment.api_projects + '?search=' + project);
    return this.http
      .get<any>(environment.api_projects + '?search=' + project)
      .pipe(
        tap(data => {
          return data;
        })
      );
  }
}
