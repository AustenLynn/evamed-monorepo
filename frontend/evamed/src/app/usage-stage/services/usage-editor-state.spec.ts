import {describe, expect, it} from 'vitest';
import {usageFixture} from '../testing/usage-fixtures';
import {UsageEditorState, calculatedQuantity, optionKey, wholeNumber, usageOptions} from './usage-editor-state';

describe('usage independent draft state', () => {
  it('parses strict whole values and computes decimal quantities exactly', () => {
    expect(wholeNumber('', 100)).toBeNull(); expect(wholeNumber('1.0', 100)).toBeNull();
    expect(wholeNumber('0', 100)).toBe(0); expect(wholeNumber('-1', 100)).toBeNull();
    expect(calculatedQuantity(Number.MAX_SAFE_INTEGER, '33')).toBe('2972375754064527.03');
    expect(calculatedQuantity(1, '33')).toBe('0.33'); expect(calculatedQuantity(10000, '60')).toBe('6000');
  });
  it('keeps independent annual and card intent through saves and cancellation', () => {
    const editor = new UsageEditorState(); editor.load(usageFixture()); editor.openSource(21);
    expect(editor.dirty).toBe(false);
    editor.patchAnnual({quantity: '12000'}); editor.patchSource(21, {percentage: '30'}); editor.patchSource(22, {percentage: '40'});
    expect(editor.sourceIntent(21)).toEqual({edits: [{id: 21, percentage: 30}]});
    expect(editor.annualIntent()).toEqual({annual: {quantity: 12000}});
    const state = usageFixture(); state.sources[0].percentage = 30;
    editor.accept(state, {kind: 'source', id: 21});
    expect(editor.annual.quantity).toBe('12000'); expect(editor.sourceDraft(22).percentage).toBe('40');
    editor.cancelSource(22); expect(editor.annualDirty).toBe(true); editor.cancelAnnual(); expect(editor.dirty).toBe(false);
  });
  it('retains orphan drafts and freezes uncertain operations with target-only reconciliation', () => {
    const editor = new UsageEditorState(); editor.load(usageFixture()); editor.patchSource(21, {percentage: '30'});
    editor.patchAnnual({quantity: '12000'}); editor.additionKeys = ['a', 'b'];
    const operation = {request: {revision: 'saved-1', operation_id: 'uuid', edits: [{id: 21, percentage: 30}]}, target: {kind: 'source' as const, id: 21}};
    editor.markUnresolved(operation); operation.request.edits[0].percentage = 99;
    expect(editor.unresolved!.request.edits![0].percentage).toBe(30);
    const missing = usageFixture(); missing.sources = []; editor.refresh(missing); expect(editor.drafts.has(21)).toBe(true);
    expect(editor.reconcile({...usageFixture(), operation_applied: false})).toBe(false); expect(editor.drafts.has(21)).toBe(true);
    editor.markUnresolved(operation); expect(editor.reconcile({...usageFixture(), operation_applied: true})).toBe(true);
    expect(editor.drafts.has(21)).toBe(false); expect(editor.annual.quantity).toBe('12000');
    editor.accept(usageFixture(), {kind: 'add', keys: ['a']}); expect(editor.additionKeys).toEqual(['b']);
  });
  it('provides safe catalogue keys, unknown options and nonnegative allocation', () => {
    const state = usageFixture(); state.catalogue[0].family = null; state.sources[0].percentage = -60;
    const editor = new UsageEditorState(); editor.load(state); expect(editor.assigned).toBe(20);
    expect(usageOptions(state).find(o=>o.key === 'type:2')!.supported).toBe(false);
    expect(usageOptions(state).find(o=>o.key === 'panels')).toMatchObject({type: null, selectionId: -1, database: null, region: null});
    expect(optionKey({type: null, source: 'unknown'})).toBe('legacy:unknown');
  });
  it('tells same-named sources apart by their database (audit A-14)', () => {
    const state = usageFixture();
    state.catalogue.push({id: 12, name: 'Energía eléctrica, Medio voltaje (MX)-MEXICANIUH', display_name: 'Energía eléctrica, Medio voltaje', family: 'electric', database: 'MEXICANIUH', region: 'México'});
    const names = usageOptions(state).map(o => o.name);
    expect(names).toContain('Energía eléctrica, Medio voltaje (ECOINVENT 3)');
    expect(names).toContain('Energía eléctrica, Medio voltaje (MEXICANIUH)');
    expect(names).toContain('Energía eléctrica, Alto voltaje');
  });
  it('keeps a saved source without current-method data valid but marks it not offerable (audit A-13)', () => {
    const state = usageFixture(); state.catalogue[0].offerable = false;
    const option = usageOptions(state).find(o => o.key === 'type:2')!;
    expect(option).toMatchObject({supported: true, offerable: false});
    expect(usageOptions(state).find(o => o.key === 'type:9')!.offerable).toBe(true);
    const editor = new UsageEditorState(); editor.load(state);
    expect(editor.annualBlockedReason).toBeNull();
    expect(editor.notOfferable.map(row => row.id)).toEqual([21]);
  });
  it('requires explicit coordinated negative annual repair and blocks malformed legacy shares', () => {
    const state = usageFixture(); state.annual!.quantity = -10; state.annuals[0].quantity = -10; state.sources.forEach(r=>r.issues = ['quantity']);
    const editor = new UsageEditorState(); editor.load(state); editor.patchAnnual({quantity: '100'});
    expect(()=>editor.annualIntent()).toThrow(); editor.patchAnnual({confirmRecalculate: true});
    expect(editor.annualIntent()).toEqual({annual: {quantity: 100}, edits: [{id: 21, percentage: 60}, {id: 22, percentage: 20}]});
    state.sources[0].percentage = null; editor.refresh(state); expect(()=>editor.annualIntent()).toThrow();
  });
  it('requires explicit unit consent and uses saved shares for over-allocation', () => {
    const state = usageFixture(); state.annual!.unit_id = 1;
    const editor = new UsageEditorState(); editor.load(state); editor.patchAnnual({quantity: '12000'});
    expect(()=>editor.annualIntent()).toThrow(); editor.patchAnnual({repairUnit: true}); expect(editor.annualIntent().annual!.repair_unit).toBe(true);
    editor.patchSource(21, {percentage: '90'}); expect(()=>editor.sourceIntent(21)).toThrow();
  });
  it('allows only decreasing repairs of saved over-allocation and blocks additions until repaired', () => {
    const state = usageFixture(); state.sources.forEach(row => {row.percentage = 120; row.issues = ['percentage', 'quantity'];});
    const editor = new UsageEditorState(); editor.load(state);
    expect(editor.canAdd).toBe(false);
    editor.patchSource(21, {percentage: '0'});
    expect(editor.sourceIntent(21)).toEqual({edits: [{id: 21, percentage: 0}]});
    state.sources[0].percentage = 0; state.sources[0].issues = []; editor.accept(state, {kind: 'source', id: 21});
    editor.patchSource(22, {percentage: '100'});
    expect(editor.sourceIntent(22)).toEqual({edits: [{id: 22, percentage: 100}]});
    const many = usageFixture(); many.sources = [21, 22, 23, 24].map(id => ({...many.sources[0], id, percentage: 60}));
    editor.load(many); editor.patchSource(21, {percentage: '60'}); expect(() => editor.sourceIntent(21)).toThrow();
    editor.patchSource(21, {percentage: '61'}); expect(() => editor.sourceIntent(21)).toThrow();
    editor.patchSource(21, {percentage: '0'}); expect(editor.sourceIntent(21).edits?.[0].percentage).toBe(0);
  });
  it('accepts annual alone and refreshes saved previews without discarding cards', () => {
    const editor = new UsageEditorState(); editor.load(usageFixture());
    editor.patchAnnual({quantity: '12000'}); editor.patchSource(21, {percentage: '30'}); editor.patchSource(22, {percentage: '40'});
    editor.cancelAnnual(); expect(editor.sourceDraft(21).percentage).toBe('30'); expect(editor.sourceDraft(22).percentage).toBe('40');
    editor.patchAnnual({quantity: '12000'}); const saved = usageFixture(); saved.annual!.quantity = 12000; saved.annuals[0].quantity = 12000;
    editor.accept(saved, {kind: 'annual'}); expect(editor.annualDirty).toBe(false);
    expect(calculatedQuantity(editor.saved!.annual!.quantity, editor.sourceDraft(21).percentage)).toBe('3600');
    editor.patchAnnual({quantity: '99000'}); expect(calculatedQuantity(editor.saved!.annual!.quantity, editor.sourceDraft(21).percentage)).toBe('3600');
    editor.cancelSource(21); expect(editor.sourceDraft(22).percentage).toBe('40'); expect(editor.annual.quantity).toBe('99000');
  });
  it('reconciles only submitted addition keys and retains intent on ordinary refresh', () => {
    const editor = new UsageEditorState(); editor.load(usageFixture()); editor.additionKeys = ['type:9', 'panels']; editor.patchAnnual({quantity: '12000'});
    editor.markUnresolved({request: {revision: 'saved-1', operation_id: 'add', additions: [{client_id: 'a', type: 9, source: 'electric'}]}, target: {kind: 'add', keys: ['type:9']}});
    editor.reconcile({...usageFixture(), operation_applied: true}); expect(editor.additionKeys).toEqual(['panels']); expect(editor.annual.quantity).toBe('12000');
    editor.patchSource(21, {percentage: '35'}); editor.refresh(usageFixture()); expect(editor.sourceDraft(21).percentage).toBe('35');
    const orphan = usageFixture(); orphan.sources = []; editor.refresh(orphan); expect(editor.dirty).toBe(true); expect(()=>editor.sourceIntent(21)).toThrow();
    editor.cancelSource(21); expect(editor.drafts.has(21)).toBe(false);
  });
  it('blocks missing canonical units, malformed shares, missing types and unconfirmed local unit repairs', () => {
    for(const canonical_unit_id of [null, 999]) {
      const editor = new UsageEditorState(); editor.load({...usageFixture(), canonical_unit_id}); editor.patchAnnual({quantity: '12'});
      expect(editor.canAdd).toBe(false); expect(editor.annualBlockedReason).toBeTruthy(); expect(()=>editor.annualIntent()).toThrow();
    }
    const state = usageFixture(); state.sources[0].percentage = null; state.sources[0].unit_id = 1;
    const editor = new UsageEditorState(); editor.load(state); expect(editor.sourceDraft(21).percentage).toBe('');
    expect(()=>editor.sourceIntent(21)).toThrow(); editor.patchSource(21, {percentage: '60'}); expect(()=>editor.sourceIntent(21)).toThrow();
    editor.patchSource(21, {repairUnit: true}); expect(editor.sourceIntent(21)).toEqual({edits: [{id: 21, percentage: 60, repair_unit: true}]});
    editor.patchSource(21, {percentage: '1.5'}); expect(()=>editor.sourceIntent(21)).toThrow();
    state.sources[0].type = 999; editor.refresh(state); expect(editor.options.find(o=>o.type === 999)!.supported).toBe(false);
  });
  it('blocks non-quantity legacy damage during coordinated annual repair', () => {
    for(const issue of ['unit', 'type', 'percentage', 'unknown']) {
      const state = usageFixture(); state.annual!.quantity = -1; state.annuals[0].quantity = -1; state.sources[0].issues = [issue];
      const editor = new UsageEditorState(); editor.load(state); editor.patchAnnual({quantity: '10', confirmRecalculate: true}); expect(()=>editor.annualIntent()).toThrow();
    }
  });

  it('emits explicit family repair even when the catalogue key is unchanged', () => {
    const state = usageFixture(); state.sources[0].source = 'fuel'; state.sources[0].issues = ['type'];
    const editor = new UsageEditorState(); editor.load(state); editor.patchSource(21, {source: 'electric'});
    expect(editor.sourceIntent(21)).toEqual({edits: [{id: 21, percentage: 60, type: 2, source: 'electric'}]});
  });

  it('repairs a negative annual with no source rows without an unavailable recalculation consent', () => {
    const state = usageFixture(); state.sources = []; state.annual!.quantity = -1; state.annuals[0].quantity = -1;
    const editor = new UsageEditorState(); editor.load(state); editor.patchAnnual({quantity: '100'});
    expect(editor.annualBlockedReason).toBeNull(); expect(editor.annualIntent().annual).toEqual({quantity: 100});
  });

});
