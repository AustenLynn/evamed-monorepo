import { CatalogsService } from 'src/app/core/services/catalogs/catalogs.service';
import { EndLifeService } from './../../../core/services/end-life/end-life.service';
import { Component, OnInit, OnDestroy } from '@angular/core';

import { Router } from '@angular/router';
import { MatListOption } from '@angular/material/list';
import { MaterialsService } from 'src/app/core/services/materials/materials.service';
import { EnergyTotalService } from 'src/app/core/services/energy-total/energy-total.service';

import { MatDialog } from '@angular/material/dialog';
import { IntermedialComponent } from '../intermedial/intermedial.component';

@Component({
    selector: 'app-end-life-stage',
    templateUrl: './end-life-stage.component.html',
    styleUrls: ['./end-life-stage.component.scss'],
    standalone: false
})
export class EndLifeStageComponent implements OnInit, OnDestroy {
  sheetNames: any;
  contentData: any;
  listData: any;
  indexSheet: any;
  nameProject: string;
  projectId: number;
  SistemasConstructivos: any;
  listMateriales: any;
  selectedOptions: string[] = [];
  panelOpenFirst = false;
  panelOpenSecond = false;
  panelOpenThird = false;
  dataArrayEC = [];
  dataArrayTD = [];
  EC: any;
  TD: any;
  catalogoFuentes: any;
  catalogoUnidadEnergia: [];
  selectedSheet: any;
  endSave = false;
  procesoSeleccionado = '';
  private autosaveIntervalId: ReturnType<typeof setInterval> | null = null;
  private lastAutosaveSignature: string | null = null;

  constructor(
    private router: Router,
    private endLifeService: EndLifeService,
    private catalogsService: CatalogsService,
    private materialsService: MaterialsService,
    public dialog: MatDialog,
    private energyTotalService: EnergyTotalService,
  ) {
    this.catalogsService.getSourceInformation().subscribe(data => {
      const fuentes = [];
      data.map(fuente => {
        if (fuente.name_source_information !== 'Mexicaniuh - CADIS') {
          fuentes.push(fuente);
        }
      });
      this.catalogoFuentes = fuentes;
    });
    this.catalogsService.getEnergyUnits().subscribe(data => {
      // console.log('lógica de unidades!!!!');
      // console.log(data);
      const energia = [];
      data.map(unidad => {
        if (unidad.name_energy_unit === 'Hrs') {
          energia.push(unidad);
        }
      });
      this.catalogoUnidadEnergia = data;
    });
  }

  ngOnInit() {
    const data = JSON.parse(sessionStorage.getItem('dataProject')),
     PDP = JSON.parse(sessionStorage.getItem('primaryDataProject'));

    this.sheetNames = [];
    this.nameProject = PDP.name_project;
    this.projectId = PDP.id;
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

    this.initialChange();
    this.indexSheet = undefined;
    this.dataArrayTD.push([]);

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
        console.log('autosave: end-life-stage skipped (missing projectId or EC)');
        return;
      }
      const signature = this.buildAutosaveSignature();
      if (signature === this.lastAutosaveSignature) {
        return;
      }

      this.onSaveEC();
      this.lastAutosaveSignature = signature;
      console.log('autosave: end-life-stage');
      this.saveStepFour();
    }, 5000);
  }

  private buildAutosaveSignature(): string {
    return JSON.stringify({
      projectId: this.projectId,
      indexSheet: this.indexSheet,
      dataArrayEC: this.dataArrayEC,
      dataArrayTD: this.dataArrayTD,
    });
  }

  initialChange() {
    // take index of selection
    this.indexSheet = this.sheetNames.indexOf('Cimentación');
    let i;
    for (i = 0; i <= this.sheetNames.length; i++) {
      if (this.indexSheet === i && this.EC !== undefined) {
        this.dataArrayEC = this.EC[i];
        this.dataArrayTD = this.TD[i];
      }
    }
  }

  onGroupsChange(options: MatListOption[]) {
    let selectedSheet;
    // map these MatListOptions to their values
    options.map(option => {
      selectedSheet = option.value;
    });
    // take index of selection
    this.indexSheet = this.sheetNames.indexOf(selectedSheet);
    let i;
    for (i = 0; i <= this.sheetNames.length; i++) {
      if (this.indexSheet === i && this.EC !== undefined) {
        this.dataArrayEC = this.EC[i];
        this.dataArrayTD = this.TD[i];
      }
    }

    this.selectedSheet = selectedSheet;

    this.dataArrayEC = this.dataArrayEC === undefined ? (this.dataArrayEC = []) : this.dataArrayEC;
    this.dataArrayTD = this.dataArrayTD === undefined ? (this.dataArrayTD = []) : this.dataArrayTD;

    if (this.dataArrayEC.length === 0) {
      this.dataArrayEC.push([]);
    }

    if (this.dataArrayTD.length === 0) {
      this.dataArrayTD.push([]);
    }

    this.procesoSeleccionado = selectedSheet;
  }

  onNgModelChange() {
    // console.log('on ng model change', event);
  }

  showMaterials(event, sc) {
    const materiales = [];
    this.listData.map(data => {
      if (data.Sistema_constructivo === sc) {
        materiales.push(data.Material);
      }
    });
    this.listMateriales = materiales;
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
    if (this.TD === undefined) {
      this.TD = [];
    }
    for (i = 0; i <= this.sheetNames.length; i++) {
      if (this.indexSheet === i) {
        this.EC[i] = this.dataArrayEC;
        this.TD[i] = this.dataArrayTD;
      }
    }
  }

  onFieldBlur(): void {
    if (!this.projectId || this.indexSheet === undefined) {
      return;
    }
    this.onSaveEC();
    this.saveStepFour();
    this.computeAndPushTotal();
  }

  private computeAndPushTotal(): void {
    const sum = (this.dataArrayEC || [])
      .reduce((acc, d) => acc + (parseFloat(d.cantidad) || 0), 0);
    this.energyTotalService.setEndLifeTotal(sum);
  }

  private parseQuantity(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const normalized = String(value).replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  async saveStepFour() {
    console.log('confirm step 4');
    if (!this.EC || this.EC.length === 0) {
      return;
    }
    try {
      await Object.entries(this.EC).forEach(([key, ec]) => {
        const ecAny: any = ec;
        ecAny.map(data => {
          const quantity = this.parseQuantity(data?.cantidad);
          if (quantity === null || !data?.unidad || !data?.fuente) {
            return;
          }
          const signature = JSON.stringify({
            quantity,
            unidad: data.unidad,
            fuente: data.fuente,
            section: parseInt(key, 10) + 1
          });
          if (data._signature === signature) {
            return;
          }
          if (data.id !== undefined) {
            this.endLifeService.deleteECDP(data.id).subscribe(() => {
              console.log(`Se eliminó ${data.id}`);
            });
          }
          console.log('Fin de vida!!!');
          console.log(data);
          this.endLifeService
            .addECDP({
              quantity,
              unit_id: data.unidad,
              source_information_id: data.fuente,
              section_id: parseInt(key, 10) + 1,
              project_id: this.projectId,
            })
            .subscribe(result => {
              data.id = result?.id ?? data.id;
              data._signature = signature;
              console.log(result);
            });
        });
      });
    } catch (error) {
      console.log(error);
    }
  }

  showModal() {
    console.log('enter show modal');
    const dialogRef = this.dialog.open(IntermedialComponent, {
      width: '680px',
      data: {},
    });

    dialogRef.afterClosed().subscribe(() => {
      // this.ngOnInit();

      this.endSave = true;
      console.log(this.endSave);
    });
  }

  goToMaterialStage() {
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
    const projectId = this.projectId ?? parseInt(
      localStorage.getItem('idProyectoConstrucción') ?? '',
      10
    );
    if (!Number.isFinite(projectId)) {
      this.router.navigateByUrl('construction-stage');
      return;
    }

    this.materialsService.getConstructionStage().subscribe(cse => {
      const schemaFilter = cse.filter(
        schema => Number(schema.project_id) === projectId
      );

      if (schemaFilter.length === 0) {
        this.router.navigateByUrl('construction-stage');
      } else {
        localStorage.setItem('idProyectoConstrucción', projectId.toString());
        this.router.navigateByUrl('construction-stage/update');
      }
    });
  }

  goToUsageStage() {
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
    this.router.navigateByUrl('end-life-stage');
  }

  continue() {
    this.router.navigateByUrl('/home-evamed');
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
