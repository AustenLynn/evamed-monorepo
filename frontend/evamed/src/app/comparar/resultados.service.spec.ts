import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from 'src/environments/environment';
import { Calculos } from '../calculos/calculos';
import { ResultadosService } from './resultados.service';

// A-32 plan, Task 2: Resultados reads its numbers from /results/?detalle=1.
describe('ResultadosService', () => {
  const GWP = 'Calentamiento global, total',
    url = `${environment.api_projects}7/results/`;
  let service: ResultadosService, http: HttpTestingController, nombre: string;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ResultadosService);
    http = TestBed.inject(HttpTestingController);
    nombre = TestBed.inject(Calculos).ajustarNombre(GWP);
  });
  afterEach(() => http.verify());

  it('adapts indicator names and maps the detail keys', () => {
    let got: any;
    service.cargar(7).subscribe(r => (got = r));
    http.expectOne(r => r.url === url).flush({
      project_id: 7,
      datos: { [GWP]: { Producción: { 'A1-A3': 5 } } },
      por_elemento: { [GWP]: { '1': 5 } },
      por_material: { Calculos: { [GWP]: { Producción: { 'A1-A3': { '1': 5 } } } }, materiales: { [GWP]: { Producción: { 'A1-A3': { '1': { '9': 5 } } } } } },
      nombres_materiales: { '9': 'Cemento' },
      excluded: null,
    });
    expect(got.datos).toEqual({ [nombre]: { Producción: { 'A1-A3': 5 } } });
    expect(got.porElemento).toEqual({ [nombre]: { '1': 5 } });
    expect(Object.keys(got.porMaterial.Calculos)).toEqual([nombre]);
    expect(Object.keys(got.porMaterial.materiales)).toEqual([nombre]);
    expect(got.nombresMateriales).toEqual({ '9': 'Cemento' });
    expect(service.obtener(7)).toBe(got);
  });

  it('requests detalle=1 once per project', () => {
    service.cargar(7).subscribe();
    service.cargar(7).subscribe();
    const req = http.expectOne(r => r.url === url);
    expect(req.request.params.get('detalle')).toBe('1');
    req.flush({ datos: {} });
    service.cargar(7).subscribe();
    http.expectNone(r => r.url === url);
  });

  it('does not cache a failure', () => {
    service.cargar(7).subscribe({ error: () => undefined });
    http.expectOne(r => r.url === url).flush('x', { status: 500, statusText: 'err' });
    service.cargar(7).subscribe();
    http.expectOne(r => r.url === url).flush({ datos: {} });
    expect(service.obtener(7)?.porElemento).toBeNull();
  });

  it('forgets a project', () => {
    service.cargar(7).subscribe();
    http.expectOne(r => r.url === url).flush({ datos: {} });
    service.olvidar(7);
    expect(service.obtener(7)).toBeUndefined();
  });
});
