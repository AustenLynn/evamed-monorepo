import { Component, OnInit, AfterViewInit, ViewChild, ChangeDetectorRef } from '@angular/core';
import { MatListOption } from '@angular/material/list';
import { MaterialsService } from './../../../core/services/materials/materials.service';
import { ProjectsService } from './../../../core/services/projects/projects.service';
import { SelectionService } from '../../../core/services/selection/selection.service';
import { MatSelectionList } from '@angular/material/list';
import { Router } from '@angular/router';
import { CatalogsService } from 'src/app/core/services/catalogs/catalogs.service';
import { UntypedFormControl } from '@angular/forms';
import { forkJoin, Observable } from 'rxjs';
import { map, startWith, take } from 'rxjs/operators';
import { AnalisisService } from 'src/app/core/services/analisis/analisis.service';

export interface Material {
  id: number;
  name_material: string;
  unit_id: number;
}

@Component({
    selector: 'app-material-stage-update',
    templateUrl: './material-stage-update.component.html',
    styleUrls: ['./material-stage-update.component.scss'],
    standalone: false
})
export class MaterialStageUpdateComponent implements OnInit, AfterViewInit {
  selectedSheet: any;
  sheetNames: any;
  contentData: any;
  listData2: any[] = [];
  indexSheet: number;
  pendingSection: string | { name_section: string } | null = null;
  listDataReady = false;
  ListSCRevit: any;
  ListSCDynamo: any;
  ListSCUsuario: any;
  listMateriales: any;
  selectedOptionsRevit: string[] = [];
  selectedOptionsDynamo: string[] = [];
  selectedOptionsUsuario: string[] = [];
  selectedSystems: { [key: string]: boolean } = {}; // Track selected systems: "originId:systemName" -> true/false
  deleteMode = false;
  rowsMarkedForDelete: { [key: string]: boolean } = {};
  panelOpenFirst = false;
  panelOpenSecond = false;
  panelOpenThird = false;
  allMaterials = [];
  nameProject: string;
  projectId: number;
  SOR = [];
  SOD = [];
  SOU = [];
  IMGP = [];
  sectionRevit: boolean;
  sectionDynamo: boolean;
  selectedMaterial: boolean;
  dataMaterialSelected: any;
  showSearch: boolean;
  catalogoTransportesExtrangero: any;
  catalogoPaises: any;
  catalogoCiudades: any;
  catalogoEstados: any;
  catalogoTransportesLocal: any;
  vidaUtilSeleccionado: any;
  vidaUtilSeleccionadoId: any;
  dataProject: any;
  materialsList: any;
  showEPD: boolean;
  EPDS: any;
  showMaterial: boolean;
  showListMaterials: boolean;
  shouldShowMaterials: boolean;
  showMexican: boolean;
  showListEPIC: boolean;
  EPiC: any;
  mexicaniuh: any;
  description_material_selected: any;
  SCseleccionado = '';
  currentPanelItem = '';

  myControl = new UntypedFormControl();
  options: Material[];
  filteredOptions: Observable<Material[]>;

  displayedColumns: string[] = ['Standard', 'Potencial', 'Valor', 'Unidad'];
  private selectionIdByKey: { [key: string]: number } = {};

  constructor(
    private materialsService: MaterialsService,
    private projectsService: ProjectsService,
    private catalogsService: CatalogsService,
    private analisis: AnalisisService,
    private router: Router,
    private selectionService: SelectionService,
    private cdr: ChangeDetectorRef,
  ) {
    this.materialsService.getMaterials().subscribe(data => {
      this.materialsList = data;
      this.options = this.materialsList;
      const EPDS = data.filter(res => res.database_from === 'EPDs'),
       EPIC = data.filter(res => res.database_from === 'EPiC'),
       mexicaniuh = data.filter(
        res => res.database_from === 'mexicaniuh'
      );
      this.EPDS = EPDS.sort((a, b) =>
        a.name_material > b.name_material ? 1 : -1
      );
      this.EPiC = EPIC.sort((a, b) =>
        a.name_material > b.name_material ? 1 : -1
      );
      this.mexicaniuh = mexicaniuh.sort((a, b) =>
        a.name_material > b.name_material ? 1 : -1
      );
    });

    this.catalogsService.countriesCatalog().subscribe(data => {
      this.catalogoPaises = data;
    });
    this.catalogsService.getStates().subscribe(data => {
      this.catalogoEstados = data;
    });
    this.catalogsService.getTransports().subscribe(data => {
      this.catalogoTransportesLocal = data;
      this.catalogoTransportesExtrangero = data;
    });

    this.projectsService
      .getProjectById(localStorage.getItem('idProyectoConstrucción'))
      .subscribe((data: any) => {
        this.nameProject = data.name_project;
        this.catalogsService.usefulLifeCatalog().subscribe(distances => {
          distances.map(distance => {
            console.log(data.useful_life_id);
            if (data.useful_life_id === distance.id) {
              this.vidaUtilSeleccionado = parseInt(distance.name_useful_life);
              this.vidaUtilSeleccionadoId = parseInt(distance.id);
            }
          });
        });
      });
  }

  @ViewChild('sheets') sheetsList!: MatSelectionList;

  ngOnInit(): void {
    //carga de imagenes
    const images = [
      '../../../../assets/map/2.jpg',
      '../../../../assets/map/4.jpg',
      '../../../../assets/map/5.jpg',
      '../../../../assets/map/6.jpg',
      '../../../../assets/map/7.jpg',
      '../../../../assets/map/8.jpg',
      '../../../../assets/map/9.jpg',
      '../../../../assets/map/10.jpg',
      '../../../../assets/map/11.jpg',
      '../../../../assets/map/12.jpg',
      '../../../../assets/map/13.jpg',
      '../../../../assets/map/14.jpg',
    ];
    this.preload(images);

    // fragmento para autocompletado
    this.filteredOptions = this.myControl.valueChanges.pipe(
      startWith(''),
      map(value => (typeof value === 'string' ? value : value.name)),
      map(name => (name ? this._filter(name) : this.options.slice()))
    );

    this.selectedMaterial = false;
    this.showEPD = false;
    this.showMexican = false;
    this.showListEPIC = false;
    this.showListMaterials = true;

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

    this.projectsService.getMaterialSchemeProyect().subscribe(data => {
      const projectId = parseInt(localStorage.getItem('idProyectoConstrucción') ?? '', 10);
      this.listData2 = data.filter(item => item.project_id === projectId);

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

    this.showSearch = false;
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
        //this.cdr.detectChanges(); // manually trigger change detection
      });
    } else {
      console.warn('Sheet option not found:', name);
    }
  }

  // Lógica para autocompletado
  displayFn(material: Material): string {
    return material && material.name_material ? material.name_material : '';
  }

  private _filter(name: string): Material[] {
    const filterValue = name.toLowerCase();

    return this.options.filter(
      option => option.name_material.toLowerCase().indexOf(filterValue) === 0
    );
  }

  preload(array) {
    for (let i = 0; i < array.length; i++) {
      this.IMGP[i] = new Image();
      this.IMGP[i].src = array[i];
    }
  }

  onGroupsChange(input: MatListOption[] | string | { id: number, name_section: string }): void {
    // Determine selected sheet name
    if (typeof input === 'string') {
      this.selectedSheet = input;
    } else if (Array.isArray(input)) {
      this.selectedSheet = input[0]?.value ?? null;
    } else if (typeof input === 'object' && input !== null && 'name_section' in input) {
      this.selectedSheet = input.name_section;
    }

    if (!this.selectedSheet) {
      console.warn('No sheet selected');
      return;
    }

    // Get index of selected sheet
    this.indexSheet = this.sheetNames.indexOf(this.selectedSheet);
    if (this.indexSheet < 0) {
      console.warn('Selected sheet not found in sheetNames');
      return;
    }

    // Reset UI panels
    this.clearMaterialsPanel();
    this.shouldShowMaterials = false;

    // Delay updates to avoid ExpressionChangedAfterItHasBeenCheckedError
    setTimeout(() => {
      // Show materials panel after reset
      this.shouldShowMaterials = true;
      // Filter construction systems
      const ListGetSCRevit: string[] = [],
            ListGetSCDimano: string[] = [];
      if (Array.isArray(this.listData2)) {
        this.listData2.forEach(item => {
          const sectionMatch = this.indexSheet + 1 === item.section_id;

          if (item.origin_id === 1 && sectionMatch) {
            ListGetSCRevit.push(item.construction_system);
          }
          if (item.origin_id === 2 && sectionMatch) {
            ListGetSCDimano.push(item.construction_system);
          }
        });
      }

      this.ListSCRevit = [...new Set(ListGetSCRevit)];
      this.ListSCDynamo = [...new Set(ListGetSCDimano)];

      // Assign saved selections if available
      this.selectedOptionsRevit = this.SOR?.[this.indexSheet] ?? [];
      this.selectedOptionsDynamo = this.SOD?.[this.indexSheet] ?? [];
      //this.selectedOptionsUsuario = this.SOU?.[this.indexSheet] ?? [];

      this.syncSelectionsForCurrentSheet();

      this.cdr.detectChanges();
    });
  }

  private buildSelectionKey(sectionId: number, originId: number, label: string): string {
    return `${sectionId}|${originId}|${label}`;
  }

  private syncSelectionsForCurrentSheet() {
    const projectId = parseInt(localStorage.getItem('idProyectoConstrucción') ?? '', 10);
    if (!Number.isFinite(projectId) || this.indexSheet === undefined) {
      return;
    }

    const sectionId = this.indexSheet + 1;
    const toItems = (values: string[], originId: number) =>
      values.map(label => ({
        section_id: sectionId,
        origin_id: originId,
        label,
      }));

    const options = [
      ...toItems(this.ListSCRevit || [], 1),
      ...toItems(this.ListSCDynamo || [], 2),
    ];

    if (options.length === 0) {
      return;
    }

    this.materialsService
      .upsertMaterialsStageSelections({
        project_id: projectId,
        items: options,
      })
      .subscribe({
        next: () => {
        this.materialsService
          .getMaterialsStageSelections(projectId, sectionId)
          .subscribe({
            next: response => {
            const items = response?.items || [];
            this.selectionIdByKey = {
              ...this.selectionIdByKey,
              ...items.reduce((acc, item) => {
                const originId = item.origin_id ?? 0;
                acc[this.buildSelectionKey(sectionId, originId, item.label)] = item.id;
                return acc;
              }, {}),
            };

            this.selectedOptionsRevit = items
              .filter(item => item.origin_id === 1 && item.is_selected)
              .map(item => item.label);
            this.selectedOptionsDynamo = items
              .filter(item => item.origin_id === 2 && item.is_selected)
              .map(item => item.label);

            // Populate selectedSystems object for toggle switch display binding
            items.forEach(item => {
              if (item.is_selected) {
                const key = `${item.origin_id}:${item.label}`;
                this.selectedSystems[key] = true;
              } else {
                const key = `${item.origin_id}:${item.label}`;
                this.selectedSystems[key] = false;
              }
            });

            this.SOR[this.indexSheet] = this.selectedOptionsRevit;
            this.SOD[this.indexSheet] = this.selectedOptionsDynamo;
            },
            error: () => {},
          });
        },
        error: () => {},
      });
  }

  onNgModelChangeRevit() {
    let i;
    for (i = 0; i <= this.sheetNames.length; i++) {
      if (this.indexSheet === i) {
        this.SOR[i] = this.selectedOptionsRevit;
      }
    }
  }

  onNgModelChangeDynamo() {
    let i;
    for (i = 0; i <= this.sheetNames.length; i++) {
      if (this.indexSheet === i) {
        this.SOD[i] = this.selectedOptionsDynamo;
      }
    }
  }

  onNgModelChangeUser() {
    //  let i;
    //  for ( i = 0; i <= this.sheetNames.length; i++ ) {
    //    this.indexSheet === i ? this.SOU[i] = this.selectedOptionsUsuario : this.SOU[i];
    //  }
  }

  onNgModelChangeMaterial() {
    // console.log(this.selectedMaterial);
  }

  onSCSelected(event, originId: number) {
    const selectedItem = event.options[0]?.value,
          isSelected = event.options[0]?.selected,
          projectId = parseInt(localStorage.getItem('idProyectoConstrucción') ?? '', 10);

    if (!selectedItem || this.indexSheet === undefined || !Number.isFinite(projectId)) {
      return;
    }

    const sectionId = this.indexSheet + 1;
    const key = this.buildSelectionKey(sectionId, originId, selectedItem);
    const selectionId = this.selectionIdByKey[key];

    const rollback = () => {
      // Update local tracking state
      const systemKey = `${originId}:${selectedItem}`;
      this.selectedSystems[systemKey] = !isSelected;
    };

    if (selectionId) {
      this.materialsService
        .updateMaterialsStageSelections({
          project_id: projectId,
          items: [
            {
              sistemaConstructivoId: selectionId,
              is_selected: isSelected,
            },
          ],
        })
        .subscribe({
          error: () => rollback(),
        });
      return;
    }

    this.materialsService
      .upsertMaterialsStageSelections({
        project_id: projectId,
        items: [
          {
            section_id: sectionId,
            origin_id: originId,
            label: selectedItem,
            is_selected: isSelected,
          },
        ],
      })
      .subscribe({
        next: response => {
          const created = response?.items?.[0];
          if (created?.id) {
            this.selectionIdByKey[key] = created.id;
          }
        },
        error: () => rollback(),
      });
  }

  private clearMaterialsPanel(): void {
    this.currentPanelItem = '';
    this.SCseleccionado = '';
    this.selectedMaterial = false;
    this.showSearch = false;
    this.showMaterial = false;
    this.listMateriales = {};
  }

  onSystemLabelClick(event: Event, sc: string, origin: string): void {
    event.stopPropagation();
    this.showMaterials(null, sc, origin);
  }

  isActiveSystemLabel(sc: string): boolean {
    return this.currentPanelItem === sc;
  }

  isSystemSelected(sc: string, originId: number): boolean {
    const key = `${originId}:${sc}`;
    return this.selectedSystems[key] || false;
  }

  isRowMarkedForDelete(sc: string, originId: number): boolean {
    const key = `${originId}:${sc}`;
    return this.rowsMarkedForDelete[key] || false;
  }

  toggleDeleteMode(): void {
    this.deleteMode = !this.deleteMode;
    if (!this.deleteMode) {
      this.rowsMarkedForDelete = {};
    }
  }

  onDeleteSelectionChange(checked: boolean, sc: string, originId: number): void {
    const key = `${originId}:${sc}`;
    this.rowsMarkedForDelete[key] = checked;
  }

  handleSystemAction(): void {
    if (!this.deleteMode) {
      this.toggleDeleteMode();
      return;
    }

    const systemsToDelete = this.getMarkedSystemsForDelete();
    if (systemsToDelete.length === 0) {
      this.toggleDeleteMode();
      return;
    }

    this.deleteSelectedSystems(systemsToDelete);
  }

  private getMarkedSystemsForDelete(): Array<{ label: string; originId: number }> {
    return Object.entries(this.rowsMarkedForDelete)
      .filter(([, checked]) => checked)
      .map(([key]) => {
        const separatorIndex = key.indexOf(':');
        return {
          originId: parseInt(key.slice(0, separatorIndex), 10),
          label: key.slice(separatorIndex + 1),
        };
      });
  }

  private deleteSelectedSystems(
    systemsToDelete: Array<{ label: string; originId: number }>
  ): void {
    const projectId = parseInt(localStorage.getItem('idProyectoConstrucción') ?? '', 10);
    if (!Number.isFinite(projectId) || this.indexSheet === undefined) {
      return;
    }

    const sectionId = this.indexSheet + 1;
    const requests = [];

    systemsToDelete.forEach(({ label, originId }) => {
      const selectionKey = this.buildSelectionKey(sectionId, originId, label);
      const selectionId = this.selectionIdByKey[selectionKey];
      if (selectionId) {
        requests.push(
          this.materialsService.updateMaterialsStageSelections({
            project_id: projectId,
            items: [
              {
                sistemaConstructivoId: selectionId,
                is_selected: false,
              },
            ],
          })
        );
      }

      (this.listData2 ?? [])
        .filter(
          item =>
            Number(item.project_id) === projectId &&
            Number(item.section_id) === sectionId &&
            Number(item.origin_id) === originId &&
            item.construction_system === label
        )
        .forEach(item => {
          requests.push(this.projectsService.deleteSchemeProject(item.id));
        });
    });

    if (requests.length === 0) {
      this.toggleDeleteMode();
      return;
    }

    forkJoin(requests).subscribe({
      next: () => {
        this.listData2 = (this.listData2 ?? []).filter(item => {
          return !systemsToDelete.some(
            system =>
              Number(item.section_id) === sectionId &&
              Number(item.origin_id) === system.originId &&
              item.construction_system === system.label
          );
        });

        this.finalizeDeletedSystems(systemsToDelete, sectionId);
      },
      error: error => {
        console.error('No se pudieron eliminar los sistemas constructivos', error);
      },
    });
  }

  private finalizeDeletedSystems(
    systemsToDelete: Array<{ label: string; originId: number }>,
    sectionId: number
  ): void {
    systemsToDelete.forEach(({ label, originId }) => {
      delete this.rowsMarkedForDelete[`${originId}:${label}`];
      delete this.selectedSystems[`${originId}:${label}`];
      delete this.selectionIdByKey[this.buildSelectionKey(sectionId, originId, label)];

      if (originId === 1) {
        this.selectedOptionsRevit = this.selectedOptionsRevit.filter(item => item !== label);
      }
      if (originId === 2) {
        this.selectedOptionsDynamo = this.selectedOptionsDynamo.filter(item => item !== label);
      }
      if (originId === 3) {
        this.selectedOptionsUsuario = this.selectedOptionsUsuario.filter(item => item !== label);
      }

      if (this.currentPanelItem === label) {
        this.clearMaterialsPanel();
      }
    });

    this.SOR[this.indexSheet] = this.selectedOptionsRevit;
    this.SOD[this.indexSheet] = this.selectedOptionsDynamo;
    this.SOU[this.indexSheet] = this.selectedOptionsUsuario;
    this.deleteMode = false;
    this.rowsMarkedForDelete = {};

    this.onGroupsChange(this.selectedSheet);
  }

  onToggleSystemSelection(event: any, sc: string, originId: number): void {
    const key = `${originId}:${sc}`;
    // Get the new state from the mat-slide-toggle change event
    const newSelectedState = event.checked || false;
    
    // Update local state
    this.selectedSystems[key] = newSelectedState;
    
    // Call the original onSCSelected logic with synthetic event
    const syntheticEvent = {
      options: [{
        value: sc,
        selected: newSelectedState
      }]
    } as any;
    
    this.onSCSelected(syntheticEvent, originId);
  }

  updateStepOne() {
    //Lógica de editar
    console.log('editar------------------');
    console.log(this.listData2);
    this.listData2.map(item => console.log(item));
  }

  trunc(x, posiciones = 0) {
    const s = x.toString(),
    //var l = s.length;
      decimalLength = s.indexOf('.') + 1,
      numStr = s.substr(0, decimalLength + posiciones);
    return Number(numStr);
  }

  showMaterials(event, sc, origin) {
    event?.stopPropagation();
    this.currentPanelItem = sc;
    this.SCseleccionado = '/ ' + sc;
    this.selectedMaterial = false;
    this.showSearch = false;
    this.showMaterial = false;
    // let originId = 1;
    // origin === 'revit-user' ? originId = 1 : originId = 2;
    const listMateriales = [];
    let counterRevit = 1,
     countDynamo = 1;

    this.listData2.map(item => {
      const prevData = [];
      if (item.construction_system === sc && origin === 'revit-user') {
        if (item.origin_id === 1 || item.origin_id === 3) {
          this.materialsService
            .searchMaterial(item.material_id)
            .subscribe(material => {
              material.map(materialData => {
                if (
                  item.material_id === materialData.id &&
                  item.section_id === this.indexSheet + 1
                ) {
                  console.log('Material Data');
                  // console.log(materialData);
                  console.log(item);
                  prevData['comercial_name'] = item.comercial_name;
                  prevData['name_material'] = materialData.name_material;
                  prevData['quantity'] = this.trunc(item.quantity, 2);
                  prevData['origin_id'] = item.origin_id;
                  prevData['material_id'] = item.material_id;
                  prevData['reemplazos'] = item.replaces;
                  prevData['transport_id_end'] = item.transport_id_end;
                  prevData['transport_id_origin'] = item.transport_id_origin;
                  prevData['vidaUtil'] = this.vidaUtilSeleccionado;
                  prevData['unit_text'] = item.unit_text;
                  prevData['description_material'] = item.description_material;
                  prevData['material_scheme_project_id'] = item.id;
                  prevData['construction_system'] = item.construction_system;
                  prevData['project_id'] = item.project_id;
                  prevData['section_id'] = item.section_id;
                  prevData['city_id_origin'] = item.city_id_origin;
                  prevData['city_id_end'] = item.city_id_end;
                  prevData['state_id_origin'] = item.state_id_origin;
                  prevData['transporte_1'] = item.transport_id_origin;
                  prevData['transporte_2'] = item.transport_id_end;
                  prevData['distancia_1'] = parseInt(item.distance_init);
                  prevData['distancia_2'] = parseInt(item.distance_end);
                  prevData['key'] = counterRevit++;
                  listMateriales.push(prevData);
                }
              });
            });
        }
      }
      if (item.construction_system === sc && origin === 'dynamo') {
        if (item.origin_id === 2) {
          this.materialsService
            .searchMaterial(item.material_id)
            .subscribe(material => {
              material.map(materialData => {
                if (
                  item.material_id === materialData.id &&
                  item.section_id === this.indexSheet + 1
                ) {
                  console.log('Material Data');
                  // console.log(materialData);
                  console.log(item);
                  prevData['comercial_name'] = item.comercial_name;
                  prevData['name_material'] = materialData.name_material;
                  prevData['quantity'] = this.trunc(item.quantity, 2);
                  prevData['origin_id'] = item.origin_id;
                  prevData['material_id'] = item.material_id;
                  prevData['reemplazos'] = item.replaces;
                  prevData['transport_id_end'] = item.transport_id_end;
                  prevData['transport_id_origin'] = item.transport_id_origin;
                  prevData['vidaUtil'] = this.vidaUtilSeleccionado;
                  prevData['unit_text'] = item.unit_text;
                  prevData['description_material'] = item.description_material;
                  prevData['material_scheme_project_id'] = item.id;
                  prevData['construction_system'] = item.construction_system;
                  prevData['project_id'] = item.project_id;
                  prevData['section_id'] = item.section_id;
                  prevData['city_id_end'] = item.city_id_end;
                  prevData['city_id_origin'] = item.city_id_origin;
                  prevData['state_id_origin'] = item.state_id_origin;
                  prevData['transporte_1'] = item.transport_id_origin;
                  prevData['transporte_2'] = item.transport_id_end;
                  prevData['distancia_1'] = parseInt(item.distance_init);
                  prevData['distancia_2'] = parseInt(item.distancia_end);
                  prevData['key'] = countDynamo++;

                  listMateriales.push(prevData);
                }
              });
            });
        }
      }
    });
    // Asign list materials
    this.listMateriales = listMateriales;
  }

  updateMaterialSelected(dataMaterialSelected) {
    console.log('información a actualizar!!!');

    this.materialsService
      .searchMaterial(dataMaterialSelected.materialSelectedDB)
      .subscribe(material => {
        material.map(materialData => {
          if (
            materialData.name_material ===
            dataMaterialSelected.materialSelectedDB
          ) {
            console.log('IF DEFINITIVO!!!!');
            console.log(dataMaterialSelected);
            console.log(materialData);
            this.projectsService
              .updateMaterialSchemeProject(
                dataMaterialSelected.material_scheme_project_id,
                {
                  comercial_name: dataMaterialSelected.comercial_name,
                  construction_system: dataMaterialSelected.construction_system, // en duro
                  provider_distance: 0,
                  quantity: dataMaterialSelected.quantity,
                  value: null,
                  distance_init: parseInt(dataMaterialSelected.distancia_1, 10),
                  distance_end: parseInt(dataMaterialSelected.distancia_2, 10),
                  replaces: dataMaterialSelected.reemplazos,
                  unit_text: dataMaterialSelected.unit_text,
                  description_material:
                    dataMaterialSelected.description_material,
                  material_id: materialData.id,
                  project_id: dataMaterialSelected.project_id,
                  origin_id: parseInt(dataMaterialSelected.origin_id),
                  section_id: dataMaterialSelected.section_id,
                  state_id_origin: dataMaterialSelected.state_id_origin,
                  city_id_origin: 2,
                  city_id_end: 1,
                  transport_id_origin: parseInt(
                    dataMaterialSelected.transporte_1
                  ),
                  transport_id_end: parseInt(dataMaterialSelected.transporte_2),
                }
              )
              .subscribe(data => {
                console.log(
                  'Update data-----------------------------------------------'
                );
                console.log(data);
                this.ngOnInit();
              });
          }
        });
      });
  }

  removeMaterial(event) {
    event.stopPropagation();
    console.log('entra a remove materials');
  }

  restoreMaterial(event) {
    event.stopPropagation();
    console.log('entra a restore material');
  }

  duplicateMaterial(event, sc: string, origin: string) {
    event.stopPropagation();
    const originIdMap = { 'revit-user': [1, 3], 'dynamo': [2], 'user': [3] };
    const allowedOrigins = originIdMap[origin] ?? [];
    const toDuplicate = this.listData2.filter(
      item => item.construction_system === sc &&
              item.section_id === this.indexSheet + 1 &&
              allowedOrigins.includes(item.origin_id)
    );
    toDuplicate.forEach(item => {
      this.projectsService.addSchemeProject({
        comercial_name: item.comercial_name,
        construction_system: item.construction_system,
        provider_distance: 0,
        quantity: item.quantity,
        value: null,
        distance_init: item.distance_init || 0,
        distance_end: item.distance_end || 0,
        replaces: item.replaces,
        unit_text: item.unit_text,
        description_material: item.description_material,
        material_id: item.material_id,
        project_id: item.project_id,
        origin_id: item.origin_id,
        section_id: item.section_id,
        state_id_origin: item.state_id_origin,
        city_id_origin: item.city_id_origin || 2,
        city_id_end: item.city_id_end || 1,
        transport_id_origin: item.transport_id_origin || null,
        transport_id_end: item.transport_id_end || null,
      }).subscribe(() => {
        this.ngOnInit();
      });
    });
  }

  onSelectedMaterial(event, value) {
    this.selectState(value.selected[0]?.value.value.state_id_origin);
    this.dataMaterialSelected = value.selected[0]?.value.value;
    this.dataMaterialSelected.materialSelectedDB =
      this.dataMaterialSelected.name_material;
    this.selectedMaterial = true;
  }

  selectCountry(id) {
    this.catalogsService.getExternalDistances().subscribe(data => {
      data.map(item => {
        let typeTransport = 'mar';
        if (id === item.id + 1) {
          switch (item.region) {
            case 'PACIFICO' || 'ATLANTICO':
              typeTransport = 'mar';
              break;
            case 'NORTE' || 'SUR':
              typeTransport = 'terreste';
              break;
            default:
              break;
          }

          this.catalogoTransportesExtrangero = [];
          if (typeTransport === 'terreste') {
            this.catalogsService.getTransports().subscribe(data => {
              data.map(item => {
                if (item.id >= 3) {
                  this.catalogoTransportesExtrangero.push(item);
                }
              });
            });
          } else {
            this.catalogsService.getTransports().subscribe(data => {
              data.map(item => {
                if (item.id < 3) {
                  this.catalogoTransportesExtrangero.push(item);
                }
              });
            });
          }
        }
      });
    });
  }

  selectState(id) {
    this.catalogoCiudades = [];
    this.catalogsService.getCities().subscribe(data => {
      data.map(item => {
        if (item.state_id === id) {
          this.catalogoCiudades.push(item);
        }
      });
    });
  }

  showDetailEPD(event, material) {
    console.log('Show------------------------------');
    event.stopPropagation();
    this.showEPD = true;
    this.dataMaterialSelected.name = material.name_material;
    this.dataMaterialSelected.id = material.id;
    this.dataMaterialSelected.description = material.decription;
    this.dataMaterialSelected.AllData = material;
    this.analisis.getMaterialSchemeData().subscribe(msds => {
      let msd = msds.filter(msd => msd.material_id === material.id);
      msd = msd.sort((a, b) => {
        if (a.potential_type_id === b.potential_type_id) {
          return a.standard_id - b.standard_id;
        }
        return a.potential_type_id > b.potential_type_id ? 1 : -1;
      });
      this.dataMaterialSelected.msd = msd;
    });
  }

  changeReplaces(vidaUtil) {
    let replaces = 0;
    replaces = parseInt(this.vidaUtilSeleccionado, 10) / parseInt(vidaUtil, 10);
    this.dataMaterialSelected.reemplazos = Math.ceil(replaces) - 1;
  }

  changeLifeTime(reemplazos) {
    let lifeTime = this.vidaUtilSeleccionado;
    lifeTime =
      parseInt(this.vidaUtilSeleccionado, 10) / (parseInt(reemplazos, 10) + 1);
    this.dataMaterialSelected.vidaUtil = lifeTime;
  }

  onReturnListMaterials() {
    this.selectedMaterial = false;
    this.showSearch = false;
    this.showMaterial = false;
  }

  returnMaterialData() {
    if (this.dataMaterialSelected.materialDB !== undefined) {
      this.dataMaterialSelected.materialSelectedDB =
        this.dataMaterialSelected.materialDB.name_material;
    }
    this.selectedMaterial = true;
    this.showSearch = false;
  }

  addElement() {
    console.log('add element');
  }

  addSC() {
    console.log('add SC');
  }

  goToSearchInfo() {
    this.showSearch = true;
    this.selectedMaterial = false;
    this.showMaterial = false;
    this.showEPD = false;
  }

  returnListEpds() {
    this.showEPD = false;
  }

  onSelectMaterial(event, material) {
    event.stopPropagation();
    console.log('onselected material');
    this.dataMaterialSelected.materialSelectedDB = material;
    if (this.dataMaterialSelected.materialFiltrado !== undefined) {
      this.dataMaterialSelected.materialFiltrado = undefined;
    }
    console.log(this.dataMaterialSelected.materialSelectedDB);
    this.returnMaterialData();
  }

  showDetailMaterial(event, material) {
    event.stopPropagation();
    this.showListEPIC = false;
    this.showMaterial = true;
    this.dataMaterialSelected.name = material.name_material;
    this.dataMaterialSelected.description = material.description;
    this.dataMaterialSelected.registrationNumber = 'S-P-01927';
    this.dataMaterialSelected.publicationDate = '202-04-01';
    this.dataMaterialSelected.utilLife = '2025-04-01';

    this.analisis.getMaterialSchemeData().subscribe(msds => {
      let msd = msds.filter(msd => msd.material_id === material.id);
      msd = msd.sort((a, b) => {
        if (a.potential_type_id === b.potential_type_id) {
          return a.standard_id - b.standard_id;
        }
        return a.potential_type_id > b.potential_type_id ? 1 : -1;
      });
      this.dataMaterialSelected.msd = msd;
    });
  }

  showEPIC() {
    this.showListMaterials = false;
    this.showListEPIC = true;
  }

  showMexicanIuh() {
    this.showListMaterials = false;
    this.showListEPIC = false;
    this.showMexican = true;
  }

  returnDatabaseList() {
    this.showListMaterials = true;
  }

  returnListDB() {
    this.showMaterial = false;
  }

  goToMaterialStage() {
    this.router.navigateByUrl('materials-stage');
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
          schema.project_id == localStorage.getItem('idProyectoConstrucción')
      );

      if (schemaFilter.length === 0) {
        this.router.navigateByUrl('usage-stage');
      } else {
        this.router.navigateByUrl('usage-stage/update');
      }
    });
  }

  goToEndLife() {
    this.materialsService.getEDCP().subscribe(edcp => {
      const schemaFilter = edcp.filter(
        schema =>
          schema.project_id == localStorage.getItem('idProyectoConstrucción')
      );

      if (schemaFilter.length === 0) {
        this.router.navigateByUrl('end-life-stage');
      } else {
        this.router.navigateByUrl('end-life-stage/update');
      }
    });
  }

  continue() {
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

  goToHome() {
    this.router.navigateByUrl('home-evamed');
  }

  goToResultados() {
    sessionStorage.setItem('projectID', localStorage.getItem('idProyectoConstrucción'));
    this.router.navigateByUrl('resultados');
  }
}
