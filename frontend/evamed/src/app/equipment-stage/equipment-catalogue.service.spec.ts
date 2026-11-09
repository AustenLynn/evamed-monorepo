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
  it('maps real process, source types and construction EnergyUnit IDs unchanged', () => {
    service.load('construction').subscribe(data => {
      expect(data.constructionEnergyProcessId).toBe(8);
      expect(data.sources.map(s => s.type)).toEqual(['Generador', 'Maquinaria ligera', 'Maquinaria pesada', 'Otros']);
      expect(data.units).toEqual([{ id: 2, name: 'Hrs' }, { id: 3, name: 'MJ' }]);
    });
    http.expectOne(env.api_source_information).flush(['Generador Diesel', 'Maquinaria de carga ligera', 'Maquinaria de carga pesada', 'Excavadora', 'Mexicaniuh - CADIS'].map((name, id) => ({ id, name_source_information: name })));
    http.expectOne(env.api_energy_units).flush([{ id: 2, name_energy_unit: 'Hrs' }, { id: 3, name_energy_unit: 'MJ' }]);
    http.expectOne(env.api_constructive_process).flush([{ id: 8, name_constructive_process: energyProcess }]);
  });
  it('matches end-life choices by normalized name and preserves all actual Unit labels, cached', () => {
    const verify = (data: any) => {
      expect(data.units).toEqual([{ id: 12, name: 'MJ' }]);
      expect(data.unitLabels).toContainEqual({ id: 2, name: 'Kg' });
    };
    service.load('end-life').subscribe(verify);
    http.expectOne(env.api_source_information).flush([]);
    http.expectOne(env.api_energy_units).flush([{ id: 2, name_energy_unit: 'Hrs' }, { id: 3, name_energy_unit: ' mj ' }]);
    http.expectOne(env.api_units).flush([{ id: 2, name_unit: 'Kg' }, { id: 12, name_unit: 'MJ' }]);
    service.load('end-life').subscribe(verify);
    http.expectNone(env.api_units);
  });
});
