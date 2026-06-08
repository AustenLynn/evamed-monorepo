import { Component, OnInit, ViewChild } from '@angular/core';
import { AuthService } from 'src/app/core/services/auth.service';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { AddNewProjectComponent } from '../add-new-project/add-new-project.component';
import { ChooseTypeOfProjectComponent } from '../choose-type-of-project/choose-type-of-project.component';
import { ProjectsService } from './../../../core/services/projects/projects.service';
import { Calculos } from '../../../calculos/calculos';
import { CatalogsService } from './../../../core/services/catalogs/catalogs.service';
import { UserService } from 'src/app/core/services/user/user.service';
import { ChangeNameProjectComponent } from '../change-name-project/change-name-project.component';
import { ConstructionStageService } from 'src/app/core/services/construction-stage/construction-stage.service';
import { EndLifeService } from './../../../core/services/end-life/end-life.service';
import { ElectricitConsumptionService } from './../../../core/services/electricity-consumption/electricit-consumption.service';
import { ChartOptions, ChartType } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { MaterialsService } from '../../../core/services/materials/materials.service';
import { AnalisisService } from '../../../core/services/analisis/analisis.service';
import { SelectionService } from '../../../core/services/selection/selection.service';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule} from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { MatMenuModule } from '@angular/material/menu';
import { CommonModule } from '@angular/common';
import { lastValueFrom } from 'rxjs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
//import { formatNumber } from '@angular/common';

@Component({
    selector: 'app-home-evamed',
    templateUrl: './home-evamed.component.html',
    styleUrls: ['./home-evamed.component.scss'],
    imports: [BaseChartDirective, MatCardModule, MatSelectModule, FormsModule, MatFormFieldModule,
        MatIconModule, MatButtonModule, MatButtonToggleModule, MatTabsModule, MatMenuModule,
        CommonModule, MatTooltipModule, MatProgressSpinnerModule]
})
export class HomeEvamedComponent implements OnInit {
  nombre: string;
  filtroUsoSeleccionado: any;
  filtroCatalogoUsos: any;
  catalogoUsos: any;
  catalogoPaises: any;
  catalogoTipo: any;
  catalogoVidaUtil: any;
  catalogoEsqHabitacional: any;
  catalogoEstados: any;
  catalogoCiudades: any;
  usoSeleccionado: number;
  paisSeleccionado: string;
  tipoSeleccionado: string;
  vidaUtilSeleccionado: string;
  esqHabitacionalSeleccionado: string;
  estadoSeleccionado: any;
  ciudadSeleccionada: any;
  superficieConstruida: string;
  superficieHabitable: string;
  noNiveles: string;
  optionSelected: string;
  projectsList: any = 0;
  tempProjectsList: any = 0;
  countProjectList: number;
  user: string;
  sector: string;
  email: string;
  nameProject: string;
  tagProject: string;
  sections: any[] = [];
  dataMaterial: any;
  catologoImpactoAmbiental: any;
  catologoOpcionesCarbono = [
    'Promedio del sector vivienda',
    'Vivienda sustentable',
  ];
  auxDataProjectList: any;
  ConstructiveSystemElements: any[] = [];
  ListDataEndLife: any[] = [];
  sourceInformation: any[] = [];
  ACR: any[] = [];
  ECD: any[] = [];
  ECDP: any[] = [];
  //para calculos
  DatosCalculos: any;
  cargaDatosCalculo = false;
  //---
  auxDatosGraficaUso = [];
  public doughnutChartType = 'doughnut';
  public pieChartOptions : ChartOptions = {
    responsive: false,
    maintainAspectRatio: false,
    layout: {
      padding: 0,
    },
    events: ['click'],
    elements: { arc: { borderWidth: 0 } },
    hover: { mode: null },
    plugins: {
      datalabels: {
        color: '#FFFFFF',
        font: {
          size: 8,
        },
      },
      tooltip: {
        enabled: false
      },
    },
  };

  public chartPlugins = [ChartDataLabels];

  @ViewChild('MyChart') chartDir: BaseChartDirective;
  public barChartOptions: ChartOptions = {
    responsive: true,
    plugins: {
      title: { display: true },
      legend: { display: false },
      tooltip: { enabled: false, mode: 'index' },
      datalabels: {
        color: 'white',
        anchor: 'center',
        align: 'center',
        font: {
          size: 7,
        },
      },
    },
    scales: {
      y: {
          display: true,
          beginAtZero: true,
          stacked: true,
          ticks: {
            font: {
              size: 11,
            }
          },
        },
      x: {
          display: true,
          beginAtZero: true,
          stacked: true,
          ticks: {
            font: {
              size: 11,
            }
          },
        },
    },
  };
  public barChartHorizontalOptions: ChartOptions = {
    responsive: true,
    plugins: {
      title: { display: false, text: 'KgCO2 / m2a por año', position: 'bottom' },
      legend: { display: false },
      tooltip: { enabled: false, mode: 'index' },
      datalabels: {
        display: false,
      },
    },
    indexAxis: 'y',
    scales: {
      y: {
          display: true,
          ticks: {
            font: {
              size: 11,
            }
          },
        },
      x: {
          display: false,
        },
    },
  };
  public barChartType: ChartType = 'bar';
  public barChartHorizontalType: ChartType = 'bar';

  public barChartLegend = false;
  public pieChartType = 'pie';
  public pieChartOptions_elementos : ChartOptions = {
    responsive: false,
    maintainAspectRatio: false,
    elements: { arc: { borderWidth: 0 } },
    hover: { mode: null },
    plugins: {
      /*title: {
        display: true,
        text: ["Consumo energético total", "requerido anualmente"],
      },
      legend: {
        position: 'right',
      },*/
      datalabels: {
        display: false,
      },
      tooltip: {
        enabled: false
      },
    },
  };

  constructor(
    private auth: AuthService,
    private router: Router,
    public dialog: MatDialog,
    private analisis: AnalisisService,
    private materials: MaterialsService,
    private calculos: Calculos,
    private projectsService: ProjectsService,
    private catalogsService: CatalogsService,
    private projects: ProjectsService,
    private constructionStageService: ConstructionStageService,
    private users: UserService,
    private endLifeService: EndLifeService,
    private electricitConsumptionService: ElectricitConsumptionService,
    private selectionService: SelectionService,
  ) {
    this.catalogsService.usesCatalog().subscribe(data => {
      this.catalogoUsos = data;
      this.filtroCatalogoUsos = data;
      this.filtroCatalogoUsos.push({ id: 0, name_use: 'Todos' });
    });

    this.catalogsService.countriesCatalog().subscribe(data => {
      this.catalogoPaises = [];
      data.map(item => {
        if (item.id === 1) {
          this.catalogoPaises.push(item);
        }
      });
    });

    this.catalogsService.typeProjectCatalog().subscribe(data => {
      this.catalogoTipo = data;
    });

    this.catalogsService.usefulLifeCatalog().subscribe(data => {
      this.catalogoVidaUtil = data;
    });

    this.catalogsService.housingSchemeCatalog().subscribe(data => {
      this.catalogoEsqHabitacional = data;
    });

    this.catalogsService.getPotentialTypes().subscribe(data => {
      this.catologoImpactoAmbiental = this.calculos.FiltradoDeImpactos(data);
    });

    this.catalogsService.getSections().subscribe(sections => {
      this.sections = sections;
    });

    this.projectsService
      .getMaterialSchemeProyect()
      .subscribe(dataMaterial => {
        this.dataMaterial = dataMaterial;
      });

    // user + projects are loaded in ngOnInit to ensure ordering before result fetches

    this.catalogsService.getStates().subscribe(data => {
      this.catalogoEstados = data;
    });

    this.constructionStageService
      .getConstructiveSystemElement()
      .subscribe(data => {
        const CSE = [];
        data.map(item => {
          CSE.push(item);
        });
        this.ConstructiveSystemElements = CSE;
      });

    this.endLifeService.getECDP().subscribe(data => {
      this.ListDataEndLife = data;
      this.ECDP = data;
    });

    this.catalogsService
      .getSourceInformation()
      .subscribe(sourceInformation => {
        this.sourceInformation = sourceInformation;
      });

    this.electricitConsumptionService.getACR().subscribe(data => {
      const ACR = [];
      data.map(item => {
        ACR.push(item);
      });
      this.ACR = ACR;
    });

    this.electricitConsumptionService.getECD().subscribe(data => {
      const ECD = [];
      data.map(item => {
        ECD.push(item);
      });
      this.ECD = ECD;
    });
  }

  async ngOnInit() {
    // Load user, then catalogs + projects in parallel
    const userData = await lastValueFrom(
      this.users.searchUser(localStorage.getItem('email-login'))
    );
    this.user = userData[0].name;
    this.sector = userData[0].institution;
    this.email = userData[0].email;
    localStorage.setItem('email-id', userData[0].id);

    const [allProjects, potentialTypesList, ULList, listaBD] = await Promise.all([
      lastValueFrom(this.projectsService.getProjects()),
      lastValueFrom(this.analisis.getPotentialTypes()),
      lastValueFrom(this.analisis.getUsefulLife()),
      lastValueFrom(this.analisis.getDB()),
    ]);

    const userId = parseInt(localStorage.getItem('email-id'), 10);
    this.projectsList = allProjects
      .filter((item: any) => item.user_platform_id === userId)
      .reverse();
    this.tempProjectsList = this.projectsList;
    this.countProjectList = this.projectsList.length;

    // Build usage pie chart data (depends on constructor-loaded ACR/ECD)
    this.auxDatosGraficaUso = this.projectsList.map(
      (item: any) => this.DataPieUso(this.serchUseData(item.id))
    );

    this.catologoImpactoAmbiental = this.calculos.FiltradoDeImpactos(potentialTypesList);
    this.DatosCalculos = { projectsList: allProjects, potentialTypesList, ULList };

    const auxBD: string[] = listaBD.map((el: any) => el['name']);
    const auxbases: Record<string, boolean> = auxBD.reduce((acc: Record<string, boolean>, n: string) => { acc[n] = true; return acc; }, {});

    // Build skeleton entries — results are fetched lazily when the user opens the Results tab
    this.auxDataProjectList = this.projectsList.map((element: any) => ({
      id: element.id,
      resultsLoaded: false,
      resultsLoading: false,
      datos: null,
      etapasIgnoradas: [],
      porcentaje: null,
      porcentajeSubepata: null,
      banderaEtapa: false,
      etapaSeleccionada: 'Ninguna',
      subetasMostrada: [{ abreviacion: 'nada', color: '#FFFFFF' }],
      impactoCompleteSelect: null,
      impactoSelect: null,
      unit_impacto: null,
      TipoGraficaActiva: { Pie: true, Bar: false },
      idsTextBotones: {
        Producción: 'ProducciónTInfo'.concat(String(element.id)),
        Construccion: 'ConstruccionTInfo'.concat(String(element.id)),
        Uso: 'UsoTInfo'.concat(String(element.id)),
        FinDeVida: 'FinDeVidaTInfo'.concat(String(element.id)),
      },
      idsBotones: {
        Producción: 'ProducciónTextInfo'.concat(String(element.id)),
        Construccion: 'ConstruccionTextInfo'.concat(String(element.id)),
        Uso: 'UsoTextInfo'.concat(String(element.id)),
        FinDeVida: 'FinDeVidaTextInfo'.concat(String(element.id)),
      },
      iconosCambio: {
        Producción: 'visibility',
        Construccion: 'visibility',
        Uso: 'visibility',
        FinDeVida: 'visibility',
      },
      dataGraficaBar: null,
      dataGraficaPie: null,
      mostrarOpcionCarbono: false,
      iconoCarbono: 'switch_left',
      graficasCarbonoOResultados: { resultados: true, carbono: false },
      opcionCarbonoSeleccionada: this.catologoOpcionesCarbono[0],
      dataGraficaCarbono: this.calculos.llenarGraficaCarbono(this.catologoOpcionesCarbono[0]),
      valorCarbono: null,
      flagsCarbono: null,
      descripcionCarbono: this.calculos.determinarDescripcionCarbono(this.catologoOpcionesCarbono[0]),
      errorCalculos: false,
      DBList: auxBD,
      basesDatos: { ...auxbases },
    }));
    this.cargaDatosCalculo = true;
  }

  onTabChange(event: any, i: number) {
    if (event.index === 1) {
      this.loadProjectResults(i);
    }
  }

  async loadProjectResults(i: number) {
    if (this.auxDataProjectList[i].resultsLoaded || this.auxDataProjectList[i].resultsLoading) return;
    this.auxDataProjectList[i].resultsLoading = true;

    const element = this.projectsList[i];
    const result = await lastValueFrom(this.analisis.getProjectResults(element.id));

    const rawDatos = result.datos;
    const calculosOperacionesDeFase: Record<string, any> = {};
    Object.keys(rawDatos).forEach(key => {
      calculosOperacionesDeFase[this.calculos.ajustarNombre(key)] = rawDatos[key];
    });

    const firstImpacto = this.catologoImpactoAmbiental[0];
    const firstImpactoKey = this.calculos.ajustarNombre(firstImpacto['name_complete_potential_type']);
    const porcentajeSubepata = this.calculos.ValoresProcentajeSubeapa(calculosOperacionesDeFase, []);

    this.auxDataProjectList[i] = {
      ...this.auxDataProjectList[i],
      resultsLoaded: true,
      resultsLoading: false,
      datos: calculosOperacionesDeFase,
      impactoCompleteSelect: firstImpacto['name_complete_potential_type'],
      impactoSelect: firstImpactoKey,
      unit_impacto: firstImpacto['unit_potential_type'],
      porcentaje: this.calculos.ValoresProcentaje(calculosOperacionesDeFase, []),
      porcentajeSubepata,
      dataGraficaBar: this.cargarDataBar(
        porcentajeSubepata,
        firstImpactoKey,
        [],
        element.id,
        firstImpacto['name_complete_potential_type'],
        calculosOperacionesDeFase
      ),
      dataGraficaPie: this.cargaDataPie(porcentajeSubepata, firstImpactoKey, []),
      valorCarbono: this.calculos
        .determinaValorCarbono(
          calculosOperacionesDeFase,
          this.DatosCalculos.projectsList,
          element.id,
          this.DatosCalculos.ULList
        )
        .toExponential(2),
      flagsCarbono: this.calculos.buscarValosCarbono(
        calculosOperacionesDeFase,
        this.catologoOpcionesCarbono[0],
        this.DatosCalculos.projectsList,
        element.id,
        this.DatosCalculos.ULList
      ),
      errorCalculos: result.error,
    };
  }

  onlyUnique(value, index, self) {
    return self.indexOf(value) === index;
  }

  logout() {
    this.auth.logout().then(() => {
      this.router.navigate(['/auth/login']);
    });
  }

  goToAdmin() {
    this.router.navigateByUrl('admin');
  }

  serchSections(projectId) {
    const sectionsExist = [];

    try {
      this.sections.map(section => {
        this.dataMaterial.map(material => {
          if (
            material.project_id === projectId &&
            material.section_id === section.id
          ) {
            sectionsExist.push(section);
          }
        });
      });
    } catch (e) {
      console.log(e);
    }

    return sectionsExist.filter(this.onlyUnique);
  }

  serchSC(projectId, scId) {
    const listSC = [];

    try {
      this.sections.map(section => {
        this.dataMaterial.map(material => {
          if (
            material.project_id === projectId &&
            material.section_id === section.id &&
            section.id === scId
          ) {
            listSC.push(material.construction_system);
          }
        });
      });
    } catch (e) {
      console.log(e);
    }

    return listSC.filter(this.onlyUnique);
  }

  serchConstructiveSection(projectId) {
    const sectionsExist = [];
    try {
      const sections = this.sections ?? [];
      const elements = this.ConstructiveSystemElements ?? [];
      sections.map(section => {
        elements.map(cs => {
          if (cs.project_id === projectId && cs.section_id === section.id) {
            sectionsExist.push(section);
          }
        });
      });
    } catch (e) {
      console.log(e);
    }

    return sectionsExist.filter(this.onlyUnique);
  }

  serchEndLifeSection(projectId) {
    const sectionsExist = [];
    try {
      const sections = this.sections ?? [];
      const ecdpList = this.ECDP ?? [];
      sections.map(section => {
        ecdpList.map(ecpd => {
          if (ecpd.project_id === projectId && ecpd.section_id === section.id) {
            sectionsExist.push(section);
          }
        });
      });
    } catch (e) {
      console.log(e);
    }

    return sectionsExist.filter(this.onlyUnique);
  }

  serchDetailConstruction(projectId, scId) {
    const list = [];

    try {
      const sections = this.sections ?? [];
      const elements = this.ConstructiveSystemElements ?? [];
      const sources = this.sourceInformation ?? [];
      sections.map(section => {
        elements.map(cs => {
          if (
            cs.project_id === projectId &&
            cs.section_id === section.id &&
            section.id === scId
          ) {
            sources.map(si => {
              if (si.id === cs.source_information_id) {
                list.push({
                  quantity: cs.quantity,
                  source_information: si.name_source_information,
                });
              }
            });
          }
        });
      });
    } catch (e) {
      console.log(e);
    }

    return list.filter(this.onlyUnique);
  }

  searchDataEndLife(projectId, scId) {
    const list = [];
    try {
      const sections = this.sections ?? [];
      const dataEndLife = this.ListDataEndLife ?? [];
      const sources = this.sourceInformation ?? [];
      sections.map(section => {
        dataEndLife.map(cs => {
          if (
            cs.project_id === projectId &&
            cs.section_id === section.id &&
            section.id === scId
          ) {
            sources.map(si => {
              if (si.id === cs.source_information_id) {
                list.push({
                  quantity: cs.quantity,
                  source_information: si.name_source_information,
                });
              }
            });
          }
        });
      });
    } catch (e) {
      console.log(e);
    }

    return list.filter(this.onlyUnique);
  }

  serchUseData(projectId) {
    const dataList = [];
    try {
      this.ACR.map(data => {
        if (projectId === data.project_id) {
          this.ECD.map(data2 => {
            if (data.id === data2.annual_consumption_required_id) {
              dataList.push(data2);
            }
          });
        }
      });
    } catch (e) {
      console.log(e);
    }

    return dataList.filter(this.onlyUnique);
  }

  hasProductionData(projectId: number): boolean {
    return this.serchSections(projectId).length > 0;
  }

  hasConstructionData(projectId: number): boolean {
    return this.serchConstructiveSection(projectId).length > 0;
  }

  hasEndLifeData(projectId: number): boolean {
    return this.serchEndLifeSection(projectId).length > 0;
  }

  DataPieUso(data) {
    const aux = [];
    let auxdata = [];
    const labels = [];

    data.forEach(element => {
      aux.push(element['quantity']);
      /*let num = formatNumber(element['quantity'], 'en-US', '1.2-2');
      if (element['source'] == 'fuel') {
        labels.push(`Combustible: ${num} kWh`);
      } else if (element['source'] == 'electric') {
        labels.push(`Red eléctrica nacional: ${num} kWh`);
      } else {
        labels.push(`Paneles fotovoltaicos: ${num} kWh`);
      }*/
    });

    auxdata = [
      {
        data: aux,
        backgroundColor: ['#DFDFDF', '#767676', '#C3C3C3'],
      },
    ];

    //return auxdata;
    return { labels: labels, datasets: auxdata };
  }

  selectUse(id) {
    this.projectsList = [];
    this.tempProjectsList.map(item => {
      if (item.use_id === id) {
        this.projectsList.push(item);
      }

      if (id === 0) {
        this.projectsList.push(item);
      }
    });
    this.projectsList.reverse();
  }

  openDialogCTOP() {
    const dialogRef = this.dialog.open(ChooseTypeOfProjectComponent, {
      width: '900px',
      data: {
        optionSelected: 'Huella de carbono',
      },
    });

    dialogRef.afterClosed().subscribe(result => {
      try {
        this.optionSelected = result.optionSelected;
        this.router.navigateByUrl('do-files');
      } catch {
        console.log('close modal');
      }
    });
  }

  deleteProject(id) {
    this.projects.deleteProject(id).subscribe(() => {
      this.users
        .searchUser(localStorage.getItem('email-login'))
        .subscribe(data => {
          localStorage.setItem('email-id', data[0].id);
          this.projectsList = [];
          this.projects.getProjects().subscribe(data => {
            data.map(item => {
              if (
                item.user_platform_id ===
                parseInt(localStorage.getItem('email-id'), 10)
              ) {
                this.projectsList.push(item);
              }
              this.countProjectList = this.projectsList.length;
            });
            this.projectsList.reverse();
          });
        });
    });
  }

  renameProject(id) {
    const dialogRef = this.dialog.open(ChangeNameProjectComponent, {
      width: '680px',
      data: {
        nameProject: this.nameProject,
      },
    });
    dialogRef.afterClosed().subscribe(result => {
      this.projectsService.getProjectById(id).subscribe((data: any) => {
        this.projectsService
          .updateProyect(id, {
            id,
            name_project: result.nameProject,
            builded_surface: data.builded_surface,
            living_area: data.living_area,
            tier: data.living_area,
            distance: data.distance,
            use_id: data.use_id,
            type_id: data.type_id,
            country_id: data.country_id,
            useful_life_id: data.country_id,
            housing_scheme_id: data.housing_scheme_id,
            user_platform_id: data.user_platform_id,
            city_id_origin: data.city_id_origin,
          })
          .subscribe(data2 => {
            console.log(data2);
            location.reload();
          });
      });
    });
  }

  duplicateProject(projectId) {
    this.cargaDatosCalculo = false;
    this.projectsService
      .getProjectById(projectId)
      .subscribe((projectData: any) => {
        this.projectsService
          .addProject({
            name_project: `${projectData.name_project} - Copy`,
            builded_surface: projectData.builded_surface,
            living_area: projectData.living_area,
            tier: projectData.tier,
            use_id: projectData.use_id,
            type_id: projectData.type_id,
            country_id: projectData.country_id,
            useful_life_id: projectData.useful_life_id,
            housing_scheme_id: projectData.housing_scheme_id,
            user_platform_id: projectData.user_platform_id,
            city_id_origin: projectData.city_id_origin,
            distance: null,
          })
          .subscribe(newProjectData => {
            localStorage.setItem('newProjectDataId', newProjectData.id);

            // Duplicar fin de vida
            const endLifeData = this.ListDataEndLife ?? [];
            endLifeData.forEach(dataEL => {
              if (dataEL.project_id === projectId) {
                this.endLifeService
                  .addECDP({
                    quantity: dataEL.quantity,
                    unit_id: dataEL.unit_id,
                    source_information_id: dataEL.source_information_id,
                    section_id: dataEL.section_id,
                    project_id: newProjectData.id,
                  })
                  .subscribe(dataResultEndLife => {
                    console.log('resultado de fin de vida');
                    console.log(dataResultEndLife);
                  });
              }
            });

            // Duplicar construcción
            const constructionData = this.ConstructiveSystemElements ?? [];
            constructionData.forEach(cs => {
              if (cs.project_id === projectId) {
                this.constructionStageService
                  .addConstructiveSistemElement({
                    quantity: cs.quantity,
                    project_id: newProjectData.id,
                    section_id: cs.section_id,
                    constructive_process_id: cs.constructive_process_id,
                    volume_unit_id: cs.volume_unit_id,
                    energy_unit_id: cs.energy_unit_id,
                    bulk_unit_id: cs.bulk_unit_id,
                    source_information_id: cs.source_information_id,
                  })
                  .subscribe(dataResultConstruction => {
                    console.log('resultado de construcción');
                    console.log(dataResultConstruction);
                  });
              }
            });

            // Duplicar Producción
            const materialsData = this.dataMaterial ?? [];
            materialsData.forEach(material => {
              if (material.project_id === projectId) {
                this.projectsService
                  .addSchemeProject({
                    construction_system: material.construction_system,
                    comercial_name: material.comercial_name,
                    quantity: material.quantity,
                    provider_distance: material.provider_distance,
                    material_id: material.material_id,
                    project_id: parseInt(
                      localStorage.getItem('newProjectDataId') ?? '',
                      10
                    ),
                    origin_id: material.origin_id,
                    section_id: material.section_id,
                    value: material.value,
                    distance_init: material.distance_init,
                    distance_end: material.distance_end,
                    replaces: material.replaces,
                    city_id_origin: material.city_id_origin,
                    city_id_end: material.city_id_end,
                    transport_id_origin: material.transport_id_origin,
                    transport_id_end: material.transport_id_end,
                    state_id_origin: material.state_id_origin,
                    unit_text: material.unit_text,
                    description_material: material.description_material,
                  })
                  .subscribe(dataResulMaterial => {
                    console.log('resultado de materiales');
                    console.log(dataResulMaterial);
                  });
              }
            });

            this.electricitConsumptionService
              .getACR()
              .subscribe(dataAllACR => {
                dataAllACR.map(acr => {
                  if (acr.project_id === projectId) {
                    // Duplicar Uso
                    this.electricitConsumptionService
                      .addACR({
                        project_id: parseInt(
                          localStorage.getItem('newProjectDataId') ?? '',
                          10
                        ),
                        quantity: acr.quantity,
                        unit_id: acr.unit_id,
                      })
                      .subscribe(dataNewACR => {
                        console.log('Resultado de add NewACR');
                        console.log(dataNewACR);
                        this.electricitConsumptionService
                          .getECD()
                          .subscribe(dataAllECD => {
                            dataAllECD.map(ecd => {
                              if (
                                ecd.annual_consumption_required_id === acr.id
                              ) {
                                this.electricitConsumptionService
                                  .addECD({
                                    quantity: ecd.quantity,
                                    percentage: ecd.percentage,
                                    source: ecd.source,
                                    annual_consumption_required_id:
                                      dataNewACR.id,
                                    unit_id: ecd.unit_id,
                                    type: ecd.type,
                                  })
                                  .subscribe(dataNewECD => {
                                    console.log('Resultado de add New ECD');
                                    console.log(dataNewECD);
                                    this.users
                                      .searchUser(
                                        localStorage.getItem('email-login')
                                      )
                                      .subscribe(data => {
                                        console.log(data);
                                        location.reload();
                                      });
                                  });
                              }
                            });
                          });
                      });
                  }
                });
              });
          });
      });
  }

  selectImpactoAmbiental(impacto, indexRecivido) {
    this.auxDataProjectList[indexRecivido].impactoSelect =
      this.calculos.ajustarNombre(impacto);
    if (impacto === 'Calentamiento Global') {
      this.auxDataProjectList[indexRecivido].mostrarOpcionCarbono = true;
      this.auxDataProjectList[indexRecivido].iconoCarbono = 'switch_left';
    } else {
      this.auxDataProjectList[indexRecivido].mostrarOpcionCarbono = false;
    }
    this.auxDataProjectList[indexRecivido].impactoCompleteSelect = impacto;
    this.auxDataProjectList[indexRecivido].etapasIgnoradas = [];
    this.catologoImpactoAmbiental.forEach(element => {
      if (element.name_complete_potential_type === impacto) {
        this.auxDataProjectList[indexRecivido].unit_impacto =
          element.unit_potential_type;
      }
    });
    this.auxDataProjectList[indexRecivido].dataGraficaPie = this.cargaDataPie(
      this.auxDataProjectList[indexRecivido].porcentajeSubepata,
      this.auxDataProjectList[indexRecivido].impactoSelect,
      this.auxDataProjectList[indexRecivido].etapasIgnoradas
    );
    this.auxDataProjectList[indexRecivido].dataGraficaBar = this.cargarDataBar(
      this.auxDataProjectList[indexRecivido].porcentajeSubepata,
      this.auxDataProjectList[indexRecivido].impactoSelect,
      this.auxDataProjectList[indexRecivido].etapasIgnoradas,
      this.auxDataProjectList[indexRecivido].id,
      this.auxDataProjectList[indexRecivido].impactoCompleteSelect,
      this.auxDataProjectList[indexRecivido].datos
    );
    if (this.auxDataProjectList[indexRecivido].etapaSeleccionada != 'Ninguna') {
      this.auxDataProjectList[indexRecivido].subetasMostrada =
        this.calculos.findSubetapas(
          this.auxDataProjectList[indexRecivido].etapaSeleccionada,
          this.auxDataProjectList[indexRecivido].impactoCompleteSelect,
          this.auxDataProjectList[indexRecivido].datos
        );
    }
  }

  selectOpcionCarbono(opcion, indexRecivido) {
    this.auxDataProjectList[indexRecivido].dataGraficaCarbono =
      this.calculos.llenarGraficaCarbono(opcion);
    this.auxDataProjectList[indexRecivido].flagsCarbono =
      this.calculos.buscarValosCarbono(
        this.auxDataProjectList[indexRecivido].datos,
        opcion,
        this.DatosCalculos.projectsList,
        this.auxDataProjectList[indexRecivido].id,
        this.DatosCalculos.ULList
      );
    this.auxDataProjectList[indexRecivido].descripcionCarbono =
      this.calculos.determinarDescripcionCarbono(opcion);
  }

  mostrarHuellaCarbono(id, indexRecivido) {
    //Camiar graficas a Huella de Carbono o Resultados por ciclo de vida
    if (
      this.auxDataProjectList[indexRecivido]['graficasCarbonoOResultados'][
        'carbono'
      ]
    ) {
      this.auxDataProjectList[indexRecivido].iconoCarbono = 'switch_left';
      this.auxDataProjectList[indexRecivido]['graficasCarbonoOResultados'][
        'carbono'
      ] = false;
      this.auxDataProjectList[indexRecivido]['graficasCarbonoOResultados'][
        'resultados'
      ] = true;
    } else {
      this.auxDataProjectList[indexRecivido].iconoCarbono = 'switch_right';
      this.auxDataProjectList[indexRecivido]['graficasCarbonoOResultados'][
        'carbono'
      ] = true;
      this.auxDataProjectList[indexRecivido]['graficasCarbonoOResultados'][
        'resultados'
      ] = false;
    }
  }

  selectEtapa(etapa, i, id) {
    const auxSubetapas = this.calculos.findSubetapas(
      etapa,
      this.auxDataProjectList[i].impactoCompleteSelect,
      this.auxDataProjectList[i].datos
    );
    //console.log(auxSubetapas)
    this.auxDataProjectList[i].subetasMostrada = auxSubetapas;
    if (this.auxDataProjectList[i].etapaSeleccionada === etapa) {
      const auxid = etapa.concat('TextInfo'.concat(String(id))),
        auxidText = etapa.concat('TInfo'.concat(String(id)));
      document.getElementById(auxid).className = 'button-info';
      document.getElementById(auxidText).style.color = '#767676';
      this.auxDataProjectList[i].banderaEtapa = false;
      this.auxDataProjectList[i].etapaSeleccionada = 'Ninguna';
      this.auxDataProjectList[i].subetasMostrada = [
        { abreviacion: 'nada', color: '#FFFFFF' },
      ];
    } else {
      if (this.auxDataProjectList[i].etapaSeleccionada != 'Ninguna') {
        const auxid = this.auxDataProjectList[i].etapaSeleccionada.concat(
          'TextInfo'.concat(String(id))
        ),
         auxidText = this.auxDataProjectList[i].etapaSeleccionada.concat(
          'TInfo'.concat(String(id))
        );
        document.getElementById(auxid).className = 'button-info';
        document.getElementById(auxidText).style.color = '#767676';
      }
      this.auxDataProjectList[i].banderaEtapa = true;
      this.auxDataProjectList[i].etapaSeleccionada = etapa;
      const auxid = this.auxDataProjectList[i].etapaSeleccionada.concat(
        'TextInfo'.concat(String(id))
      );
      document.getElementById(auxid).className = 'button-info-select';
      const color = {
        Producción: '#4DBE89',
        Construccion: '#0DADBA',
        Uso: '#8F5091',
        FinDeVida: '#DEA961',
      };
      Object.keys(color).forEach(element => {
        if (element === etapa) {
          const auxid = etapa.concat('TextInfo'.concat(String(id))),
            auxidText = etapa.concat('TInfo'.concat(String(id)));
          document.getElementById(auxidText).style.color = color[element];
          document.getElementById(auxid).style.borderColor = color[element];
        }
      });
    }
  }

  cargarDataBar(data, impactoU, etapasI, id, impactS, porcentajesMostrados) {
    const auxColor = [];
    let aux = [];
    const auxl: BaseChartDirective["labels"] = [];
    let banderaEtapa = true;
    const auxdata2 = [],
     auxDatos = { sub1: [], sub2: [], sub3: [], sub4: [] },
     auxColores = { sub1: [], sub2: [], sub3: [], sub4: [] };
    let maxsubetapas = 0;

    Object.keys(data).forEach(element => {
      if (element === impactoU) {
        Object.keys(data[element]).forEach(ciclo => {
          etapasI.forEach(ei => {
            if (ei === ciclo) {
              banderaEtapa = false;
            }
          });
          if (banderaEtapa) {
            if (
              this.calculos.findSubetapas(ciclo, impactS, porcentajesMostrados)
                .length > maxsubetapas
            )
              maxsubetapas = this.calculos.findSubetapas(
                ciclo,
                impactS,
                porcentajesMostrados
              ).length;
          }
          banderaEtapa = true;
        });
      }
      if (element === impactoU) {
        Object.keys(data[element]).forEach(ciclo => {
          etapasI.forEach(ei => {
            if (ei === ciclo) {
              banderaEtapa = false;
            }
          });
          if (banderaEtapa) {
            auxl.push(ciclo);
            let auxsub = 0;
            Object.keys(data[element][ciclo]).forEach(subetapa => {
              auxsub = auxsub + 1;
              if (auxsub == 1) {
                auxDatos.sub1.push(data[element][ciclo][subetapa].porcentaje);
                auxColores.sub1.push(this.calculos.findColor(subetapa));
              }
              if (auxsub == 2) {
                auxDatos.sub2.push(data[element][ciclo][subetapa].porcentaje);
                auxColores.sub2.push(this.calculos.findColor(subetapa));
              }
              if (auxsub == 3) {
                auxDatos.sub3.push(data[element][ciclo][subetapa].porcentaje);
                auxColores.sub3.push(this.calculos.findColor(subetapa));
              }
              if (auxsub == 4) {
                auxDatos.sub4.push(data[element][ciclo][subetapa].porcentaje);
                auxColores.sub4.push(this.calculos.findColor(subetapa));
              }
              auxdata2.push(data[element][ciclo][subetapa].num);
              auxColor.push(this.calculos.findColor(subetapa));
            });
            if (auxsub < maxsubetapas) {
              for (let i = auxsub + 1; i <= maxsubetapas; i++) {
                if (i == 3) {
                  auxDatos.sub3.push('0');
                  auxColores.sub3.push('#FFFFFF');
                }
                if (i == 4) {
                  auxDatos.sub4.push('0');
                  auxColores.sub4.push('#FFFFFF');
                }
              }
            }
          }
          banderaEtapa = true;
        });
      }
    });

    Object.keys(auxDatos).forEach(element => {
      aux = [
        ...aux,
        {
          data: auxDatos[element],
          label: element,
          stack: 'Proyecto',
          backgroundColor: auxColores[element],
        },
      ];
    });

    return { labels: auxl, datasets: aux };
  }

  cargaDataPie(data, impactoU, etapasI) {
    const auxColor = [];
    let banderaEtapa = true,
     auxdata2 = [];
    Object.keys(data).forEach(element => {
      if (element === impactoU) {
        Object.keys(data[element]).forEach(ciclo => {
          etapasI.forEach(ei => {
            if (ei === ciclo) {
              banderaEtapa = false;
            }
          });
          if (banderaEtapa) {
            Object.keys(data[element][ciclo]).forEach(subetapa => {
              auxdata2.push(data[element][ciclo][subetapa].num);
              auxColor.push(this.calculos.findColor(subetapa));
            });
          }
          banderaEtapa = true;
        });
      }
    });

    auxdata2 = this.calculos.Porcentaje(auxdata2);

    return { labels: [], datasets: [{data: auxdata2, backgroundColor: auxColor}] };
  }

  eliminarEtapa(etapa, i) {
    if (this.auxDataProjectList[i].etapasIgnoradas.includes(etapa)) {
      this.auxDataProjectList[i].etapasIgnoradas.forEach((element, index) => {
        if (element === etapa) {
          this.auxDataProjectList[i].iconosCambio[etapa] = 'visibility';
          this.auxDataProjectList[i].etapasIgnoradas.splice(index, 1);
        }
      });
    } else {
      this.auxDataProjectList[i].iconosCambio[etapa] = 'visibility_off';
      this.auxDataProjectList[i].etapasIgnoradas.push(etapa);
    }

    this.auxDataProjectList[i].porcentaje = this.calculos.ValoresProcentaje(
      this.auxDataProjectList[i].datos,
      this.auxDataProjectList[i].etapasIgnoradas
    );

    this.auxDataProjectList[i].porcentajeSubepata =
      this.calculos.ValoresProcentajeSubeapa(
        this.auxDataProjectList[i].datos,
        this.auxDataProjectList[i].etapasIgnoradas
      );

    this.auxDataProjectList[i].dataGraficaPie = this.cargaDataPie(
      this.calculos.ValoresProcentajeSubeapa(
        this.auxDataProjectList[i].datos,
        this.auxDataProjectList[i].etapasIgnoradas
      ),
      this.auxDataProjectList[i].impactoSelect,
      this.auxDataProjectList[i].etapasIgnoradas
    );
    this.auxDataProjectList[i].dataGraficaBar = this.cargarDataBar(
      this.calculos.ValoresProcentajeSubeapa(
        this.auxDataProjectList[i].datos,
        this.auxDataProjectList[i].etapasIgnoradas
      ),
      this.auxDataProjectList[i].impactoSelect,
      this.auxDataProjectList[i].etapasIgnoradas,
      this.auxDataProjectList[i].id,
      this.auxDataProjectList[i].impactoCompleteSelect,
      this.auxDataProjectList[i].datos
    );
  }

  cambioGrafica(i, grafica) {
    if (grafica === 'Pie') {
      this.auxDataProjectList[i].TipoGraficaActiva['Pie'] = true;
      this.auxDataProjectList[i].TipoGraficaActiva['Bar'] = false;
    }
    if (grafica === 'Bar') {
      this.auxDataProjectList[i].TipoGraficaActiva['Pie'] = false;
      this.auxDataProjectList[i].TipoGraficaActiva['Bar'] = true;
    }
  }

  async ajusteUsoBaseDatos(seleccion: string[], project: number) {
    const projectId = this.auxDataProjectList[project]['id'];
    const databases = seleccion.length > 0 ? seleccion.join(',') : undefined;

    const result = await lastValueFrom(this.analisis.getProjectResults(projectId, databases));

    const rawDatos = result.datos;
    const calculosOperacionesDeFase: Record<string, any> = {};
    Object.keys(rawDatos).forEach(key => {
      calculosOperacionesDeFase[this.calculos.ajustarNombre(key)] = rawDatos[key];
    });

    this.auxDataProjectList[project]['datos'] = calculosOperacionesDeFase;
    this.auxDataProjectList[project]['basesDatos'] = this.auxDataProjectList[project]['DBList']
      .reduce((acc: Record<string, boolean>, db: string) => { acc[db] = seleccion.includes(db); return acc; }, {});

    const etapasIgnoradas = this.auxDataProjectList[project].etapasIgnoradas;
    const valorPorcentaje = this.calculos.ValoresProcentaje(calculosOperacionesDeFase, etapasIgnoradas);
    const valorPorcentajeS = this.calculos.ValoresProcentajeSubeapa(calculosOperacionesDeFase, etapasIgnoradas);

    this.auxDataProjectList[project]['porcentaje'] = valorPorcentaje;
    this.auxDataProjectList[project]['porcentajeSubepata'] = valorPorcentajeS;
    this.auxDataProjectList[project].dataGraficaPie = this.cargaDataPie(
      valorPorcentajeS,
      this.auxDataProjectList[project].impactoSelect,
      etapasIgnoradas
    );
    this.auxDataProjectList[project]['dataGraficaBar'] = this.cargarDataBar(
      valorPorcentajeS,
      this.auxDataProjectList[project]['impactoSelect'],
      etapasIgnoradas,
      projectId,
      this.auxDataProjectList[project].impactoCompleteSelect,
      calculosOperacionesDeFase
    );
    if (this.auxDataProjectList[project].etapaSeleccionada !== 'Ninguna') {
      this.auxDataProjectList[project].subetasMostrada = this.calculos.findSubetapas(
        this.auxDataProjectList[project].etapaSeleccionada,
        this.auxDataProjectList[project].impactoCompleteSelect,
        calculosOperacionesDeFase
      );
    }
    this.auxDataProjectList[project]['valorCarbono'] = this.calculos
      .determinaValorCarbono(
        calculosOperacionesDeFase,
        this.DatosCalculos.projectsList,
        projectId,
        this.DatosCalculos.ULList
      )
      .toExponential(2);
    this.auxDataProjectList[project]['flagsCarbono'] = this.calculos.buscarValosCarbono(
      calculosOperacionesDeFase,
      this.auxDataProjectList[project].opcionCarbonoSeleccionada,
      this.DatosCalculos.projectsList,
      projectId,
      this.DatosCalculos.ULList
    );
  }

  openDialogANP() {
    const dialogRef = this.dialog.open(AddNewProjectComponent, {
      width: '680px',
      data: {
        nombre: this.nombre,
        catalogoUsos: this.catalogoUsos,
        catalogoPaises: this.catalogoPaises,
        catalogoTipo: this.catalogoTipo,
        catalogoVidaUtil: this.catalogoVidaUtil,
        catalogoEsqHabitacional: this.catalogoEsqHabitacional,
        catalogoEstados: this.catalogoEstados,
        usoSeleccionado: this.usoSeleccionado,
        paisSeleccionado: this.paisSeleccionado,
        tipoSeleccionado: this.tipoSeleccionado,
        superficieConstruida: this.superficieConstruida,
        superficieHabitable: this.superficieHabitable,
        vidaUtilSeleccionado: this.vidaUtilSeleccionado,
        esqHabitacionalSeleccionado: this.esqHabitacionalSeleccionado,
        estadoSeleccionado: this.estadoSeleccionado,
        ciudadSeleccionada: this.ciudadSeleccionada,
        noNiveles: this.noNiveles,
      },
    });

    dialogRef.afterClosed().subscribe(result => {
      try {
        this.projectsService
          .addProject({
            name_project: result.nombre,
            builded_surface: parseInt(result.superficieConstruida, 10),
            living_area: parseInt(result.superficieHabitable, 10),
            tier: parseInt(result.noNiveles, 10),
            use_id: result.usoSeleccionado,
            type_id:
              result.tipoSeleccionado === undefined
                ? null
                : result.tipoSeleccionado,
            country_id: result.paisSeleccionado,
            useful_life_id: result.vidaUtilSeleccionado,
            housing_scheme_id:
              result.esqHabitacionalSeleccionado === undefined
                ? null
                : result.esqHabitacionalSeleccionado,
            user_platform_id: parseInt(localStorage.getItem('email-id'), 10),
            city_id_origin:
              result.ciudadSeleccionada === undefined
                ? null
                : result.ciudadSeleccionada,
            distance: null,
          })
          .subscribe(data => {
            sessionStorage.setItem('primaryDataProject', JSON.stringify(data));

            sessionStorage.setItem(
              'estadoSeleccionado',
              result.estadoSeleccionado
            );
            //this.openDialogCTOP(); // No abrir tipo de evalución e ir directo a do-files
            this.router.navigateByUrl('do-files');
          });
      } catch {
        console.log('close modal');
      }
    });
  }

  redirectResultados(id) {
    sessionStorage.setItem('projectID', id);
    this.router.navigateByUrl('resultados');
  }

  updateMaterial(id, section) {
    localStorage.setItem('idProyectoConstrucción', id);
    this.selectionService.setSection(section);
    this.router.navigateByUrl('materials-stage/update');
  }

  addProduction(id) {
    localStorage.setItem('idProyectoConstrucción', id);
    this.selectionService.clearSection();
    this.router.navigateByUrl('materials-stage/update');
  }

  updateConstruction(id, section) {
    localStorage.setItem('idProyectoConstrucción', id);
    this.selectionService.setSection(section);
    this.router.navigateByUrl('construction-stage/update');
  }

  addConstruction(id) {
    localStorage.setItem('idProyectoConstrucción', id);
    this.selectionService.clearSection();
    this.router.navigateByUrl('construction-stage/update');
  }

  updateEndLife(id, section) {
    localStorage.setItem('idProyectoConstrucción', id);
    this.selectionService.setSection(section);
    this.router.navigateByUrl('end-life-stage/update');
  }

  addEndLife(id) {
    localStorage.setItem('idProyectoConstrucción', id);
    this.selectionService.clearSection();
    this.router.navigateByUrl('end-life-stage/update');
  }

  updateUso(id) {
    localStorage.setItem('idProyectoConstrucción', id);
    this.router.navigateByUrl('usage-stage/update');
  }

  getSelectedImpactName(value: any): string {
    const selected = this.catologoImpactoAmbiental.find(option => option.name_complete_potential_type === value);
    return selected ? selected.name_complete_potential_type : '';
  }
}
