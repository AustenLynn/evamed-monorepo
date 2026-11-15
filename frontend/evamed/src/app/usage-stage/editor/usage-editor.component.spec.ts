import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { UsageStageModule } from '../usage-stage.module';
import { UsageEditorComponent } from './usage-editor.component';
import { UsageService } from './usage.service';
import { UsagePickerService } from './usage-picker.service';
import { EnergyTotalService } from '../../core/services/energy-total/energy-total.service';
import { UsageState } from './usage.models';

export const usageFixture = (): UsageState => ({
  project_id: 5, project_name: 'Casa', revision: 'old', annual: {id: 11, quantity: 10000, unit_id: 20},
  annuals: [{id: 11, quantity: 10000, unit_id: 20}], canonical_unit_id: 20,
  units: [{id: 20, name_unit: 'kWh'}, {id: 1, name_unit: 'Pz'}], issues: [],
  catalogue: [{id: 2, name: 'Energía eléctrica, Medio voltaje (MX)-ECOINVENT3', display_name: 'Energía eléctrica, Medio voltaje', family: 'electric', database: 'ECOINVENT 3', region: 'México'}],
  sources: [
    {id: 21, annual_consumption_required_id: 11, percentage: 60, quantity: '6000.0000000000', unit_id: 20, type: 2, source: 'electric', issues: []},
    {id: 22, annual_consumption_required_id: 11, percentage: 20, quantity: '2000.0000000000', unit_id: 20, type: 2, source: 'electric', issues: []},
  ]
});

describe('Shared Usage editor', () => {
  const render = (load = of(usageFixture()), save = of({...usageFixture(), revision: 'new'})) => {
    const totals = {setUsageTotal: vi.fn()}, service = {load: vi.fn<UsageService['load']>(() => load), save: vi.fn<UsageService['save']>(() => save)};
    TestBed.configureTestingModule({imports: [UsageStageModule], providers: [
      {provide: UsageService, useValue: service},
      {provide: EnergyTotalService, useValue: totals},
      {provide: UsagePickerService, useValue: {choose: vi.fn(), add: vi.fn()}},
    ]});
    const fixture = TestBed.createComponent(UsageEditorComponent);
    fixture.componentRef.setInput('projectId', 5); fixture.detectChanges();
    return {fixture, editor: fixture.componentInstance, service, totals};
  };
  it('hydrates asynchronously without collapsing repeated families or writing on view', () => {
    const loaded = new Subject<UsageState>(), {fixture, editor, service} = render(loaded);
    expect(editor.loading).toBe(true);
    loaded.next(usageFixture()); fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('[data-source-row]').length).toBe(2);
    expect(editor.assigned).toBe(80);
    expect(service.save).not.toHaveBeenCalled();
  });
  it('keeps shares fixed and updates the energy bar only after confirmed annual persistence', async () => {
    const saved = new Subject<UsageState>(), {editor, service, totals} = render(of(usageFixture()), saved);
    totals.setUsageTotal.mockClear(); editor.editAnnual(); editor.annualDraft = '12000';
    const pending = editor.saveAnnual();
    expect(editor.pending).toBe(true); expect(editor.canLeave()).toBe(false);
    expect(totals.setUsageTotal).not.toHaveBeenCalled();
    expect(service.save.mock.calls[0][1].annual.quantity).toBe(12000);
    expect(service.save.mock.calls[0][1].edits).toBeUndefined();
    const state = usageFixture(); state.revision = 'new'; state.annual.quantity = 12000;
    state.sources[0].quantity = '7200.0000000000'; state.sources[1].quantity = '2400.0000000000';
    saved.next(state); saved.complete(); await pending;
    expect(editor.state.sources.map(row => row.percentage)).toEqual([60, 20]);
    expect(editor.state.sources.map(row => row.quantity)).toEqual(['7200.0000000000', '2400.0000000000']);
    expect(totals.setUsageTotal).toHaveBeenCalledWith(12000);
  });
  it('shows an exact read-only quantity preview and restores focus on cancel', async () => {
    const state = usageFixture(); state.annual.quantity = 1;
    const {editor, fixture, service} = render(of(state));
    fixture.nativeElement.querySelector('.usage-card-summary').click(); fixture.detectChanges(); await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('input[name=percentage]');
    input.value = '33'; input.dispatchEvent(new Event('input')); await fixture.whenStable(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-draft-quantity]')?.textContent).toContain('0.33');
    editor.cancelDraft(); fixture.detectChanges(); await new Promise(resolve => setTimeout(resolve, 0));
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('[data-source-row="21"] .usage-card-summary'));
    expect(service.save).not.toHaveBeenCalled();
  });
  it('retains a rejected row draft and cancelled navigation, and cancel never writes', async () => {
    const {editor, service} = render(of(usageFixture()), throwError(() => ({status: 400, error: ['Invalid']})));
    editor.editRow(editor.state.sources[0]); editor.rowDraft.percentage = '90';
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    expect(editor.canLeave()).toBe(false); expect(editor.rowDraft.percentage).toBe('90');
    await editor.saveRow();
    expect(editor.rowDraft.percentage).toBe('90'); expect(editor.error).toBeTruthy();
    const writes = service.save.mock.calls.length;
    editor.cancelDraft(); expect(editor.rowDraft).toBeNull();
    expect(service.save).toHaveBeenCalledTimes(writes);
    vi.restoreAllMocks();
  });
  it('requires reload/review after a conflict while preserving intent', async () => {
    const {editor, service} = render(of(usageFixture()), throwError(() => ({status: 409})));
    editor.editRow(editor.state.sources[0]); editor.rowDraft.percentage = '30';
    await editor.saveRow(); expect(editor.reviewRequired).toBe(true);
    await editor.saveRow(); expect(service.save).toHaveBeenCalledTimes(1);
    await editor.review(); expect(editor.rowDraft.percentage).toBe('30');
    expect(editor.reviewRequired).toBe(false);
  });
  it('coordinates a confirmed negative annual repair without replacing source identities', async () => {
    const state = usageFixture(); state.annual.quantity = -100; state.issues = ['annual_quantity'];
    state.sources.forEach(row => {row.quantity = '-60.0000000000'; row.issues = ['quantity'];});
    const {editor, service} = render(of(state));
    expect(editor.annualBlocked).toBe(false); editor.editAnnual(); editor.annualDraft = '100';
    await editor.saveAnnual(); expect(service.save).not.toHaveBeenCalled();
    (editor as any).annualRepairQuantities = true; await editor.saveAnnual();
    expect(service.save.mock.calls[0][1]).toMatchObject({annual: {quantity: 100}, edits: [{id: 21, percentage: 60}, {id: 22, percentage: 20}]});
  });
  it('blocks annual edits on legacy source issues and sends explicit unit repair only on request', async () => {
    const state = usageFixture(); state.sources[0].unit_id = 1; state.sources[0].issues = ['unit'];
    const {editor, service} = render(of(state));
    expect(editor.annualBlocked).toBe(true);
    editor.editRow(editor.state.sources[0]);
    expect(editor.rowDraft.repair_unit).toBe(false);
    editor.rowDraft.repair_unit = true; await editor.saveRow();
    expect(service.save.mock.calls[0][1].edits[0]).toMatchObject({id: 21, repair_unit: true});
  });
  it('keeps a deleted-row conflict draft visible until explicitly cancelled', async () => {
    const {editor, service, fixture} = render(of(usageFixture()), throwError(() => ({status: 409})));
    editor.editRow(editor.state.sources[0]); editor.rowDraft.percentage = '30'; await editor.saveRow();
    service.load.mockReturnValue(of({...usageFixture(), sources: []}));
    await editor.review(); fixture.changeDetectorRef.markForCheck(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-orphan-draft]')?.textContent).toContain('30');
  });
  it('reconciles an uncertain committed save without replaying additions', async () => {
    const {editor, service} = render(of(usageFixture()), throwError(() => ({status: 0})));
    editor.editAnnual(); editor.annualDraft = '12000'; await editor.saveAnnual();
    const operation = service.save.mock.calls[0][1].operation_id;
    service.load.mockReturnValue(of({...usageFixture(), operation_applied: true, revision: 'new'}));
    await editor.review();
    expect(service.load).toHaveBeenLastCalledWith(5, operation);
    expect(editor.annualDraft).toBeNull(); expect(service.save).toHaveBeenCalledTimes(1);
  });
});

describe('Usage failed batch intent', () => {
  it('restores failed additions after closing and reopening the catalogue', async () => {
    const api = {load: () => of(usageFixture()), save: () => throwError(() => ({status: 0}))},
      source = {...usageFixture().catalogue[0], id: 9},
      picker = {add: vi.fn<UsagePickerService['add']>(async (_catalogue, _excluded, save) => {await save([source]);}), choose: vi.fn()};
    TestBed.configureTestingModule({imports: [UsageStageModule], providers: [
      {provide: UsageService, useValue: api}, {provide: EnergyTotalService, useValue: {setUsageTotal: vi.fn()}},
      {provide: UsagePickerService, useValue: picker}
    ]});
    const fixture = TestBed.createComponent(UsageEditorComponent);
    fixture.componentRef.setInput('projectId', 5); fixture.detectChanges();
    const editor = fixture.componentInstance;
    await editor.addSources(); await editor.review(); await editor.addSources();
    expect(picker.add.mock.calls[1][3]).toEqual([9]);
  });
});


describe('Usage uncertain selection snapshot', () => {
  it('does not replace the submitted selection while its outcome is unresolved', async () => {
    const source = {...usageFixture().catalogue[0], id: 9}, api = {
      load: () => of(usageFixture()), save: () => throwError(() => ({status: 0}))},
      picker = {add: async (_catalogue, _excluded, save) => {await save([source]); await save([{...source, id: 10}]);}};
    TestBed.configureTestingModule({imports: [UsageStageModule], providers: [
      {provide: UsageService, useValue: api}, {provide: EnergyTotalService, useValue: {setUsageTotal: vi.fn()}},
      {provide: UsagePickerService, useValue: picker}
    ]});
    const fixture = TestBed.createComponent(UsageEditorComponent); fixture.componentRef.setInput('projectId', 5); fixture.detectChanges();
    await fixture.componentInstance.addSources();
    expect(fixture.componentInstance.additionDraft.map(item => item.id)).toEqual([9]);
  });
});
