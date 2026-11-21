import { carbonType, keepIndicators, loadVista, saveVista } from './vista-carbono';

describe('vista carbono helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('prefers GWP-total, falls back to PCG 100', () => {
    expect(carbonType([
      { id: 1, name_potential_type: 'PCG 100' },
      { id: 2, name_potential_type: 'GWP-total' },
    ]).id).toBe(2);
    expect(carbonType([{ id: 1, name_potential_type: 'PCG 100' }]).id).toBe(1);
    expect(carbonType([{ id: 3, name_potential_type: 'ODP' }])).toBeUndefined();
  });

  it('keeps only the named indicators', () => {
    expect(keepIndicators({ a: 1, b: 2 }, new Set(['b']))).toEqual({ b: 2 });
    const all = { a: 1 };
    expect(keepIndicators(all, null)).toBe(all);
  });

  it('defaults to completo and survives storage errors and junk', () => {
    expect(loadVista()).toBe('completo');
    saveVista('carbono');
    expect(loadVista()).toBe('carbono');
    localStorage.setItem('evamed.resultados.vista', 'x');
    expect(loadVista()).toBe('completo');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(loadVista()).toBe('completo');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => saveVista('carbono')).not.toThrow();
  });
});
