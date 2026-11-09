import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { EquipmentStageUiModule } from './equipment-stage-ui.module';
import { EquipmentCatalogueService } from './equipment-catalogue.service';
import { EquipmentPickerService } from './equipment-picker.service';

describe('Equipment picker opening', () => {
  afterEach(() => TestBed.inject(MatDialog).closeAll());
  it('prevents stacked pickers through loading and closing and allows reopening afterward', async () => {
    TestBed.configureTestingModule({imports: [EquipmentStageUiModule], providers: [
      {provide: EquipmentCatalogueService, useValue: {load: () => of({sources: [], units: [], unitLabels: [], constructionEnergyProcessId: 8})}}
    ]});
    const picker = TestBed.inject(EquipmentPickerService),
      context = {stage: 'construction' as const, section: 'Pisos', mode: 'add' as const},
      first = picker.pickMany(context), repeated = picker.pickMany(context),
      dialogs = TestBed.inject(MatDialog);
    for (let i = 0; i < 50 && !dialogs.openDialogs.length; i++) await new Promise(resolve => setTimeout(resolve));
    expect(await repeated).toEqual([]);
    expect(dialogs.openDialogs).toHaveLength(1);
    dialogs.openDialogs[0].close();
    expect(await picker.pickMany(context)).toEqual([]);
    expect(await first).toEqual([]);
    const reopened = picker.pickMany(context);
    for (let i = 0; i < 50 && !dialogs.openDialogs.length; i++) await new Promise(resolve => setTimeout(resolve));
    expect(dialogs.openDialogs).toHaveLength(1);
    dialogs.openDialogs[0].close();
    expect(await reopened).toEqual([]);
  });
});
