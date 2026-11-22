import '@angular/compiler';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {of, Subject, throwError} from 'rxjs';
import {usageFixture} from '../../testing/usage-fixtures';
import {UsageState} from '../../usage.models';
import {UsageEditorComponent} from './usage-editor.component';

const settle = async () => {await Promise.resolve(); await Promise.resolve(); await Promise.resolve();};
describe('Usage editor coordination', () => {
  let api: any, energy: any, router: any, materials: any, editor: UsageEditorComponent;
  beforeEach(() => {
    vi.stubGlobal('sessionStorage', {setItem: vi.fn()}); vi.stubGlobal('localStorage', {setItem: vi.fn()});
    vi.stubGlobal('confirm', vi.fn(() => true));
    api = {load: vi.fn(() => of(usageFixture())), save: vi.fn(() => of(usageFixture()))};
    energy = {loadAll: vi.fn(), refresh: vi.fn()}; router = {navigateByUrl: vi.fn()};
    materials = {getEDCP: vi.fn(() => of([])), getConstructionStage: vi.fn(() => of([])), getMaterialSchemeProyects: vi.fn(() => of([]))};
    editor = new UsageEditorComponent(api, energy, router, materials); editor.projectId = 5;
  });
  afterEach(() => vi.unstubAllGlobals());
  it('hydrates asynchronously, never marks untouched cards dirty, and reports only confirmed totals', async () => {
    const response = new Subject<UsageState>(); api.load.mockReturnValue(response); editor.ngOnInit();
    expect(editor.loading).toBe(true); expect(energy.refresh).not.toHaveBeenCalled(); response.next(usageFixture()); await settle();
    expect(editor.loading).toBe(false); expect(energy.refresh).toHaveBeenCalledTimes(1);
    editor.openSource(21); expect(editor.store.dirty).toBe(false);
    editor.patchAnnual({quantity: '12000'}); expect(energy.refresh).toHaveBeenCalledTimes(1);
  });
  it('names saved sources without current-method data and offers only current ones (audit A-13)', async () => {
    const state = usageFixture(); state.catalogue[0].offerable = false; state.catalogue[1].offerable = false;
    api.load.mockReturnValue(of(state)); editor.ngOnInit(); await settle();
    expect(editor.notOfferableNames).toEqual(['Energía eléctrica, Medio voltaje']);
    editor.replacementId = 21;
    expect(editor.pickerOptions.map(o => o.key)).toEqual(['type:2', 'panels']);
  });
  it('saves one card, locks duplicate submission and keeps annual and another card drafts', async () => {
    editor.ngOnInit(); await settle(); editor.patchAnnual({quantity: '12000'}); editor.patchSource({id: 21, patch: {percentage: '30'}}); editor.patchSource({id: 22, patch: {percentage: '40'}});
    const response = new Subject<UsageState>(); api.save.mockReturnValue(response); const saving = editor.saveSource(21);
    expect(editor.pending).toBe(true); expect(editor.canLeave()).toBe(false); await editor.saveSource(21); expect(api.save).toHaveBeenCalledTimes(1);
    const request = api.save.mock.calls[0][1]; expect(request.edits).toEqual([{id: 21, percentage: 30}]); expect(request.annual).toBeUndefined();
    editor.patchSource({id: 21, patch: {percentage: '99'}}); expect(editor.store.sourceDraft(21).percentage).toBe('30');
    const saved = usageFixture(); saved.sources[0].percentage = 30; response.next(saved); expect(await saving).toBe(true);
    expect(editor.store.annual.quantity).toBe('12000'); expect(editor.store.sourceDraft(22).percentage).toBe('40');
  });
  it('keeps failed intent, reloads a conflict and preserves orphan drafts for cancellation', async () => {
    editor.ngOnInit(); await settle(); editor.patchSource({id: 21, patch: {percentage: '30'}});
    api.save.mockReturnValue(throwError(() => ({status: 400, error: {detail: 'Porcentaje inválido'}}))); expect(await editor.saveSource(21)).toBe(false);
    expect(editor.sourceErrors.get(21)).toContain('Porcentaje'); expect(editor.store.sourceDraft(21).percentage).toBe('30');
    const state = usageFixture(); state.sources = state.sources.filter(row=>row.id !== 21); api.load.mockReturnValue(of(state)); api.save.mockReturnValue(throwError(() => ({status: 409})));
    await editor.saveSource(21); expect(editor.orphanDrafts.map(row=>row.id)).toEqual([21]); editor.cancelSource(21); expect(editor.orphanDrafts).toEqual([]);
  });
  it('reconciles a lost response without replay and clears only the confirmed target', async () => {
    editor.ngOnInit(); await settle(); editor.patchAnnual({quantity: '12000'}); editor.patchSource({id: 21, patch: {percentage: '30'}});
    api.save.mockReturnValue(throwError(() => ({status: 0}))); api.load.mockReturnValue(of({...usageFixture(), operation_applied: true}));
    expect(await editor.saveSource(21)).toBe(true); expect(api.save).toHaveBeenCalledTimes(1); expect(api.load.mock.calls[1][1]).toBeTruthy();
    expect(editor.store.drafts.has(21)).toBe(false); expect(editor.store.annual.quantity).toBe('12000'); expect(editor.store.unresolved).toBeNull();
  });
  it('retains a frozen unresolved addition until reload can confirm it', async () => {
    editor.ngOnInit(); await settle(); api.save.mockReturnValue(throwError(() => ({status: 502}))); api.load.mockReturnValue(throwError(() => ({status: 0})));
    editor.openPicker(); const panel = editor.store.options.find(o=>o.key === 'panels')!;
    expect(await editor.confirmPicker([panel])).toBe(false); expect(editor.store.unresolved?.request.additions?.[0]).toMatchObject({type: null, source: 'panels'});
    expect(editor.locked).toBe(true); expect(editor.recoveryEnabled).toBe(true); editor.closePicker(); expect(editor.pickerOpen).toBe(true);
    api.load.mockReturnValue(of({...usageFixture(), operation_applied: true})); expect(await editor.recover()).toBe(true); expect(editor.store.additionKeys).toEqual([]); expect(editor.pickerOpen).toBe(false);
  });
  it('does not discard on cancelled navigation and keeps projects available after load failure', async () => {
    editor.ngOnInit(); await settle(); editor.patchAnnual({quantity: '12000'}); vi.mocked(confirm).mockReturnValue(false);
    expect(editor.canLeave()).toBe(false); await editor.navigate('resultados'); expect(router.navigateByUrl).not.toHaveBeenCalled();
    editor = new UsageEditorComponent(api, energy, router, materials); editor.projectId = 5; api.load.mockReturnValue(throwError(() => ({status: 404}))); editor.ngOnInit(); await settle();
    await editor.navigate('projects'); expect(router.navigateByUrl).toHaveBeenCalledWith('/home-evamed');
  });
  it('does not pick an arbitrary annual total and repairs replacement as a draft only', async () => {
    const state = usageFixture(); state.annual = null; state.annuals.push({id: 12, quantity: 5, unit_id: 22}); api.load.mockReturnValue(of(state)); editor.ngOnInit(); await settle();
    expect(energy.refresh).toHaveBeenCalled();
    editor.openPicker(21); await editor.confirmPicker([editor.store.options.find(o=>o.type === 9)!]);
    expect(editor.store.sourceDraft(21)).toMatchObject({percentage: '60', type: 9, source: 'electric'}); expect(api.save).not.toHaveBeenCalled();
  });
  it('keeps an uncertain operation editable after a confirmed absent receipt without replay', async () => {
    editor.ngOnInit(); await settle(); editor.patchAnnual({quantity: '12000'});
    api.save.mockReturnValue(throwError(() => ({status: 0}))); api.load.mockReturnValue(of({...usageFixture(), operation_applied: false, revision: 'reloaded'}));
    expect(await editor.saveAnnual()).toBe(false); expect(editor.store.unresolved).toBeNull(); expect(editor.pending).toBe(false);
    expect(editor.store.annual.quantity).toBe('12000'); expect(editor.store.saved?.revision).toBe('reloaded'); expect(api.save).toHaveBeenCalledTimes(1);
  });
  it('deletes only the confirmed row and preserves its draft on failure or cancellation', async () => {
    editor.ngOnInit(); await settle(); editor.patchSource({id: 21, patch: {percentage: '30'}}); editor.patchSource({id: 22, patch: {percentage: '40'}});
    vi.mocked(confirm).mockReturnValue(false); expect(await editor.removeSource(21)).toBe(false); expect(api.save).not.toHaveBeenCalled();
    vi.mocked(confirm).mockReturnValue(true); api.save.mockReturnValue(throwError(() => ({status: 400}))); expect(await editor.removeSource(21)).toBe(false);
    expect(editor.store.sourceDraft(21).percentage).toBe('30'); expect(editor.store.saved?.sources.length).toBe(2);
    const saved = usageFixture(); saved.sources = saved.sources.filter(row => row.id !== 21); api.save.mockReturnValue(of(saved));
    expect(await editor.removeSource(21)).toBe(true); expect(api.save.mock.calls[1][1].removals).toEqual([21]);
    expect(editor.store.drafts.has(21)).toBe(false); expect(editor.store.sourceDraft(22).percentage).toBe('40');
  });
  it('annual save sends only annual intent and card edits stay independent', async () => {
    editor.ngOnInit(); await settle(); editor.patchAnnual({quantity: '12000'}); editor.patchSource({id: 21, patch: {percentage: '30'}});
    const saved = usageFixture(); saved.annual!.quantity = 12000; saved.annuals[0].quantity = 12000; api.save.mockReturnValue(of(saved));
    expect(await editor.saveAnnual()).toBe(true); expect(api.save.mock.calls[0][1].annual).toEqual({quantity: 12000}); expect(api.save.mock.calls[0][1].edits).toBeUndefined();
    expect(editor.store.sourceDraft(21).percentage).toBe('30'); expect(editor.quantityPreviews.get(21)).toBe('3600');
  });

});
