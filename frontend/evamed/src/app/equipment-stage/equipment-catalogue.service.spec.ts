import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { EquipmentCatalogueService } from './equipment-catalogue.service';
import { environment as env } from '../../environments/environment';

export const energyProcess = 'Energía consumida durante el proceso constructivo';
describe('EquipmentCatalogueService', () => {
  let service: EquipmentCatalogueService,
   http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(EquipmentCatalogueService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('loads every metadata page, caches sources across stages, and preserves unknown metadata', () => {
    let result: any;
    service.load('construction').subscribe(data => result = data);
    const page = (id: number, next: string | null) => ({count: 2, next, previous: null, facets: {}, results: [{id, name: id === 11 ? 'Excavadora hidráulica (GLO)' : 'Generador (MX)-Ecoinvent 3', display_name: id === 11 ? 'Excavadora hidráulica' : 'Generador', source: id === 11 ? null : 'ECOINVENT 3', region: id === 11 ? 'Global' : 'México', type: 'Otros'}]});
    http.expectOne(request => request.url === env.api_explorer + 'construccion/' && request.params.get('page') === '1').flush(page(11, '?page=2'));
    expect(result).toBeUndefined();
    http.expectOne(request => request.url === env.api_explorer + 'construccion/' && request.params.get('page') === '2').flush(page(12, null));
    http.expectOne(env.api_energy_units).flush([]);
    http.expectOne(env.api_constructive_process).flush([]);
    expect(result.sources).toEqual([
      {id: 11, name: 'Excavadora hidráulica (GLO)', displayName: 'Excavadora hidráulica', database: null, region: 'Global', type: 'Otros'},
      {id: 12, name: 'Generador (MX)-Ecoinvent 3', displayName: 'Generador', database: 'ECOINVENT 3', region: 'México', type: 'Otros'},
    ]);
    service.load('end-life').subscribe(data => expect(data.sources).toEqual(result.sources));
    http.expectOne(env.api_units).flush([]);
    http.expectNone(request => request.url.includes('/explorer/'));
  });
  it('maps real process, source types and construction EnergyUnit IDs unchanged', () => {
    service.load('construction').subscribe(data => {
      expect(data.constructionEnergyProcessId).toBe(8);
      expect(data.sources.map(s => s.type)).toEqual(['Generador', 'Maquinaria ligera', 'Maquinaria pesada', 'Otros']);
      expect(data.units).toEqual([{ id: 2, name: 'Hrs' }, { id: 3, name: 'MJ' }]);
    });
    http.expectOne(request => request.url === env.api_explorer + 'construccion/').flush({count: 5, next: null, results: ['Generador Diesel', 'Maquinaria de carga ligera', 'Maquinaria de carga pesada', 'Excavadora', 'Mexicaniuh - CADIS'].map((name, id) => ({id, name, display_name: name, source: null, region: null, type: ['Generador', 'Maquinaria ligera', 'Maquinaria pesada', 'Otros', 'Otros'][id]}))});
    http.expectOne(env.api_energy_units).flush([{ id: 2, name_energy_unit: 'Hrs' }, { id: 3, name_energy_unit: 'MJ' }]);
    http.expectOne(env.api_constructive_process).flush([{ id: 8, name_constructive_process: energyProcess }]);
  });
  it('matches end-life choices by normalized name and preserves all actual Unit labels, cached', () => {
    const verify = (data: any) => {
      expect(data.units).toEqual([{ id: 12, name: 'MJ' }]);
      expect(data.unitLabels).toContainEqual({ id: 2, name: 'Kg' });
    };
    service.load('end-life').subscribe(verify);
    http.expectOne(request => request.url === env.api_explorer + 'construccion/').flush({count: 0, next: null, results: []});
    http.expectOne(env.api_energy_units).flush([{ id: 2, name_energy_unit: 'Hrs' }, { id: 3, name_energy_unit: ' mj ' }]);
    http.expectOne(env.api_units).flush([{ id: 2, name_unit: 'Kg' }, { id: 12, name_unit: 'MJ' }]);
    service.load('end-life').subscribe(verify);
    http.expectNone(env.api_units);
  });
});
