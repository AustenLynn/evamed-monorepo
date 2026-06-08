import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap, shareReplay } from 'rxjs/operators';
import { environment } from './../../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ProjectsService {
  private materialSchemeCache$: Observable<any[]> | null = null;

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
    if (!this.materialSchemeCache$) {
      this.materialSchemeCache$ = this.http.get<any[]>(environment.api_scheme_project).pipe(
        tap( () => {
        //tap(data => {
          // console.log('Material scheme data loaded', data);
        }),
        shareReplay(1) // Cache the response and replay for new subscribers
      );
    }
    return this.materialSchemeCache$;
  }

  clearMaterialSchemeCache(): void {
    this.materialSchemeCache$ = null;
  }

  updateMaterialSchemeProject(id: string, changes: any): Observable<any> {
    return this.http
      .put(`${environment.api_scheme_project}${id}/`, changes)
      .pipe(
       tap(data => {
        // Invalidate cached data after a successful update
        this.clearMaterialSchemeCache();
        return data;
        })
      );
  }

  deleteSchemeProject(id: number): Observable<any> {
    return this.http
      .delete(`${environment.api_scheme_project}${id}/`)
      .pipe(
        tap(data => {
          this.clearMaterialSchemeCache();
          return data;
        })
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
