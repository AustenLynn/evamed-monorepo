import { TestBed } from '@angular/core/testing';
import { UsageStageUiModule } from '../../usage-stage-ui.module';
import { UsageSourcePanelComponent } from './usage-source-panel.component';
import { usageFixture } from '../../testing/usage-fixtures';
import { SourceDraft, UsageOption } from '../../usage.models';

const options: UsageOption[] = [
  {key: 'type:2', selectionId: 2, type: 2, source: 'electric', name: 'Energía eléctrica, Medio voltaje', rawName: 'Electricidad', database: 'ECOINVENT 3', region: 'México', supported: true},
  {key: 'type:11', selectionId: 11, type: 11, source: 'fuel', name: 'Calefacción doméstica con gas natural', rawName: 'Gas', database: null, region: 'Global', supported: true},
  {key: 'panels', selectionId: -1, type: null, source: 'panels', name: 'Paneles fotovoltaicos', rawName: 'Paneles fotovoltaicos', database: null, region: null, supported: true},
];
describe('Usage source presentation', () => {
  const render = (expanded: number | null = 21) => {
    TestBed.configureTestingModule({imports: [UsageStageUiModule]});
    const fixture = TestBed.createComponent(UsageSourcePanelComponent), rows = usageFixture().sources,
      drafts = new Map<number, SourceDraft>(rows.map(row => [row.id, {percentage: String(row.percentage), type: row.type, source: row.source, repairUnit: false}]));
    fixture.componentRef.setInput('rows', rows); fixture.componentRef.setInput('options', options);
    fixture.componentRef.setInput('units', usageFixture().units); fixture.componentRef.setInput('drafts', drafts);
    fixture.componentRef.setInput('expanded', expanded); fixture.detectChanges();
    return {fixture, component: fixture.componentInstance, drafts};
  };
  it('emits the exact row save and cancel without changing other supplied drafts', () => {
    const {fixture, component, drafts} = render(), saves: number[] = [], cancels: number[] = [];
    component.saveSource.subscribe(id => saves.push(id)); component.cancelSource.subscribe(id => cancels.push(id));
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));
    fixture.nativeElement.querySelector('.usage-cancel').click();
    expect(saves).toEqual([21]); expect(cancels).toEqual([21]); expect(drafts.get(22).percentage).toBe('20');
  });
  it('keeps the card hierarchy and exposes one Add Source action without a photovoltaic shortcut', () => {
    const {fixture} = render(null), buttons = [...fixture.nativeElement.querySelectorAll('.usage-panel-header button')] as HTMLButtonElement[];
    expect(buttons).toHaveLength(1); expect(buttons[0].textContent).toContain('Agregar fuente');
    expect(fixture.nativeElement.querySelectorAll('[data-row]')).toHaveLength(2);
    expect(fixture.nativeElement.querySelector('.usage-quantity').textContent).toContain('6000');
  });
  it('keeps list metadata only on the expanded row and emits exact row actions', () => {
    const {fixture, component, drafts} = render(null), edits: number[] = [], removals: number[] = [];
    fixture.nativeElement.querySelector('.usage-view mat-button-toggle:last-child button').click(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('app-source-chip, app-region-chip')).toHaveLength(0);
    expect(fixture.nativeElement.querySelector('[data-row="21"] .usage-list-share')?.textContent).toContain('60 %');
    expect(fixture.nativeElement.querySelector('[data-row="21"] .usage-summary').getAttribute('aria-label')).toContain('6000 kWh');
    expect(fixture.nativeElement.querySelector('[data-row="21"] .usage-summary').getAttribute('aria-label')).toContain('60 %');
    component.editSource.subscribe(id => edits.push(id)); component.removeSource.subscribe(id => removals.push(id));
    fixture.nativeElement.querySelector('[data-row="21"] .usage-summary').click(); expect(edits).toEqual([21]);
    fixture.componentRef.setInput('expanded', 21); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-row="21"] app-source-chip')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-row="22"] app-region-chip')).toBeNull();
    fixture.nativeElement.querySelector('.usage-view mat-button-toggle:first-child button').click(); fixture.detectChanges(); fixture.nativeElement.querySelector('.usage-view mat-button-toggle:last-child button').click(); fixture.detectChanges();
    expect(drafts.get(21).percentage).toBe('60');
    fixture.nativeElement.querySelector('[data-row="22"] .usage-card-footer button').click(); expect(removals).toEqual([22]);
  });
  it('shows photovoltaic generation without fabricated metadata', () => {
    const {fixture} = render(null), row = {...usageFixture().sources[0], id: 23, source: 'panels', type: null};
    fixture.componentRef.setInput('rows', [row]); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Paneles fotovoltaicos');
    expect(fixture.nativeElement.querySelector('app-source-chip,app-region-chip')).toBeNull();
  });
  it('keeps one Add Source action in the empty state', () => {
    const {fixture} = render(null);
    fixture.componentRef.setInput('rows', []); fixture.detectChanges();
    const buttons = [...fixture.nativeElement.querySelectorAll('button')].filter((button: HTMLButtonElement) => button.textContent.includes('Agregar fuente'));
    expect(buttons).toHaveLength(1);
  });
  it('shows a failed delete message even when the row editor is closed', () => {
    const {fixture} = render(null);
    fixture.componentRef.setInput('errors', new Map([[21, 'No se pudo eliminar la fuente.']])); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-row="21"] [role=alert]')?.textContent).toContain('No se pudo eliminar');
  });
  it('emits only the changed field instead of mutating an input draft', async () => {
    const {fixture, component, drafts} = render(), changes: unknown[] = [];
    component.draftChange.subscribe(change => changes.push(change));
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('input[name=percentage]') as HTMLInputElement;
    input.value = '30'; input.dispatchEvent(new Event('input')); await fixture.whenStable();
    expect(changes).toEqual([{id: 21, patch: {percentage: '30'}}]); expect(drafts.get(21).percentage).toBe('60');
  });
});
