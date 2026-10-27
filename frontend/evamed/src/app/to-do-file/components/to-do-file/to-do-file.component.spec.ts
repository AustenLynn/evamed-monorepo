import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of, Subject, throwError } from 'rxjs';
import { FileSaverService } from 'ngx-filesaver';
import * as XLSX from 'xlsx';
import { environment } from 'src/environments/environment';

import { MaterialsService } from 'src/app/core/services/materials/materials.service';
import { ToDoFileModule } from '../../to-do-file.module';
import { ToDoFileComponent } from './to-do-file.component';

// The upload is parsed asynchronously (FileReader, then SheetJS) and handed to
// the next screens through sessionStorage['dataProject'], which they read once
// on open. Continuar must stay disabled until that hand-off has happened, or
// they read nothing, or a previous file's data.
describe('ToDoFileComponent upload', () => {
  let fixture: ComponentFixture<ToDoFileComponent>,
    dialog: { open: ReturnType<typeof vi.fn> },
    getMaterials: ReturnType<typeof vi.fn>;

  const continueButton = (): HTMLButtonElement =>
      fixture.nativeElement.querySelector('.section-continue button'),
    workbookFile = (...sheets: string[]): File => {
      const book = XLSX.utils.book_new();
      (sheets.length ? sheets : ['Cimentación']).forEach(sheet =>
        XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['Material'], ['Concreto']]), sheet)
      );
      const bytes: ArrayBuffer = XLSX.write(book, { type: 'array', bookType: 'xlsx' });
      return new File([bytes], 'proyecto.xlsm');
    },
    // A server-built template: marked with EVAMED_CATALOGO, BD header on row 5.
    templateFile = (marked: boolean, bdMaterials: string[], used: string): File => {
      const book = XLSX.utils.book_new(),
        bd = [[], [], [], [], ['Llave', 'Base', 'Categoria', 'Tipo', 'Material'], ...bdMaterials.map(m => ['k', 'EPiC', 'C', 'T', m])];
      XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['Material'], [used]]), 'Cimentación');
      XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(bd), 'BD');
      if (marked) {
        book.Workbook = { Names: [{ Name: 'EVAMED_CATALOGO', Ref: '"2026-10-27T20:00:00Z"' }] };
      }
      const bytes: ArrayBuffer = XLSX.write(book, { type: 'array', bookType: 'xlsx' });
      return new File([bytes], 'proyecto.xlsx');
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
    getMaterials = vi.fn(() => of([{ name_material: 'Cemento' }]));
    TestBed.configureTestingModule({
      imports: [ToDoFileModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialog, useValue: dialog },
        { provide: FileSaverService, useValue: { save: vi.fn() } },
        { provide: MaterialsService, useValue: { getMaterials } },
      ],
    });
    fixture = TestBed.createComponent(ToDoFileComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Specs share one environment; don't leave an upload behind for the next file.
    sessionStorage.clear();
  });

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
    const stored = JSON.parse(sessionStorage.getItem('dataProject'));
    expect(stored.sheetNames[0]).toBe('Cimentación');
    expect(stored.data[0]).toEqual([{ Material: 'Concreto' }]);

    continueButton().click();
    expect(dialog.open).toHaveBeenCalledTimes(1);
  });

  // EVAMED_WINDOWS.xlsm has no hidden first sheet; rows go by sheet name, not position.
  it('stores the rows by section whatever the sheet order', async () => {
    chooseFile(workbookFile('Otros', 'Cimentación'));

    await vi.waitFor(() => expect(fixture.componentInstance.fileReady).toBe(true));
    const stored = JSON.parse(sessionStorage.getItem('dataProject'));
    expect(stored.data[0]).toEqual([{ Material: 'Concreto' }]);
    expect(stored.data[10]).toEqual([{ Material: 'Concreto' }]);
    expect(stored.data[1]).toEqual([]);
  });

  it('names the sheets it did not import', async () => {
    chooseFile(workbookFile('Cimentación', 'Cocina'));

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.upload-status')?.textContent).toContain('Cocina');
    });
    expect(continueButton().disabled).toBe(false);
  });

  it('refuses a file with no building-element sheets', async () => {
    chooseFile(workbookFile('Nuevo'));

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.upload-error')).not.toBeNull();
    });
    expect(continueButton().disabled).toBe(true);
    expect(sessionStorage.getItem('dataProject')).toBeNull();
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
  it('shows the file name as text, not HTML', async () => {
    const name = '<img src=x onerror="window.__pwned=1">Diseño & obra <v2>.xlsm';

    chooseFile(new File(['x'], name));

    const label: HTMLElement = fixture.nativeElement.querySelector('#fileType');
    expect(label.textContent).toBe(name);
    expect(label.querySelector('img')).toBeNull();

    // Let the upload finish here: its FileReader writes sessionStorage when it
    // completes, and specs share one environment.
    await vi.waitFor(() => expect(fixture.componentInstance.processingFile).toBe(false));
  });

  // The Excel templates are served by the API, not bundled in assets/.
  const clickDownload = (alt: string) => {
    const img: HTMLImageElement = fixture.nativeElement.querySelector(`img[alt="${alt}"]`);
    img.closest<HTMLElement>('.icon-download').click();
  };

  it('downloads the Windows template from the server', () => {
    const httpMock = TestBed.inject(HttpTestingController),
      saver = TestBed.inject(FileSaverService),
      blob = new Blob(['xlsm']);

    clickDownload('Download Windows file');

    httpMock.expectOne(environment.api_template + 'windows.xlsm').flush(blob);
    expect(saver.save).toHaveBeenCalledWith(blob, 'Formato Windows.xlsm');
    httpMock.verify();
  });

  it('downloads the Mac template from the server', () => {
    const httpMock = TestBed.inject(HttpTestingController),
      saver = TestBed.inject(FileSaverService),
      blob = new Blob(['xlsm']);

    clickDownload('Download Mac file');

    httpMock.expectOne(environment.api_template + 'mac.xlsm').flush(blob);
    expect(saver.save).toHaveBeenCalledWith(blob, 'Formato MAC.xlsm');
    httpMock.verify();
  });

  const showsError = () =>
    vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.upload-error')).not.toBeNull();
    });

  it('rejects a new file that uses a renamed material, and names it', async () => {
    chooseFile(templateFile(true, ['Cemento', 'Viejo'], 'Viejo'));

    await showsError();
    expect(fixture.nativeElement.querySelector('.upload-error').textContent).toContain('Viejo');
    expect(continueButton().disabled).toBe(true);
    expect(sessionStorage.getItem('dataProject')).toBeNull();
  });

  it('accepts a new file whose unknown names were typed by hand', async () => {
    chooseFile(templateFile(true, ['Cemento'], 'Mío'));

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(continueButton().disabled).toBe(false);
    });
  });

  it('checks nothing on a file from before this change', async () => {
    chooseFile(templateFile(false, ['Viejo'], 'Viejo'));

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(continueButton().disabled).toBe(false);
    });
    expect(getMaterials).not.toHaveBeenCalled();
  });

  it('stays disabled when the catalogue cannot be fetched', async () => {
    getMaterials.mockReturnValue(throwError(() => new Error()));

    chooseFile(templateFile(true, ['Cemento'], 'Cemento'));

    await showsError();
    expect(fixture.nativeElement.querySelector('.upload-error').textContent).toContain('No se pudo verificar el catálogo');
    expect(continueButton().disabled).toBe(true);
    expect(sessionStorage.getItem('dataProject')).toBeNull();
  });

  it('lists at most 10 outdated names and counts the rest', async () => {
    const old = Array.from({ length: 12 }, (_, i) => `Viejo${String(i).padStart(2, '0')}`),
      book = XLSX.utils.book_new(),
      bd = [[], [], [], [], ['Llave', 'Base', 'Categoria', 'Tipo', 'Material'], ...['Cemento', ...old].map(m => ['k', 'EPiC', 'C', 'T', m])];
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['Material'], ...old.map(m => [m])]), 'Cimentación');
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(bd), 'BD');
    book.Workbook = { Names: [{ Name: 'EVAMED_CATALOGO', Ref: '"2026-10-27T20:00:00Z"' }] };
    const bytes: ArrayBuffer = XLSX.write(book, { type: 'array', bookType: 'xlsx' });

    chooseFile(new File([bytes], 'proyecto.xlsx'));

    await showsError();
    const text: string = fixture.nativeElement.querySelector('.upload-error').textContent;
    expect(old.slice(0, 10).every(name => text.includes(name))).toBe(true);
    expect(text).not.toContain('Viejo10');
    expect(text).toContain('Viejo09 y 2 más.');
  });

  it('shows a message and saves nothing when the template download fails', () => {
    const httpMock = TestBed.inject(HttpTestingController),
      saver = TestBed.inject(FileSaverService);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    clickDownload('Download Windows file');
    httpMock.expectOne(environment.api_template + 'windows.xlsm').error(new ProgressEvent('error'), { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.download-error').textContent).toContain(
      'No se pudo descargar la plantilla. Inténtalo de nuevo.'
    );
    expect(saver.save).not.toHaveBeenCalled();

    // A retry clears the message.
    clickDownload('Download Windows file');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.download-error')).toBeNull();
    httpMock.expectOne(environment.api_template + 'windows.xlsm').flush(new Blob(['x']));
  });

  it('ignores a slower earlier file once a later one has been chosen', async () => {
    const slow = new Subject<{ name_material: string }[]>();
    getMaterials.mockReturnValueOnce(slow);

    // A uses a renamed material, so it would be rejected if it were still current.
    chooseFile(templateFile(true, ['Cemento', 'Viejo'], 'Viejo'));
    await vi.waitFor(() => expect(getMaterials).toHaveBeenCalledTimes(1));

    chooseFile(templateFile(true, ['Cemento'], 'Cemento'));
    await vi.waitFor(() => expect(fixture.componentInstance.fileReady).toBe(true));
    const stored = sessionStorage.getItem('dataProject');

    slow.next([{ name_material: 'Cemento' }]);
    slow.complete();
    await new Promise(resolve => setTimeout(resolve));
    fixture.detectChanges();

    expect(sessionStorage.getItem('dataProject')).toBe(stored);
    expect(JSON.parse(stored).data[0]).toEqual([{ Material: 'Cemento' }]);
    expect(fixture.componentInstance.fileReady).toBe(true);
    expect(fixture.componentInstance.uploadError).toBeNull();
    expect(fixture.componentInstance.processingFile).toBe(false);
    expect(continueButton().disabled).toBe(false);
  });
});

// The catalogue cache lives as long as the tab; the check must not use an older list.
describe('ToDoFileComponent upload against the catalogue cache', () => {
  it('accepts a file that uses a material added after the tab cached the catalogue', async () => {
    sessionStorage.clear();
    sessionStorage.setItem('primaryDataProject', JSON.stringify({ name_project: 'Casa' }));
    TestBed.configureTestingModule({
      imports: [ToDoFileModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: FileSaverService, useValue: { save: vi.fn() } },
      ],
    });
    const httpMock = TestBed.inject(HttpTestingController),
      fixture = TestBed.createComponent(ToDoFileComponent);
    fixture.detectChanges();

    // An earlier page cached the catalogue without 'Nuevo'.
    TestBed.inject(MaterialsService).getMaterials().subscribe();
    httpMock.expectOne(environment.api_materials).flush([{ name_material: 'Cemento' }]);

    const book = XLSX.utils.book_new(),
      bd = [[], [], [], [], ['Llave', 'Base', 'Categoria', 'Tipo', 'Material'], ['k', 'EPiC', 'C', 'T', 'Cemento'], ['k', 'EPiC', 'C', 'T', 'Nuevo']];
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['Material'], ['Nuevo']]), 'Cimentación');
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(bd), 'BD');
    book.Workbook = { Names: [{ Name: 'EVAMED_CATALOGO', Ref: '"2026-10-27T20:00:00Z"' }] };
    const bytes: ArrayBuffer = XLSX.write(book, { type: 'array', bookType: 'xlsx' }),
      input: HTMLInputElement = fixture.nativeElement.querySelector('#file');
    Object.defineProperty(input, 'files', { value: [new File([bytes], 'proyecto.xlsx')], configurable: true });
    input.dispatchEvent(new Event('change'));

    // The check asks the server again instead of replaying the cached list.
    await vi.waitFor(() => httpMock.expectOne(environment.api_materials).flush([{ name_material: 'Cemento' }, { name_material: 'Nuevo' }]));
    await vi.waitFor(() => expect(fixture.componentInstance.fileReady).toBe(true));
    expect(fixture.componentInstance.uploadError).toBeNull();
    sessionStorage.clear();
  });
});
