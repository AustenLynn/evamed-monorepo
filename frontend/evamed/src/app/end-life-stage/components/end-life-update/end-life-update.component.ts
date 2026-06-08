import { Component, ViewChild, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { MatListOption } from '@angular/material/list';
import { Router } from '@angular/router';
import { CatalogsService } from 'src/app/core/services/catalogs/catalogs.service';
import { EndLifeService } from 'src/app/core/services/end-life/end-life.service';
import { MaterialsService } from 'src/app/core/services/materials/materials.service';
import { EnergyTotalService } from 'src/app/core/services/energy-total/energy-total.service';
import { ProjectsService } from 'src/app/core/services/projects/projects.service';
import { SelectionService } from '../../../core/services/selection/selection.service';
import { MatSelectionList } from '@angular/material/list';
import { finalize, take } from 'rxjs/operators';

@Component({
    selector: 'app-end-life-update',
    templateUrl: './end-life-update.component.html',
    styleUrls: ['./end-life-update.component.scss'],
    standalone: false
})
export class EndLifeUpdateComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('sheets') sheetsList!: MatSelectionList;

  nameProject: string;
  selectedSheet: any;
  sheetNames: any;
  indexSheet: any;
  pendingSection: string | { name_section: string } | null = null;
  listDataReady = false;
  dataArrayEC = [];
  dataArrayTD = [];
  EC: any;
  TD: any;
  catalogoFuentes: any;
  catalogoUnidadEnergia: any;
  ECDP: any[] = [];
  projectId: any;
  procesoSeleccionado = '';
  private autosaveIntervalId: ReturnType<typeof setInterval> | null = null;
  private lastAutosaveSignature: string | null = null;

  constructor(
    private projectsService: ProjectsService,
    private catalogsService: CatalogsService,
    private endLifeService: EndLifeService,
    private materialsService: MaterialsService,
    private router: Router,
    private selectionService: SelectionService,
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
    this.projectsService
      .getProjectById(localStorage.getItem('idProyectoConstrucción'))
      .subscribe((data: any) => {
        this.nameProject = data.name_project;
        this.projectId = data.id;
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
  }

  ngOnInit(): void {
    this.sheetNames = [
      'Cimentación',
      'Muros interiores',
      'Muros exteriores',
      'Pisos',
      'Techos',
      'Entrepiso',
      'Estructura',
      'Puertas',
      'Ventanas',
      'Inst. especiales',
      'Otros',
    ];

    this.indexSheet = undefined;
    this.dataArrayTD.push([]);

    this.energyTotalService.loadAll();

    this.endLifeService.getECDP().subscribe(data => {
      const projectId = parseInt(localStorage.getItem('idProyectoConstrucción') ?? '', 10);
      this.ECDP = data.filter(item => item.project_id === projectId);
      this.computeAndPushTotal();

      // Now that data is ready, trigger initial section selection
      this.selectionService.section$.pipe(take(1)).subscribe(section => {
        if (section) {
          this.pendingSection = section;
          if (this.listDataReady) {
            this.selectSheetInUI(this.pendingSection);
          }
        }
      });
    });

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
      const signature = this.buildAutosaveSignature();
      if (signature === this.lastAutosaveSignature) {
        return;
      }

      console.log('autosave: end-life-update');
      this.onSaveEC();
      this.lastAutosaveSignature = signature;
      this.saveStepFour();
    }, 5000);
  }

  private buildAutosaveSignature(): string {
    return JSON.stringify({
      projectId: this.projectId,
      indexSheet: this.indexSheet,
      dataArrayEC: this.dataArrayEC,
    });
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
    // Sum across ALL sections from this.ECDP (the full project dataset),
    // not just dataArrayEC (which is the current section only).
    const sum = (this.ECDP || [])
      .reduce((acc, item) => acc + (parseFloat(item.quantity) || 0), 0);
    this.energyTotalService.setEndLifeTotal(sum);
  }

  ngAfterViewInit(): void {
    this.listDataReady = true;
    if (this.pendingSection) {
      this.selectSheetInUI(this.pendingSection);
    }
  }

  selectSheetInUI(section: string | { name_section: string }): void {
    const name = typeof section === 'string' ? section : section.name_section,
          opt = this.sheetsList?.options?.toArray() ?? [],
          matchingOption = opt.find(o => o.value === name);

    if (matchingOption) {
      // Prevent ExpressionChangedAfterItHasBeenCheckedError by delaying update
      setTimeout(() => {
        this.sheetsList.selectedOptions.clear();
        this.sheetsList.selectedOptions.select(matchingOption);
        this.onGroupsChange([matchingOption]); // simulate user click
      });
    } else {
      console.warn('Sheet option not found:', name);
    }
  }

  onGroupsChange(options: MatListOption[]) {
    /*let selectedSheet;
    // map these MatListOptions to their values
    options.map(option => {
      selectedSheet = option.value;
    });
    // take index of selection
    this.indexSheet = this.sheetNames.indexOf(selectedSheet);

    // map data exist to edit
    const getDataECPD = [];

    this.ECDP.map((item: any) => {
      const prevData = [];
      if (item.section_id === this.indexSheet + 1) {
        prevData['id'] = item.id;
        prevData['cantidad'] = item.quantity;
        prevData['fuente'] = item.source_information_id;
        prevData['unidad'] = item.unit_id;
        getDataECPD.push(prevData);
      }
    });

    let i;
    for (i = 0; i <= this.sheetNames.length; i++) {
      if (this.indexSheet === i) {
        this.dataArrayEC = getDataECPD;

        if (this.EC !== undefined) {
          this.dataArrayEC = this.EC[i];
        }

        if (this.dataArrayEC === undefined) {
          this.dataArrayEC = getDataECPD;
        }
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

    this.onSaveECNatural();
    this.procesoSeleccionado = selectedSheet;
    */
   this.selectedSheet = options[0]?.value;
    this.procesoSeleccionado = this.selectedSheet;
    if (!this.selectedSheet) {
      console.warn('No hay grupo seleccionado');
      return;
    }

    // Find the index of selected sheet
    this.indexSheet = this.sheetNames.indexOf(this.selectedSheet);

    // Defensive check
    if (this.indexSheet < 0) {
      console.warn('El grupo seleccionado no existe');
      return;
    }

    const getDataECPD = this.ECDP
      .filter(item => item.section_id === this.indexSheet + 1)
      .map(item => {
        const quantity = this.parseQuantity(item.quantity);
        return {
          id: item.id,
          cantidad: item.quantity,
          fuente: item.source_information_id,
          unidad: item.unit_id,
          _signature: quantity === null
            ? null
            : JSON.stringify({
              quantity,
              fuente: item.source_information_id,
              unidad: item.unit_id,
              section: item.section_id
            })
        };
      });
   // Assign data arrays if available
    if (this.indexSheet >= 0 && this.indexSheet < this.sheetNames.length) {
      this.dataArrayEC = this.EC?.[this.indexSheet] ?? getDataECPD;
    }
    if (!this.dataArrayEC || this.dataArrayEC.length === 0) {
      this.addFormEC();
    }

    //Load Save
    this.onSaveECNatural();
  }

  removeFormEC(i, id) {
    this.endLifeService.deleteECDP(id).subscribe(() => {
      console.log(`Se eliminó ${id}`);
    });
    this.dataArrayEC.splice(i, 1);
  }

  addFormEC() {
    if (this.dataArrayEC === undefined) {
      this.dataArrayEC = [];
    }
    this.dataArrayEC.push([]);
  }

  onSaveECNatural() {
    let i;
    if (this.EC === undefined) {
      this.EC = [];
    }
    /*if (this.TD === undefined) {
      this.TD = [];
    }*/
    for (i = 0; i <= this.sheetNames.length; i++) {
      if (this.indexSheet === i) {
        this.EC[i] = this.dataArrayEC;
        // this.TD[i] = this.dataArrayTD;
      }
    }
  }

  private parseQuantity(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const normalized = String(value).replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  onSaveEC() {
    let i;
    if (this.EC === undefined) {
      this.EC = [];
    }
    /*if (this.TD === undefined) {
      this.TD = [];
    }*/
    for (i = 0; i <= this.sheetNames.length; i++) {
      if (this.indexSheet === i) {
        this.EC[i] = this.dataArrayEC;
        // this.TD[i] = this.dataArrayTD;
      }
    }

    Object.entries(this.EC).forEach(([key, ec]) => {
      const ecAny: any = ec;
      if (this.indexSheet === parseInt(key)) {
        ecAny.map(data => {
          const quantity = this.parseQuantity(data?.cantidad);
          if (quantity === null || !data?.fuente || !data?.unidad) {
            return;
          }
          const signature = JSON.stringify({
            quantity,
            fuente: data.fuente,
            unidad: data.unidad,
            section: parseInt(key, 10) + 1
          });
          if (data._signature === signature || data._pendingSave) {
            return;
          }

          data._pendingSave = true;
          data._signature = signature;

          if (data.id !== undefined) {
            this.endLifeService.deleteECDP(data.id).subscribe({
              next: () => {
                console.log(`Se eliminó ${data.id}`);
              },
              error: () => {
                // Ignore missing rows; we'll re-create below.
              }
            });
          }
          try {
            this.endLifeService
              .addECDP({
                quantity,
                unit_id: data.unidad,
                source_information_id: data.fuente,
                section_id: parseInt(key, 10) + 1,
                project_id: parseInt(
                  localStorage.getItem('idProyectoConstrucción') ?? '',
                  10
                ),
              })
              .pipe(finalize(() => {
                data._pendingSave = false;
              }))
              .subscribe(result => {
                data.id = result?.id ?? data.id;
                data._signature = signature;
                console.log(result);
              }, () => {
                data._pendingSave = false;
              });
          } catch (e) {
            console.log('No hay que eliminar***', e);
            data._pendingSave = false;
          }
        });
      }
    });
  }

  saveStepFour() {}

  goToMaterialStage() {
    this.materialsService.getMaterialSchemeProyects().subscribe(msp => {
      const schemaFilter = msp.filter(
        schema =>
          schema.project_id ==
          localStorage.getItem('idProyectoConstrucción')
      );
      if (schemaFilter.length === 0) {
        this.router.navigateByUrl('materials-stage');
      } else {
        this.router.navigateByUrl('materials-stage/update');
      }
    });
  }

  goToConstructionStage() {
    const projectId = parseInt(
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
      console.log(schemaFilter);

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
        schema =>
          schema.project_id ==
          localStorage.getItem('idProyectoConstrucción')
      );

      if (schemaFilter.length === 0) {
        this.router.navigateByUrl('usage-stage');
      } else {
        this.router.navigateByUrl('usage-stage/update');
      }
    });
  }

  goToEndLife() {
    this.router.navigateByUrl('end-life-stage');
  }

  continueStep(event: Event) {
    console.log('continuar!!!!');
    event.preventDefault();
    this.router.navigateByUrl('/');
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
