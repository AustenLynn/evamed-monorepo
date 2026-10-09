import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { AnalisisService } from './analisis/analisis.service';
import { ProjectsService } from './projects/projects.service';

describe('per-user project rows', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  // The results page reads these; a cached copy hides edits (and, after a
  // sign-in as someone else in the same tab, shows the previous user's rows).
  it('AnalisisService fetches them on every call', () => {
    const analisis = TestBed.inject(AnalisisService);
    analisis.getMaterialSchemeProyect().subscribe();
    http.expectOne(environment.api_scheme_project).flush([]);

    analisis.getMaterialSchemeProyect().subscribe();
    http.expectOne(environment.api_scheme_project).flush([]);
  });

  it('ProjectsService fetches them on every call', () => {
    const projects = TestBed.inject(ProjectsService);
    projects.getMaterialSchemeProyect().subscribe();
    http.expectOne(environment.api_scheme_project).flush([]);

    projects.getMaterialSchemeProyect().subscribe();
    http.expectOne(environment.api_scheme_project).flush([]);
  });
});
