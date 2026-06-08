import { Component, OnInit, OnDestroy } from '@angular/core';
import { MatListOption } from '@angular/material/list';
import { MatSelectionListChange } from '@angular/material/list';
import { MaterialsService } from './../../../core/services/materials/materials.service';
import { ProjectsService } from './../../../core/services/projects/projects.service';
import { Router } from '@angular/router';
import { CatalogsService } from 'src/app/core/services/catalogs/catalogs.service';
import { UntypedFormControl } from '@angular/forms';
import { forkJoin, Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { AddConstructiveElementComponent } from '../add-constructive-element/add-constructive-element.component';
import { AddConstructiveSystemComponent } from '../add-constructive-system/add-constructive-system.component';
import { AddConstructiveMaterialComponent } from '../add-constructive-material/add-constructive-material.component';
import { MatDialog } from '@angular/material/dialog';
import { AnalisisService } from 'src/app/core/services/analisis/analisis.service';

export interface Material {
  id: number;
  name_material: string;
  unit_id: number;
}

@Component({
    selector: 'app-materials-stage',
    templateUrl: './materials-stage.component.html',
    styleUrls: ['./materials-stage.component.scss'],
    standalone: false
})
export class MaterialsStageComponent implements OnInit, OnDestroy {
  selectedSheet: any;
  sheetNames: any;
  contentData: any;
  listData: any;
  indexSheet: number;
  ListSCRevit: any;
  ListSCDynamo: any;
  ListSCUsuario: any;
  listMateriales: any;
  selectedOptionsRevit: string[] = [];
  previousSelectedOptionsRevit: any[] = [];
  selectedOptionsDynamo: string[] = [];
  selectedOptionsUsuario: string[] = [];
  selectedSystems: { [key: string]: boolean } = {}; // Track selected systems: "originId:systemName" -> true/false
  deleteMode = false;
  rowsMarkedForDelete: { [key: string]: boolean } = {};
  panelOpenFirst = true;
  panelOpenSecond = true;
  panelOpenThird = true;
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
  showSearch: boolean;
  showMaterial: boolean;
  shouldShowMaterials: boolean;
  showEPD: boolean;
  dataMaterialSelected: any;
  materialsList: any;
  catalogoPaises: any;
  catalogoEstados: any;
  catalogoCiudades: any;
  catalogoTransportesLocal: any;
  catalogoTransportesExtrangero: any;
  vidaUtilSeleccionado: any;
  ciudadOrigenSeleccionada: any;
  reemplazos: any;
  distanciaInicial: any;
  newConstructiveElement: string;
  newConstructiveSystem: string;
  newConstructiveMaterial: string;
  SCseleccionado = '';
  currentPanelItem = '';
  materialData: any;
  EPDS: Material[] = [];
  EPiC: any;
  mexicaniuh: any;
  showListMaterials: boolean;
  showMexican: boolean;
  materialFiltrado = '';

  myControl = new UntypedFormControl();
  options: Material[];
  filteredOptions: Observable<Material[]>;
  autocompletedMaterial: Material | null = null;
  filteredEPDS: Material[] = [];

  displayedColumns: string[] = ['Standard', 'Potencial', 'Valor', 'Unidad'];
  endSave = false;
  private autosaveIntervalId: ReturnType<typeof setInterval> | null = null;
  private lastAutosaveSignature: string | null = null;
  private selectionIdByKey: { [key: string]: number } = {};

  constructor(
    private materialsService: MaterialsService,
    private projectsService: ProjectsService,
    private router: Router,
    private catalogsService: CatalogsService,
    public dialog: MatDialog,
    private analisis: AnalisisService
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
      // Initialize filteredEPDS here
      this.filteredEPDS = [...this.EPDS];
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
  }

  ngOnInit() {
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

    // Listen for clearing input to reset filteredEPDS
    this.myControl.valueChanges.subscribe(value => {
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        this.autocompletedMaterial = null ;
        this.filterEPDS(); // Reset the full EPD list
      }
    });

    this.selectedMaterial = false;
    this.showSearch = false;
    this.showMaterial = false;
    this.shouldShowMaterials = true;
    this.showEPD = false;
    this.showMexican = false;
    this.showListMaterials = true;

    const PDP = JSON.parse(sessionStorage.getItem('primaryDataProject')),
     data = JSON.parse(sessionStorage.getItem('dataProject'));
    this.ciudadOrigenSeleccionada = PDP.city_id_origin;

    this.catalogsService.usefulLifeCatalog().subscribe(data => {
      data.map(item => {
        if (item.id === PDP.useful_life_id) {
          this.vidaUtilSeleccionado = item.name_useful_life;
        }
      });
    });

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

    this.startAutosave();
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
      if (!this.projectId) {
        console.log('autosave: materials-stage skipped (missing projectId)');
        return;
      }
      const signature = this.buildAutosaveSignature();
      if (signature === this.lastAutosaveSignature) {
        return;
      }

      this.lastAutosaveSignature = signature;
      console.log('autosave: materials-stage');
      this.saveStepOne();
    }, 5000);
  }

  private buildAutosaveSignature(): string {
    return JSON.stringify({
      projectId: this.projectId,
      indexSheet: this.indexSheet,
      SOR: this.SOR,
      SOD: this.SOD,
      SOU: this.SOU,
      contentData: this.contentData,
    });
  }

  // Lógica para autocompletado
  /*displayFn(material: Material): string {
    if (material !== null || material !== undefined) {
      this.materialFiltrado = material.name_material;
    }
    return material && this.materialFiltrado;
  }*/
  displayFn(material: Material | null): string {
    if (material && typeof material === 'object' && 'name_material' in material) {
      this.materialFiltrado = material.name_material;
      return material && this.materialFiltrado;
    }
    return '';
  }

  onMaterialAutoCompleted(material: Material) {
    this.autocompletedMaterial = material;
    this.filterEPDS();
  }

  filterEPDS() {
    if (this.autocompletedMaterial) {
      this.filteredEPDS = this.EPDS.filter(
        epd => epd.name_material === this.autocompletedMaterial?.name_material
      );
    } else {
      this.filteredEPDS = [...this.EPDS];
    }
  }

  // TODO: fix autocomplete for materials in other DBs

  clearAutocomplete(): void {
    this.myControl.setValue('');  // Clear the input box
    this.autocompletedMaterial = null;  // Reset the selected material
    this.filterEPDS();  // Reset the filtered EPD list to full
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

  onGroupsChange(options: MatListOption[]) {

    this.clearMaterialsPanel();

    options.map(option => {
      this.selectedSheet = option.value;
    });

    this.indexSheet = this.sheetNames.indexOf(this.selectedSheet);
    if (this.indexSheet >= 11) {
      this.indexSheet = this.indexSheet + 5;
    }
    this.listData = this.contentData[this.indexSheet + 1];

    const SCRevit = [],
     SCDynamo = [],
     SCUsuario = [];

    this.listData.map(sc => {
      if (sc.Origen === 'Modelo de Revit' || sc.Origen === 'Template EVAMED') {
        SCRevit.push(sc.Sistema_constructivo);
      }
      if (sc.Origen === 'Opciones EVAMED') {
        SCDynamo.push(sc.Sistema_constructivo);
      }
      if (sc.Origen === 'Usuario_Plataforma') {
        SCUsuario.push(sc.Sistema_constructivo);
      }
    });

    this.ListSCRevit = [...new Set(SCRevit)];
    this.ListSCDynamo = [...new Set(SCDynamo)];
    this.ListSCUsuario = [...new Set(SCUsuario)];

    let i;
    for (i = 0; i <= this.sheetNames.length; i++) {
      if (this.indexSheet === i && this.SOR !== undefined) {
        this.selectedOptionsRevit = this.SOR[i];
      }
      if (this.indexSheet === i && this.SOD !== undefined) {
        this.selectedOptionsDynamo = this.SOD[i];
      }
      if (this.indexSheet === i && this.SOU !== undefined) {
        this.selectedOptionsUsuario = this.SOU[i];
      }
    }

    this.syncSelectionsForCurrentSheet();
  }

  private buildSelectionKey(sectionId: number, originId: number, label: string): string {
    return `${sectionId}|${originId}|${label}`;
  }

  private syncSelectionsForCurrentSheet() {
    if (!this.projectId || this.indexSheet === undefined) {
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
      ...toItems(this.ListSCUsuario || [], 3),
    ];

    if (options.length === 0) {
      return;
    }

    this.materialsService
      .upsertMaterialsStageSelections({
        project_id: this.projectId,
        items: options,
      })
      .subscribe({
        next: () => {
        this.materialsService
          .getMaterialsStageSelections(this.projectId, sectionId)
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
            this.selectedOptionsUsuario = items
              .filter(item => item.origin_id === 3 && item.is_selected)
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
            this.SOU[this.indexSheet] = this.selectedOptionsUsuario;
            },
            error: () => {},
          });
        },
        error: () => {},
      });
  }

  onSelectedMaterial(value) {
    this.dataMaterialSelected = value.selected[0]?.value.value;

    console.log('ON SELECTED MATERIAL!!!!!');
    console.log(this.dataMaterialSelected);

    this.dataMaterialSelected.vidaUtil = this.dataMaterialSelected.vidaUtil === undefined
      ? (this.dataMaterialSelected.vidaUtil = parseInt(
          this.vidaUtilSeleccionado,
          10
        ))
      : this.dataMaterialSelected.vidaUtil;

      this.dataMaterialSelected.reemplazos = this.dataMaterialSelected.reemplazos === undefined
      ? (this.dataMaterialSelected.reemplazos = 0)
      : this.dataMaterialSelected.reemplazos;

    this.catalogoTransportesLocal = [];
    this.catalogsService.getTransports().subscribe(data => {
      data.map(item => {
        this.catalogoTransportesLocal.push(item);
      });
    });

    this.materialsList.map(material => {
      if (material.name_material === this.dataMaterialSelected.Material) {
        this.dataMaterialSelected.name_material_db = material.name_material;
      }
    });

    this.dataMaterialSelected.materialSelectedDB = 'Buscar material';
    if (this.dataMaterialSelected.name_material_db !== undefined) {
      this.dataMaterialSelected.materialSelectedDB =
        this.dataMaterialSelected.name_material_db;
    }

    if (this.dataMaterialSelected.materialDB !== undefined) {
      this.dataMaterialSelected.materialSelectedDB =
        this.dataMaterialSelected.materialDB.name_material;
    }

    if (this.dataMaterialSelected.name !== undefined) {
      this.dataMaterialSelected.materialSelectedDB =
        this.dataMaterialSelected.name;
    }

    this.selectedMaterial = true;
  }

  changeLifeTime(reemplazos) {
    let lifeTime = this.vidaUtilSeleccionado;
    lifeTime =
      parseInt(this.vidaUtilSeleccionado, 10) / (parseInt(reemplazos, 10) + 1);
    this.dataMaterialSelected.vidaUtil = lifeTime;
  }

  changeReplaces(vidaUtil) {
    let replaces = 0;
    replaces = parseInt(this.vidaUtilSeleccionado, 10) / parseInt(vidaUtil, 10);
    this.dataMaterialSelected.reemplazos = Math.ceil(replaces) - 1;
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

  selectCountry(id) {
    this.catalogsService.getExternalDistances().subscribe(data => {
      console.log(data)
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
                // if (item.id >= 3) {
                this.catalogoTransportesExtrangero.push(item);
                // }
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

  onNgModelChangeRevit() {
    let i;
    for (i = 0; i <= this.sheetNames.length; i++) {
      if (this.indexSheet === i) {
        this.SOR[i] = this.selectedOptionsRevit;
      }
    }

    // Detect deselected items
    const deselected = this.previousSelectedOptionsRevit.filter(
      item => !this.selectedOptionsRevit.includes(item)
    );

    // Check if currently displayed SC was deselected
    if (deselected.includes(this.currentPanelItem)) {
      this.clearMaterialsPanel(); // Clear third panel
    }

    // Save current state
    this.previousSelectedOptionsRevit = [...this.selectedOptionsRevit];
  }

  clearMaterialsPanel() {
    this.currentPanelItem = null;
    this.SCseleccionado = '';
    this.selectedMaterial = false;
    this.showSearch = false;
    this.listMateriales = {};

    // Optional: Reset visibility
    this.shouldShowMaterials = false;
    setTimeout(() => {
      this.shouldShowMaterials = true;
    }, 0);
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
    let i;
    for (i = 0; i <= this.sheetNames.length; i++) {
      if (this.indexSheet === i) {
        this.SOU[i] = this.selectedOptionsUsuario;
      }
    }
  }

  onNgModelChangeMaterial() {
    // console.log(this.selectedMaterial);
  }

  async saveStepOne() {
    const projectId = this.projectId;

    // Save Modelo Revit and Usuario
    await Object.entries(this.SOR).forEach(([key, value]) => {
      this.contentData[parseInt(key, 10) + 1].map(data => {
        value.map(sc => {
          if (data.Sistema_constructivo === sc) {
            if (
              data.Origen === 'Modelo de Revit' ||
              data.Origen === 'Template EVAMED'
            ) {
              let materialToSearch = data.Material;

              if (data.name_material_db !== undefined) {
                materialToSearch = data.materialSelectedDB;
              }

              this.materialsService
                .searchMaterial(materialToSearch)
                .subscribe(material => {
                  material.map(materialData => {
                    if (materialData.name_material === materialToSearch) {
                      this.projectsService
                        .addSchemeProject({
                          construction_system: data.Sistema_constructivo,
                          comercial_name: data.Material,
                          quantity: data.Cantidad,
                          provider_distance: 0,
                          material_id: materialData.id,
                          project_id: projectId,
                          origin_id: 1,
                          section_id: parseInt(key, 10) + 1,
                          value: null,
                          distance_init:
                            data.distancia_1 === '' ||
                            data.distancia_1 === undefined
                              ? 0
                              : parseInt(data.distancia_1, 10),
                          distance_end:
                            data.distancia_2 === '' ||
                            data.distancia_2 === undefined
                              ? 0
                              : parseInt(data.distancia_2, 10),
                          replaces:
                            data.reemplazos === '' ||
                            data.reemplazos === undefined
                              ? 0
                              : data.reemplazos,
                          city_id_origin: this.ciudadOrigenSeleccionada,
                          state_id_origin: 1,
                          city_id_end: 1,
                          transport_id_origin:
                            data.transporte_1 === '' ||
                            data.transporte_1 === undefined
                              ? null
                              : parseInt(data.transporte_1, 10),
                          transport_id_end:
                            data.transporte_2 === '' ||
                            data.transporte_2 === undefined
                              ? null
                              : parseInt(data.transporte_2, 10),
                          unit_text: data.Unidad,
                          description_material: data['Descripción de Material'],
                        })
                        .subscribe(data => {
                          console.log(
                            'Success Modelo Revit o Template EVAMED!'
                          );
                          console.log(data);
                        });
                    }
                  });
                });
            }
          }
        });
      });
    });

    // Save Dynamo
    await Object.entries(this.SOD).forEach(([key, value]) => {
      this.contentData[parseInt(key, 10) + 1].map(data => {
        value.map(sc => {
          if (data.Sistema_constructivo === sc) {
            if (data.Origen === 'Opciones EVAMED') {
              let materialToSearch = data.Material;

              if (data.name_material_db !== undefined) {
                materialToSearch = data.materialSelectedDB;
              }

              this.materialsService
                .searchMaterial(materialToSearch)
                .subscribe(material => {
                  material.map(materialData => {
                    if (materialData.name_material === materialToSearch) {
                      this.projectsService
                        .addSchemeProject({
                          construction_system: data.Sistema_constructivo,
                          comercial_name: data.Material,
                          quantity: data.Cantidad,
                          provider_distance: 0,
                          material_id: materialData.id,
                          project_id: projectId,
                          origin_id: 2,
                          section_id: parseInt(key, 10) + 1,
                          value: null,
                          distance_init:
                            data.distancia_1 === '' ||
                            data.distancia_1 === undefined
                              ? 0
                              : parseInt(data.distancia_1, 10),
                          distance_end:
                            data.distancia_2 === '' ||
                            data.distancia_2 === undefined
                              ? 0
                              : parseInt(data.distancia_2, 10),
                          replaces:
                            data.reemplazos === '' ||
                            data.reemplazos === undefined
                              ? 0
                              : data.reemplazos,
                          city_id_origin: this.ciudadOrigenSeleccionada,
                          state_id_origin: 1,
                          city_id_end: 1,
                          transport_id_origin:
                            data.transporte_1 === '' ||
                            data.transporte_1 === undefined
                              ? null
                              : data.transporte_1,
                          transport_id_end:
                            data.transporte_2 === '' ||
                            data.transporte_2 === undefined
                              ? null
                              : data.transporte_2,
                          unit_text: data.Unidad,
                          description_material: data['Descripción de Material'],
                        })
                        .subscribe(data => {
                          console.log(
                            'Success Modelo Revit o Template EVAMED!'
                          );
                          console.log(data);
                        });
                    }
                  });
                });
            }
          }
        });
      });
    });
  }

onSCSelected(event: MatSelectionListChange | any, originId: number) {
  const selectedItem = event.options[0]?.value,
        isSelected = event.options[0]?.selected;

  if (!selectedItem || this.indexSheet === undefined || !this.projectId) {
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
        project_id: this.projectId,
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
      project_id: this.projectId,
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

  onSystemLabelClick(event: Event, sc: string, origin: string) {
    event.stopPropagation();
    this.showMaterials(sc, origin);
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
    if (this.indexSheet === undefined) {
      return;
    }

    const sectionId = this.indexSheet + 1;
    const selectionRequests = [];

    systemsToDelete.forEach(({ label, originId }) => {
      const selectionId = this.selectionIdByKey[
        this.buildSelectionKey(sectionId, originId, label)
      ];

      if (selectionId) {
        selectionRequests.push(
          this.materialsService.updateMaterialsStageSelections({
            project_id: this.projectId,
            items: [
              {
                sistemaConstructivoId: selectionId,
                is_selected: false,
              },
            ],
          })
        );
      }
    });

    const runLocalDelete = () => {
      this.listData = (this.listData ?? []).filter(item => {
        return !systemsToDelete.some(system => {
          const sameLabel = item.Sistema_constructivo === system.label;
          const sameOrigin =
            (system.originId === 1 &&
              (item.Origen === 'Modelo de Revit' || item.Origen === 'Template EVAMED')) ||
            (system.originId === 2 && item.Origen === 'Opciones EVAMED') ||
            (system.originId === 3 && item.Origen === 'Usuario_Plataforma');

          return sameLabel && sameOrigin;
        });
      });

      this.contentData[this.indexSheet + 1] = this.listData;
      const storedDataProject = sessionStorage.getItem('dataProject');
      if (storedDataProject) {
        const parsedDataProject = JSON.parse(storedDataProject);
        parsedDataProject.data = this.contentData;
        sessionStorage.setItem('dataProject', JSON.stringify(parsedDataProject));
      }

      this.finalizeDeletedSystems(systemsToDelete, sectionId);
    };

    if (selectionRequests.length === 0) {
      runLocalDelete();
      return;
    }

    forkJoin(selectionRequests).subscribe({
      next: () => runLocalDelete(),
      error: error => {
        console.error('No se pudieron actualizar las selecciones eliminadas', error);
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

    this.onGroupsChange([{ value: this.selectedSheet } as MatListOption]);
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

  showMaterials(sc, origin) {
    this.currentPanelItem = sc; // track currently shown item
    this.SCseleccionado = '/ ' + sc;
    this.selectedMaterial = false;
    this.showSearch = false;
    this.showMaterial = false;
    const materiales = [];
    let counterRevit = 1,
     countDynamo = 1;

    this.listData.map(data => {
      if (data.Sistema_constructivo === sc && origin === 'revit-user') {
        if (
          data.Origen === 'Modelo de Revit' ||
          data.Origen === 'Template EVAMED'
        ) {
          data.signal = false;
          let materialABuscar = data.Material;
          if (data.materialSelectedDB !== undefined) {
            if (data.materialDB !== undefined) {
              materialABuscar = data.materialDB.name_material;
            }
          }

          this.materialsService
            .searchMaterial(materialABuscar)
            .subscribe(material => {
              material.map(materialData => {
                if (materialData.name_material === materialABuscar) {
                  data.signal = true;
                }
              });
            });
          data.key = counterRevit++;
          materiales.push(data);
        }
      }
      if (data.Sistema_constructivo === sc && origin === 'dynamo') {
        if (data.Origen === 'Opciones EVAMED') {
          data.signal = false;
          let materialABuscar = data.Material;
          if (data.materialSelectedDB !== undefined) {
            if (data.materialSelectedDB !== 'Buscar material') {
              materialABuscar = data.materialSelectedDB;
            }
          }
          this.materialsService
            .searchMaterial(materialABuscar)
            .subscribe(material => {
              material.map(materialData => {
                if (materialData.name_material === data.Material) {
                  data.signal = true;
                }
              });
            });
          data.key = countDynamo++;
          materiales.push(data);
        }
      }
    });
    this.listMateriales = materiales;
  }

  showDetailMaterial(event, material) {
    event.stopPropagation();
    this.showMaterial = true;
    this.dataMaterialSelected.name = material.name_material;
    this.dataMaterialSelected.description = material.description;
    // this.dataMaterialSelected.registrationNumber = 'S-P-01927';
    // this.dataMaterialSelected.publicationDate = '202-04-01';
    // this.dataMaterialSelected.utilLife = '2025-04-01';
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
  }

  showMexicanIuh() {
    this.showListMaterials = false;
    this.showMexican = true;
  }

  returnDatabaseList() {
    this.showListMaterials = true;
    this.showMexican = false;
  }

  showDetailEPD(event, material) {
    event.stopPropagation();
    this.showEPD = true;
    this.dataMaterialSelected.name = material.name_material;
    this.dataMaterialSelected.id = material.id;
    this.dataMaterialSelected.description = material.description;
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

  onSelectMaterial(event, material) {
    event.stopPropagation();
    console.log('ON SELECT MATERIAL!!!!!!');
    this.dataMaterialSelected.materialSelectedDB = material;
    if (this.dataMaterialSelected.materialFiltrado !== undefined) {
      this.dataMaterialSelected.materialFiltrado = undefined;
    }
    console.log(this.dataMaterialSelected);
    this.returnMaterialData();
  }

  returnListEpds() {
    this.showEPD = false;
  }

  returnListDB() {
    this.showMaterial = false;
  }

  returnMaterialData() {
    console.log('returnMaterialData-----');
    const selectedName = this.dataMaterialSelected.materialFiltrado?.name_material
      ?? this.dataMaterialSelected.materialSelectedDB,
          selectedDescription = this.dataMaterialSelected?.description;

    this.dataMaterialSelected.materialSelectedDB = selectedName;
    this.dataMaterialSelected.name = selectedName;
    this.dataMaterialSelected.Material = selectedName;
    this.dataMaterialSelected['Descripción de Material'] = selectedDescription;

    console.log(this.dataMaterialSelected);
    this.selectedMaterial = true;
    this.showSearch = false;
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
    const origenLabel = origin === 'dynamo' ? 'Opciones EVAMED' : 'Modelo de Revit';
    const toDuplicate = this.listData.filter(
      item => item.Sistema_constructivo === sc &&
              (origin === 'user'
                ? item.Origen === 'Creado por el usuario'
                : item.Origen === origenLabel || item.Origen === 'Template EVAMED')
    );
    toDuplicate.forEach(item => {
      this.listData.push({ ...item });
    });
    this.contentData[this.indexSheet + 1] = this.listData;
    this.showMaterials(sc, origin === 'user' ? 'revit-user' : origin);
  }

  onReturnListMaterials() {
    this.selectedMaterial = false;
    this.showSearch = false;
    this.showMaterial = false;
  }

  goToMaterialStage() {
    this.router.navigateByUrl('materials-stage');
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
    this.goToConstructionStage();
  }

  goToHome() {
    this.router.navigateByUrl('home-evamed');
  }

  goToResultados() {
    sessionStorage.setItem('projectID', localStorage.getItem('idProyectoConstrucción'));
    this.router.navigateByUrl('resultados');
  }

  goToSearchInfo() {
    this.showSearch = true;
    this.selectedMaterial = false;
    this.showMaterial = false;
    this.showEPD = false;
  }

  addConstructiveElementsDialog() {
    const dialogRef = this.dialog.open(AddConstructiveElementComponent, {
      width: '680px',
      data: {
        newConstructiveElement: this.newConstructiveElement,
        newConstructiveSystem: this.newConstructiveSystem,
      },
    });

    dialogRef.afterClosed().subscribe(result => {
      this.sheetNames.push(result.newConstructiveElement);
      this.contentData.push([
        {
          Origen: 'Usuario_Plataforma',
          Sistema_constructivo: result.newConstructiveSystem,
        },
      ]);
    });
  }

  addConstructiveSystemDialog() {
    const dialogRef = this.dialog.open(AddConstructiveSystemComponent, {
      width: '680px',
      data: {
        newConstructiveSystem: this.newConstructiveSystem,
      },
    });

    dialogRef.afterClosed().subscribe(result => {
      console.log(result);
    });
  }

  addConstructiveMaterialDialog(origin) {
    const dialogRef = this.dialog.open(AddConstructiveMaterialComponent, {
      width: '680px',
      data: {
        //newConstructiveMaterial: this.newConstructiveMaterial,
      },
    });

    dialogRef.afterClosed().subscribe(result => {
      if (Object.keys(result).length > 1) {
        const mappedResult = {
          'Administrador EPDs': "-",
          'Base de datos': result.material?.database,
          'Cantidad': result.cantidad,
          'Descripción de Material': result.descripcion,
          'Material': result.material?.name || result.name,
          // TODO: considerar distancias
          'Objetivo Geográfico': '-',
          'Origen': origin,
          'Sistema_constructivo': this.currentPanelItem,
          'Unidad': result.unidad,
          'reemplazos': result.reemplazos,
          'vidaUtil': result.vidaUtil?.value
        };

        this.listData.push(mappedResult);
        this.showMaterials(this.currentPanelItem, 'revit-user');
      }
    });
  }
}
