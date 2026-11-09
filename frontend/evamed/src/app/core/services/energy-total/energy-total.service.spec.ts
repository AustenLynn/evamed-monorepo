import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { ConstructionStageService } from '../construction-stage/construction-stage.service';
import { ElectricitConsumptionService } from '../electricity-consumption/electricit-consumption.service';
import { EndLifeService } from '../end-life/end-life.service';
import { EnergyTotalService } from './energy-total.service';

describe('Energy totals project context', () => {
  afterEach(() => localStorage.clear());
  it('loads every stage for the explicit project even when storage names a previous project', () => {
    localStorage.setItem('idProyectoConstrucción', '3');
    TestBed.configureTestingModule({providers: [
      {provide: ConstructionStageService, useValue: {getConstructiveSystemElement: () => of([{project_id: 42, quantity: 2}, {project_id: 3, quantity: 50}])}},
      {provide: ElectricitConsumptionService, useValue: {getACR: () => of([{project_id: 42, quantity: 3}])}},
      {provide: EndLifeService, useValue: {getECDP: () => of([{project_id: 42, quantity: 4}])}}
    ]});
    const service = TestBed.inject(EnergyTotalService);
    (service.loadAll as (projectId?: number) => void)(42);
    let result: unknown;
    service.breakdown$.subscribe(value => result = value);
    expect(result).toEqual({construction: 2, usage: 3, endLife: 4, total: 9});
  });
  it('does not let a delayed stage snapshot overwrite a newer committed total', () => {
    const pending = new Subject<any[]>();
    TestBed.configureTestingModule({providers: [
      {provide: ConstructionStageService, useValue: {getConstructiveSystemElement: () => pending}},
      {provide: ElectricitConsumptionService, useValue: {getACR: () => of([{project_id: 42, quantity: 3}])}},
      {provide: EndLifeService, useValue: {getECDP: () => of([{project_id: 42, quantity: 4}])}}
    ]});
    const service = TestBed.inject(EnergyTotalService);
    service.loadAll(42); service.setConstructionTotal(9);
    pending.next([{project_id: 42, quantity: 2}]); pending.complete();
    let result: unknown; service.breakdown$.subscribe(value => result = value);
    expect(result).toEqual({construction: 9, usage: 3, endLife: 4, total: 16});
  });
  it('ignores an old project response when a different project is loaded', () => {
    const pending = new Subject<any[]>(), current = new Subject<any[]>(); let calls = 0;
    TestBed.configureTestingModule({providers: [
      {provide: ConstructionStageService, useValue: {getConstructiveSystemElement: () => ++calls === 1 ? pending : current}},
      {provide: ElectricitConsumptionService, useValue: {getACR: () => of([])}},
      {provide: EndLifeService, useValue: {getECDP: () => of([])}}
    ]});
    const service = TestBed.inject(EnergyTotalService);
    service.loadAll(42); service.loadAll(43);
    current.next([{project_id: 43, quantity: 5}]); current.complete();
    pending.next([{project_id: 42, quantity: 90}]); pending.complete();
    let result: unknown; service.breakdown$.subscribe(value => result = value);
    expect(result).toEqual({construction: 5, usage: 0, endLife: 0, total: 5});
  });

});
