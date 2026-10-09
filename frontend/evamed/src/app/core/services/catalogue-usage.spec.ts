import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { AnalisisService } from './analisis/analisis.service';
import { ProjectsService } from './projects/projects.service';
import { MaterialsService } from './materials/materials.service';

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

describe('shared catalogues', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('MaterialsService and AnalisisService share one materials download', () => {
    TestBed.inject(MaterialsService).getMaterials().subscribe();
    TestBed.inject(AnalisisService).getMaterials().subscribe();
    TestBed.inject(MaterialsService).getMaterials().subscribe();

    http.expectOne(environment.api_materials).flush([]);
  });

  it('an admin edit refreshes materials for everyone', () => {
    const materials = TestBed.inject(MaterialsService);
    materials.getMaterials().subscribe();
    http.expectOne(environment.api_materials).flush([{ id: 1 }]);

    materials.addMaterial({ name_material: 'Nuevo' }).subscribe();
    http.expectOne(r => r.method === 'POST' && r.url === environment.api_materials).flush({ id: 2 });

    let list: any;
    TestBed.inject(AnalisisService).getMaterials().subscribe(v => (list = v));
    http.expectOne(r => r.method === 'GET' && r.url === environment.api_materials).flush([{ id: 1 }, { id: 2 }]);
    expect(list.length).toBe(2);
  });

  it('material-scheme-data is downloaded once and refreshed after a write', () => {
    const analisis = TestBed.inject(AnalisisService);
    analisis.getMaterialSchemeData().subscribe();
    analisis.getMaterialSchemeData().subscribe();
    http.expectOne(environment.api_material_scheme_data).flush([]);

    TestBed.inject(MaterialsService).deleteMaterialSchemeData(5).subscribe();
    http.expectOne(`${environment.api_material_scheme_data}5/`).flush(null);

    analisis.getMaterialSchemeData().subscribe();
    http.expectOne(r => r.method === 'GET' && r.url === environment.api_material_scheme_data).flush([]);
  });
});
