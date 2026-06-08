import { Component, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { MatListOption } from '@angular/material/list';
import { MatAccordion } from '@angular/material/expansion';
import { CatalogsService } from './../../../core/services/catalogs/catalogs.service';
import { ConstructionStageService } from 'src/app/core/services/construction-stage/construction-stage.service';
import { MaterialsService } from './../../../core/services/materials/materials.service';
import { EnergyTotalService } from 'src/app/core/services/energy-total/energy-total.service';

@Component({
    selector: 'app-construction-stage',
    templateUrl: './construction-stage.component.html',
    styleUrls: ['./construction-stage.component.scss'],
    standalone: false
})
export class ConstructionStageComponent implements OnInit, OnDestroy {
  @ViewChild(MatAccordion) accordion: MatAccordion;

  sheetNames: any;
  contentData: any;
  listData: any;
  indexSheet: any;
  SistemasConstructivos: any;
  catalogoFuentes: any;
  catalogoUnidadEnergia: any;
  catalogoUnidadVolumen: [];
  catalogoUnidadMasa: [];
  nameProject: string;
  projectId: number;
  dataArrayEC = [];
  dataArrayAC = [];
  dataArrayDG = [];
  EC: any[][] = [];
  AC: any;
  DG: any;
  selectedSheet: any;
  endSave = false;
  procesoSeleccionado = '';
  private autosaveIntervalId: ReturnType<typeof setInterval> | null = null;
  private lastAutosaveSignature: string | null = null;
  private isSwitchingSheet = false;

  constructor(
    private materialsService: MaterialsService,
    private catalogsService: CatalogsService,
    private constructionStageService: ConstructionStageService,
    private router: Router,
    private energyTotalService: EnergyTotalService,
  ) {
    this.catalogsService.getSourceInformation().subscribe(data => {
      // this.catalogoFuentes = data;
      const fuentes = [];
      data.map(fuente => {
        if (fuente.name_source_information !== 'Mexicaniuh - CADIS') {
          fuentes.push(fuente);
        }
      });
      this.catalogoFuentes = fuentes;
    });
    this.catalogsService.getEnergyUnits().subscribe(data => {
      /*const energia = [];
      data.map(unidad => {
        if (unidad.name_energy_unit === 'Hrs') {
          energia.push(unidad);
        }
      });
      this.catalogoUnidadEnergia = energia;*/
      this.catalogoUnidadEnergia = data;
      // TODO: get proper units for sources and dbs
    });
    this.catalogsService.getVolumeUnits().subscribe(data => {
      this.catalogoUnidadVolumen = data;
    });
    this.catalogsService.getBulkUnits().subscribe(data => {
      this.catalogoUnidadMasa = data;
    });
  }

  ngOnInit() {
    const PDP = JSON.parse(sessionStorage.getItem('primaryDataProject')),
     data = JSON.parse(sessionStorage.getItem('dataProject'));

    this.nameProject = PDP.name_project;
    this.projectId = PDP.id;

    this.sheetNames = [];
    data.sheetNames.map(sheetname => {
      if (
        sheetname !== 'Muros InterioresBis' &&
        sheetname !== 'Inicio' &&
        sheetname !== 'Registro' &&
        sheetname !== 'ListaElementos' &&
        sheetname !== 'BD' &&
        sheetname !== 'Parametros'
      ) {
        this.sheetNames.push(sheetname);
      }
    });
    this.contentData = data.data;
    this.indexSheet = undefined;

    // Save on blur instead of polling.
  }

  ngOnDestroy(): void {
    if (this.autosaveIntervalId) {
      clearInterval(this.autosaveIntervalId);
      this.autosaveIntervalId = null;
    }
  }

  private startAutosave(): void {
    if (this.autosaveIntervalId) {
      return;
    }

    this.autosaveIntervalId = setInterval(() => {
      if (!this.projectId || !this.EC) {
        console.log('autosave: construction-stage skipped (missing projectId or EC)');
        return;
      }
      const signature = this.buildAutosaveSignature();
      if (signature === this.lastAutosaveSignature) {
        return;
      }

      this.onSaveEC();
      this.lastAutosaveSignature = signature;
      console.log('autosave: construction-stage');
      this.saveStepTwo();
    }, 5000);
  }

  private buildAutosaveSignature(): string {
    return JSON.stringify({
      projectId: this.projectId,
      indexSheet: this.indexSheet,
      dataArrayEC: this.dataArrayEC,
      dataArrayAC: this.dataArrayAC,
      dataArrayDG: this.dataArrayDG,
    });
  }

  onGroupsChange(options: MatListOption[]) {
    this.isSwitchingSheet = true;
    /*let selectedSheet;
    // map these MatListOptions to their values
    options.map(option => {
      selectedSheet = option.value;
    });
    // take index of selection
    this.indexSheet = this.sheetNames.indexOf(selectedSheet);
    // take memory of saved data
    let i;
    for (i = 0; i <= this.sheetNames.length; i++) {
      if (this.indexSheet === i && this.EC !== undefined) {
        this.dataArrayEC = this.EC[i];
      }
      if (this.indexSheet === i && this.AC !== undefined) {
        this.dataArrayAC = this.AC[i];
      }
      if (this.indexSheet === i && this.DG !== undefined) {
        this.dataArrayDG = this.DG[i];
      }
    }

    if (this.dataArrayEC.length === 0) {
      this.addFormEC();
    }
    if (this.dataArrayAC.length === 0) {
      this.addFormAC();
    }
    if (this.dataArrayDG.length === 0) {
      this.addFormDG();
    }*/

    const selectedSheet = options[0]?.value;
    this.procesoSeleccionado = selectedSheet;
    if (!selectedSheet) {
      console.warn('No hay grupo seleccionado');
      return;
    }

    // Find the index of selected sheet
    this.indexSheet = this.sheetNames.indexOf(selectedSheet);

    // Defensive check
    if (this.indexSheet < 0) {
      console.warn('El grupo seleccionado no existe');
      return;
    }

    // Assign data arrays if available
    this.dataArrayEC = this.EC?.[this.indexSheet];

    if (!this.dataArrayEC || this.dataArrayEC.length === 0) {
      this.addFormEC();
    }

    setTimeout(() => {
      this.isSwitchingSheet = false;
    });
  }

  addFormEC() {
    if (this.dataArrayEC === undefined) {
      this.dataArrayEC = [];
    }
    this.dataArrayEC.push([]);
  }

  removeFormEC(i) {
    this.dataArrayEC.splice(i);
  }

  onSaveEC() {
    let i;
    if (this.EC === undefined) {
      this.EC = [];
    }
    for (i = 0; i <= this.sheetNames.length; i++) {
      if (this.indexSheet === i) {
        this.EC[i] = this.dataArrayEC;
      }
    }
  }

  onFieldBlur(): void {
    if (!this.projectId || this.indexSheet === undefined) {
      return;
    }
    this.onSaveEC();
    this.saveStepTwo();
    this.computeAndPushTotal();
  }

  private computeAndPushTotal(): void {
    const sum = [...(this.dataArrayEC || []), ...(this.dataArrayAC || []), ...(this.dataArrayDG || [])]
      .reduce((acc, d) => acc + (parseFloat(d.cantidad) || 0), 0);
    this.energyTotalService.setConstructionTotal(sum);
  }

  private saveBeforeNavigate(): void {
    if (!this.projectId || this.indexSheet === undefined) {
      return;
    }
    this.onSaveEC();
    this.saveStepTwo();
  }

  onSelectChange(event: { isUserInput?: boolean }): void {
    this.onFieldBlur();
  }

  addFormAC() {
    if (this.dataArrayAC === undefined) {
      this.dataArrayAC = [];
    }
    this.dataArrayAC.push([]);
  }

  removeFormAC(i) {
    this.dataArrayAC.splice(i);
  }

  onSaveAC() {
    let i;
    if (this.AC === undefined) {
      this.AC = [];
    }
    for (i = 0; i <= this.sheetNames.length; i++) {
      if (this.indexSheet === i) {
        this.AC[i] = this.dataArrayAC;
      }
    }
  }

  addFormDG() {
    if (this.dataArrayDG === undefined) {
      this.dataArrayDG = [];
    }
    this.dataArrayDG.push([]);
  }

  removeFormDG(i) {
    this.dataArrayDG.splice(i);
  }

  onSaveDG() {
    let i;
    if (this.DG === undefined) {
      this.DG = [];
    }
    for (i = 0; i <= this.sheetNames.length; i++) {
      if (this.indexSheet === i) {
        this.DG[i] = this.dataArrayDG;
      }
    }
  }

  onNgModelChange() {}

  private parseQuantity(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const normalized = String(value).replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  async saveStepTwo() {
    try {
      await Object.entries(this.EC).forEach(([key, ec]) => {
        const ecAny: any = ec;
        ecAny.map(data => {
          const quantity = this.parseQuantity(data?.cantidad);
          if (quantity === null || !data?.fuente || !data?.unidad) {
            return;
          }
          this.constructionStageService
            .addConstructiveSistemElement({
              quantity,
              project_id: this.projectId,
              section_id: parseInt(key, 10) + 1,
              constructive_process_id: 1,
              volume_unit_id: null,
              energy_unit_id: data.unidad,
              bulk_unit_id: null,
              source_information_id: data.fuente,
            })
            .subscribe(data => {
              console.log('Success EC!!!!!!!');
              console.log(data);
            });
        });
      });
    } catch (error) {
      console.log(error);
    }

    /*try {
      await Object.entries(this.AC).forEach(([key, ec]) => {
        const ecAny: any = ec;
        ecAny.map(data => {
          this.constructionStageService
            .addConstructiveSistemElement({
              quantity: data.cantidad,
              project_id: this.projectId,
              section_id: parseInt(key, 10) + 1,
              constructive_process_id: 2,
              volume_unit_id: data.unidad,
              energy_unit_id: null,
              bulk_unit_id: null,
              source_information_id: data.fuente,
            })
            .subscribe(data => {
              console.log('Success AC!!!!!');
              console.log(data);
            });
        });
      });
    } catch (error) {
      console.log(error);
    }

    try {
      await Object.entries(this.DG).forEach(([key, ec]) => {
        const ecAny: any = ec;
        ecAny.map(data => {
          this.constructionStageService
            .addConstructiveSistemElement({
              quantity: data.cantidad,
              project_id: this.projectId,
              section_id: parseInt(key, 10) + 1,
              constructive_process_id: 3,
              volume_unit_id: null,
              energy_unit_id: null,
              bulk_unit_id: data.unidad,
              source_information_id: data.fuente,
            })
            .subscribe(data => {
              console.log('Success DG!!!!!');
              console.log(data);
            });
        });
      });
    } catch (error) {
      console.log(error);
    }*/

    //await this.showModal();
    // this.router.navigateByUrl('usage-stage');
  }

  goToMaterialStage() {
    this.saveBeforeNavigate();
    this.materialsService.getMaterialSchemeProyects().subscribe(msp => {
      const schemaFilter = msp.filter(
        schema => schema.project_id === this.projectId
      );

      if (schemaFilter.length === 0) {
        this.router.navigateByUrl('materials-stage');
      } else {
        localStorage.setItem(
          'idProyectoConstrucción',
          this.projectId.toString()
        );
        this.router.navigateByUrl('materials-stage/update');
      }
    });
  }

  goToConstructionStage() {
    this.router.navigateByUrl('construction-stage');
  }


  goToUsageStage() {
    this.saveBeforeNavigate();
    this.materialsService.getACR().subscribe(acr => {
      const schemaFilter = acr.filter(
        schema => schema.project_id === this.projectId
      );

      if (schemaFilter.length === 0) {
        this.router.navigateByUrl('usage-stage');
      } else {
        localStorage.setItem(
          'idProyectoConstrucción',
          this.projectId.toString()
        );
        this.router.navigateByUrl('usage-stage/update');
      }
    });
  }

  goToEndLife() {
    this.saveBeforeNavigate();
    this.materialsService.getEDCP().subscribe(edcp => {
      const schemaFilter = edcp.filter(
        schema => schema.project_id === this.projectId
      );

      if (schemaFilter.length === 0) {
        this.router.navigateByUrl('end-life-stage');
      } else {
        localStorage.setItem(
          'idProyectoConstrucción',
          this.projectId.toString()
        );
        this.router.navigateByUrl('end-life-stage/update');
      }
    });
  }

  continue() {
    this.goToUsageStage();
  }

  goToResultados() {
    sessionStorage.setItem('projectID', localStorage.getItem('idProyectoConstrucción'));
    this.router.navigateByUrl('resultados');
  }

  getSelectedSourceName(value: any): string {
    const selected = this.catalogoFuentes.find(option => option.id === value);
    return selected ? selected.name_source_information : '';
  }
}
