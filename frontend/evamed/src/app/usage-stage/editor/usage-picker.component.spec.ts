import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { UsageStageModule } from '../usage-stage.module';
import { UsagePickerComponent } from './usage-picker.component';
import { UsageType } from './usage.models';

const sources: UsageType[] = [
  {id: 2, name: 'Electricidad México', display_name: 'Electricidad México', family: 'electric', database: 'ECOINVENT 3', region: 'México'},
  {id: 9, name: 'Gas Global', display_name: 'Gas Global', family: 'fuel', database: null, region: 'Global'},
  {id: 99, name: 'Unknown', display_name: 'Unknown', family: null, database: null, region: null},
];
describe('Usage source catalogue', () => {
  const render = (mode: 'add' | 'replace' = 'add', excluded: number[] = [], save: (items: UsageType[]) => Promise<boolean> = async () => true, recovering = () => false) => {
    const ref = {close: vi.fn(), backdropClick: () => new Subject(), keydownEvents: () => new Subject()};
    TestBed.configureTestingModule({imports: [UsageStageModule], providers: [
      {provide: MAT_DIALOG_DATA, useValue: {catalogue: sources, excluded, mode, save, recovering}}, {provide: MatDialogRef, useValue: ref}
    ]});
    const fixture = TestBed.createComponent(UsagePickerComponent); fixture.detectChanges();
    return {fixture, picker: fixture.componentInstance, ref};
  };
  it('keeps selected sources through filtering and excludes saved and unclassified types', () => {
    const {picker, fixture} = render('add', [9]);
    picker.pick(sources[0]); picker.query = {search: 'Gas', filters: {}}; fixture.detectChanges();
    expect(picker.selectionItems.map(item => item.id)).toEqual([2]);
    picker.pick(sources[2]); picker.pick(sources[1]);
    expect(picker.selectionItems.map(item => item.id)).toEqual([2]);
    expect(picker.filtered).toEqual([]);
  });
  it('replaces directly with no multi-add tray and cancellation returns no source', () => {
    const {picker, fixture, ref} = render('replace');
    expect(fixture.nativeElement.querySelector('app-ev-selection-tray')).toBeNull();
    picker.pick(sources[1]); expect(ref.close).toHaveBeenCalledWith(sources[1]);
  });
  it('freezes the submitted selection after an uncertain failure but permits closing to review', async () => {
    let recovering = false;
    const save = vi.fn(async () => {recovering = true; return false;}),
      {picker, ref} = render('add', [], save, () => recovering);
    picker.pick(sources[0]); await picker.submit();
    picker.pick(sources[1]); picker.remove(2); await picker.submit();
    expect(picker.selectionItems.map(item => item.id)).toEqual([2]);
    expect(save).toHaveBeenCalledTimes(1); picker.close(); expect(ref.close).toHaveBeenCalled();
  });
  it('retains failed selection and blocks close/submission while pending', async () => {
    let resolve: (saved: boolean) => void;
    const save = vi.fn(() => new Promise<boolean>(done => resolve = done)),
     {picker, ref} = render('add', [], save);
    picker.pick(sources[0]); const pending = picker.submit();
    picker.close(); await picker.submit(); expect(ref.close).not.toHaveBeenCalled();
    resolve(false); await pending;
    expect(picker.selectionItems.map(item => item.id)).toEqual([2]);
    expect(picker.failed).toBe(true); expect(ref.close).not.toHaveBeenCalled();
  });
});
