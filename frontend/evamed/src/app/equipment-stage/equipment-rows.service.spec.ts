import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { EquipmentRowsService } from './equipment-rows.service';
import { environment as env } from '../../environments/environment';

const processName = 'Energía consumida durante el proceso constructivo';
describe('EquipmentRowsService', () => {
  let service: EquipmentRowsService,
   http: HttpTestingController;
  const input = { sourceId: 11, quantity: 0, unitId: null },
   raw = { id: 73, project_id: 42, section_id: 3, source_information_id: 11, quantity: 0, energy_unit_id: null, unit_id: null, constructive_process_id: 8 };
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(EquipmentRowsService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  for (const stage of ['construction', 'end-life'] as const) {
    const url = stage === 'construction' ? env.api_construction_stage : env.api_electricity_consumption_deconstructive_process;
    it(`${stage}: creates blank persisted row and reloads ID; explicit project filtering`, () => {
      service.create(stage, 42, 3, input).subscribe(row => expect(row.id).toBe(73));
      if (stage === 'construction') http.expectOne(env.api_constructive_process).flush([{ id: 8, name_constructive_process: processName }]);
      const req = http.expectOne(url);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ project_id: 42, section_id: 3, source_information_id: 11, quantity: 0, ...(stage === 'construction' ? { energy_unit_id: null, volume_unit_id: null, bulk_unit_id: null, constructive_process_id: 8 } : { unit_id: null }) });
      req.flush(raw);
      service.list(stage, 42).subscribe(snapshot => {
        expect(snapshot.rows.map(r => r.id)).toEqual([73, 74]);
        expect(snapshot.rows[0].quantity).toBe('12.3456789');
        expect(snapshot.rawTotal).toBeCloseTo(stage === 'construction' ? 17.3456789 : 12.3456789);
      });
      http.expectOne(url).flush([{ ...raw, quantity: '12.3456789' }, { ...raw, id: 74 }, { ...raw, id: 90, project_id: 99 }, ...(stage === 'construction' ? [{ ...raw, id: 91, constructive_process_id: 9, quantity: 5 }] : [])]);
    });
    it(`${stage}: patches persisted ID only, deletes one ID, never retries failed mutations`, () => {
      const row = { key: `${stage}:73`, id: 73, sectionId: 3, sourceId: 11, quantity: 0, unitId: null };
      service.update(stage, row, input).subscribe(result => expect(result.id).toBe(73));
      const patch = http.expectOne(`${url}73/`);
      expect(patch.request.method).toBe('PATCH');
      patch.flush(raw);
      service.remove(stage, 73).subscribe({ error: () => undefined });
      const deletion = http.expectOne(`${url}73/`);
      expect(deletion.request.method).toBe('DELETE');
      deletion.flush({}, { status: 500, statusText: 'failure' });
      http.expectNone(url);
      http.expectNone(`${url}73/`);
    });
  }
  it('preserves a legacy end-life Unit reference on a source-only edit', () => {
    const row = { key: 'end-life:73', id: 73, sectionId: 3, sourceId: 11, quantity: 4, unitId: 2 };
    service.update('end-life', row, { sourceId: 12, quantity: 4, unitId: 2 }).subscribe(result => expect(result.unitId).toBe(2));
    const request = http.expectOne(`${env.api_electricity_consumption_deconstructive_process}73/`);
    expect(request.request.body).toEqual({ source_information_id: 12, quantity: 4, unit_id: 2 });
    request.flush({ ...raw, source_information_id: 12, quantity: 4, unit_id: 2 });
  });
  for (const quantity of [-1, NaN, Infinity]) {
    it(`rejects invalid quantity ${quantity} before mutation`, () => {
      let failed = false;
      service.create('construction', 42, 3, { ...input, quantity }).subscribe({ error: () => failed = true });
      expect(failed).toBe(true);
      http.expectNone(env.api_construction_stage);
      http.expectNone(env.api_constructive_process);
    });
  }
  it('blocks construction creation when the exact energy process is missing', () => {
    let failed = false;
    service.create('construction', 42, 3, input).subscribe({ error: () => failed = true });
    http.expectOne(env.api_constructive_process).flush([{ id: 1, name_constructive_process: 'Other' }]);
    expect(failed).toBe(true);
    http.expectNone(env.api_construction_stage);
  });
  it('rejects fractional end-life quantities without rounding or sending a request', () => {
    let failed = false;
    service.create('end-life', 42, 3, { ...input, quantity: 1.2 }).subscribe({ error: () => failed = true });
    expect(failed).toBe(true);
    http.expectNone(env.api_electricity_consumption_deconstructive_process);
  });
  it('preserves a decimal string through a source-only PATCH', () => {
    const quantity = '1234567890.1234567890', row = {key: 'construction:73', id: 73, sectionId: 3, sourceId: 11, quantity, unitId: null};
    service.update('construction', row, {sourceId: 12, quantity, unitId: null}).subscribe(result => expect(result.quantity).toBe(quantity));
    const request = http.expectOne(`${env.api_construction_stage}73/`);
    expect(request.request.body.quantity).toBe(quantity);
    request.flush({...raw, quantity, energy_unit_id: null});
  });

});
