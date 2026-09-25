import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { FileSaverService } from 'ngx-filesaver';
import * as XLSX from 'xlsx';

import { ToDoFileModule } from '../../to-do-file.module';
import { ToDoFileComponent } from './to-do-file.component';

// The upload is parsed asynchronously (FileReader, then SheetJS) and handed to
// the next screens through sessionStorage['dataProject'], which they read once
// on open. Continuar must stay disabled until that hand-off has happened, or
// they read nothing, or a previous file's data.
describe('ToDoFileComponent upload', () => {
  let fixture: ComponentFixture<ToDoFileComponent>,
    dialog: { open: ReturnType<typeof vi.fn> };

  const continueButton = (): HTMLButtonElement =>
      fixture.nativeElement.querySelector('.section-continue button'),
    workbookFile = (): File => {
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['Material'], ['Concreto']]), 'Nuevo');
      const bytes: ArrayBuffer = XLSX.write(book, { type: 'array', bookType: 'xlsx' });
      return new File([bytes], 'proyecto.xlsm');
    },
    chooseFile = (file: File) => {
      const input: HTMLInputElement = fixture.nativeElement.querySelector('#file');
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      input.dispatchEvent(new Event('change'));
      fixture.detectChanges();
    };

  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('primaryDataProject', JSON.stringify({ name_project: 'Casa' }));
    // Left over from an earlier import in the same tab.
    sessionStorage.setItem('dataProject', JSON.stringify({ sheetNames: ['Viejo'], data: [[]] }));

    dialog = { open: vi.fn() };
    TestBed.configureTestingModule({
      imports: [ToDoFileModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialog, useValue: dialog },
        { provide: FileSaverService, useValue: { save: vi.fn() } },
      ],
    });
    fixture = TestBed.createComponent(ToDoFileComponent);
    fixture.detectChanges();
  });

  afterEach(() => vi.restoreAllMocks());

  it('keeps Continuar disabled until a file is chosen', () => {
    expect(continueButton().disabled).toBe(true);
  });

  it('keeps Continuar disabled and drops stale data while the file is parsed', () => {
    chooseFile(workbookFile());

    expect(continueButton().disabled).toBe(true);
    expect(sessionStorage.getItem('dataProject')).toBeNull();

    fixture.componentInstance.saveFile();
    expect(dialog.open).not.toHaveBeenCalled();
  });

  it('enables Continuar once the parsed file is stored', async () => {
    chooseFile(workbookFile());

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(continueButton().disabled).toBe(false);
    });
    expect(JSON.parse(sessionStorage.getItem('dataProject')).sheetNames).toEqual(['Nuevo']);

    continueButton().click();
    expect(dialog.open).toHaveBeenCalledTimes(1);
  });

  it('stays disabled and says so when the parsed file cannot be stored', async () => {
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === 'dataProject') {
        throw new DOMException('quota', 'QuotaExceededError');
      }
      return setItem.call(this, key, value);
    });

    chooseFile(workbookFile());

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.upload-error')).not.toBeNull();
    });
    expect(continueButton().disabled).toBe(true);
  });
});
