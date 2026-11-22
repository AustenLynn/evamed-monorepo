import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { AnalisisService } from '../analisis/analisis.service';
import { EnergyTotalService } from './energy-total.service';
import { ProjectSavesService } from './project-saves.service';

// The stage pages' bar shows the project's carbon (GWP-total) per stage, from the same
// server calculation as Resultados (2026-11-21).
const GWP = 'Calentamiento global, total',
  results = (projectId: number, stages: Record<string, Record<string, number>>) => ({
    project_id: projectId,
    carbono: { name: GWP, unit: 'kg CO2 eq' },
    datos: {
      [GWP]: stages,
      'Agotamiento de ozono': { Producción: { 'A1-A3': 999 } },
    },
  }),
  full = results(42, {
    Producción: { 'A1-A3': 5000, A1: 0, A2: 0, A3: 0 },
    Construccion: { A4: 20, A5: 30 },
    Uso: { B4: 100, B6: 0 },
    FinDeVida: { C1: 5, C2: 0, C3: 95, C4: 0 },
  });

describe('Carbon totals for the stage bar', () => {
  let getProjectResults: ReturnType<typeof vi.fn>;
  const service = () => {
    TestBed.configureTestingModule({ providers: [{ provide: AnalisisService, useValue: { getProjectResults } }] });
    return TestBed.inject(EnergyTotalService);
  },
    latest = (s: EnergyTotalService) => {
    let value: any;
    s.breakdown$.subscribe(v => (value = v)).unsubscribe();
    return value;
  };

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('sums GWP-total per stage, Producción included, from the project results', () => {
    getProjectResults = vi.fn(() => of(full));
    const s = service();
    s.loadAll(42);
    vi.advanceTimersByTime(500);

    expect(getProjectResults).toHaveBeenCalledWith(42);
    expect(latest(s)).toEqual({
      production: 5000, construction: 50, usage: 100, endLife: 100, total: 5250, unit: 'kg CO2 eq',
    });
  });

  it('uses the explicit project even when storage names a previous one', () => {
    localStorage.setItem('idProyectoConstrucción', '3');
    getProjectResults = vi.fn(() => of(full));
    const s = service();
    s.loadAll(42);
    vi.advanceTimersByTime(500);
    expect(getProjectResults).toHaveBeenCalledWith(42);
  });

  it('ignores an old project response when a different project is loaded', () => {
    const old = new Subject<any>();
    getProjectResults = vi.fn((id: number) => (id === 42 ? old : of(results(43, { Producción: { 'A1-A3': 7 } }))));
    const s = service();
    s.loadAll(42);
    vi.advanceTimersByTime(500);
    s.loadAll(43);
    vi.advanceTimersByTime(500);
    old.next(full);

    expect(latest(s).total).toBe(7);
  });

  it('a confirmed save reloads the totals once, however many requests it took', () => {
    getProjectResults = vi.fn(() => of(full));
    const s = service(),
      saves = TestBed.inject(ProjectSavesService);
    s.loadAll(42);
    vi.advanceTimersByTime(500);
    saves.notify();
    saves.notify();
    s.refresh();
    vi.advanceTimersByTime(500);

    expect(getProjectResults).toHaveBeenCalledTimes(2);
  });

  it('shows zero, not a stale project, while nothing is loaded or the request fails', () => {
    getProjectResults = vi.fn(() => new Subject<any>());
    const s = service();
    expect(latest(s).total).toBe(0);
    s.loadAll(42);
    vi.advanceTimersByTime(500);
    expect(latest(s).total).toBe(0);
  });
});
