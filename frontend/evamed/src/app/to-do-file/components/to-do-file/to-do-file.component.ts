import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import * as XLSX from 'xlsx';
import { FileSaverService } from 'ngx-filesaver';
import { MatDialog } from '@angular/material/dialog';
import { PrevStepsComponent } from 'src/app/to-do-file/components/prev-steps/prev-steps.component';
import { ViewChild, ElementRef, Renderer2 } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CatalogueCacheService } from 'src/app/core/services/catalogue-cache/catalogue-cache.service';
import { MaterialsService } from 'src/app/core/services/materials/materials.service';
import { bySection, fileCatalogue, isGeneratedTemplate, outdatedMaterials } from 'src/app/shared/template-sheets';
import { environment } from 'src/environments/environment';
type AOA = any[][];

@Component({
    selector: 'app-to-do-file',
    templateUrl: './to-do-file.component.html',
    styleUrls: ['./to-do-file.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class ToDoFileComponent implements OnInit {
  fileName: string;
  nameProject: string;
  // The next screens read sessionStorage['dataProject'] once when they open,
  // so Continuar waits until the chosen file has been parsed and stored.
  fileReady = false;
  processingFile = false;
  uploadError: string | null = null;
  downloadError: string | null = null;
  // Sheets with materials that aren't a building element; their rows aren't imported.
  unknownSheets: string[] = [];
  // Each chosen file gets a number; a slower earlier read must not touch the state of a later one.
  private currentUpload = 0;

  @ViewChild('asTitle') title: ElementRef;
  @ViewChild('asImage') image: ElementRef;

  constructor(
    private httpClient: HttpClient,
    private fileSaverService: FileSaverService,
    public dialog: MatDialog,
    private renderer2: Renderer2,
    private materialsService: MaterialsService,
    private catalogueCache: CatalogueCacheService
  ) {}

  ngOnInit(): void {
    const PDP = JSON.parse(sessionStorage.getItem('primaryDataProject'));
    this.nameProject = PDP.name_project;
  }

  onFileChange(evt: any) {
    console.log('acción de botón!!!!!');
    const asTitle = this.title.nativeElement,
     asImage = this.image.nativeElement,

     file = (document.getElementById('file') as HTMLInputElement).files[0]
      .name;
    // textContent: the name is user input; innerHTML via Renderer2 isn't sanitized.
    this.renderer2.setProperty(asTitle, 'textContent', file);

    this.renderer2.setAttribute(
      asImage,
      'src',
      'assets/images/Icon awesome-file-upload-gren.png'
    );
    /* wire up file reader */
    const target: DataTransfer = evt.target;

    if (target.files.length !== 1) {
      throw new Error('Cannot use multiple files');
    }
    // Drop any earlier file's data so nothing stale can reach the next screens.
    sessionStorage.removeItem('dataProject');
    this.fileReady = false;
    this.processingFile = true;
    this.uploadError = null;
    this.unknownSheets = [];
    const upload = ++this.currentUpload,
      isStale = () => upload !== this.currentUpload,
      reader: FileReader = new FileReader();
    reader.onload = async (e: any) => {
      if (isStale()) {
        return;
      }
      try {
        /* read workbook */
        const bstr: string = e.target.result,
         wb: XLSX.WorkBook = XLSX.read(bstr, { type: 'binary' });
        /* assingable */
        let partialData: AOA = [];
        const totalData = [];
        let i = 0;
        /* save data */
        for (i = 0; i < wb.SheetNames.length; i++) {
          partialData = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[i]], {
            raw: true,
            defval: null,
          });
          totalData.push(partialData);
        }

        const { unknownSheets, sectionSheets, ...toRead } = bySection({
          sheetNames: wb.SheetNames,
          data: totalData,
        });
        if (sectionSheets === 0) {
          this.uploadError =
            'El archivo no tiene hojas de elementos constructivos (Cimentación, Muros interiores…). Usa la plantilla de EVAMED.';
          return;
        }
        if (isGeneratedTemplate(wb)) {
          let current: Set<string>;
          try {
            // The cached list may predate a material added since this tab loaded it.
            this.catalogueCache.invalidate(environment.api_materials);
            const materials = await firstValueFrom(this.materialsService.getMaterials());
            current = new Set(materials.map(m => m.name_material));
          } catch (error) {
            if (isStale()) {
              return;
            }
            console.error('No se pudo obtener el catálogo de materiales', error);
            this.uploadError = 'No se pudo verificar el catálogo de materiales. Inténtalo de nuevo.';
            return;
          }
          if (isStale()) {
            return;
          }
          const used = toRead.data.flat().map(row => row?.['Material']).filter(name => name != null).map(String),
            outdated = outdatedMaterials(used, fileCatalogue(wb), current);
          if (outdated.length) {
            const shown = outdated.slice(0, 10).join(', '),
              more = outdated.length > 10 ? ` y ${outdated.length - 10} más` : '';
            this.uploadError = `Esta plantilla usa materiales que ya cambiaron de nombre o se eliminaron: ${shown}${more}. Descarga la plantilla de nuevo y copia tus filas en ella.`;
            return;
          }
        }
        this.unknownSheets = unknownSheets;
        sessionStorage.setItem('dataProject', JSON.stringify(toRead));
        this.fileReady = true;
      } catch (error) {
        if (isStale()) {
          return;
        }
        console.error('No se pudo procesar el archivo', error);
        this.uploadError =
          'No se pudo procesar el archivo. Verifica que sea la plantilla de EVAMED e inténtalo de nuevo.';
      } finally {
        if (!isStale()) {
          this.processingFile = false;
        }
      }
    };
    reader.onerror = () => {
      if (isStale()) {
        return;
      }
      this.processingFile = false;
      this.uploadError = 'No se pudo leer el archivo. Inténtalo de nuevo.';
    };
    reader.readAsArrayBuffer(target.files[0]);
  }

  onDownloadWindows() {
    this.downloadTemplate('windows', `Formato Windows.xlsm`);
  }

  onDownloadMac() {
    this.downloadTemplate('mac', `Formato MAC.xlsm`);
  }

  private downloadTemplate(kind: string, fileName: string) {
    this.downloadError = null;
    this.httpClient
      .get(`${environment.api_template}${kind}.xlsm`, {
        observe: 'response',
        responseType: 'blob',
      })
      .subscribe({
        next: res => {
          this.fileSaverService.save(res.body, fileName);
        },
        error: error => {
          console.error('No se pudo descargar la plantilla', error);
          this.downloadError = 'No se pudo descargar la plantilla. Inténtalo de nuevo.';
        },
      });
  }

  onDownloadMated() {
    const fileName = `MATED.zip`;
    this.httpClient
      .get(`assets/files/MATED.zip`, {
        observe: 'response',
        responseType: 'blob',
      })
      .subscribe(res => {
        this.fileSaverService.save(res.body, fileName);
      });
    return;
  }

  saveFile() {
    if (!this.fileReady) {
      return;
    }
    this.dialog.open(PrevStepsComponent);
  }
}
