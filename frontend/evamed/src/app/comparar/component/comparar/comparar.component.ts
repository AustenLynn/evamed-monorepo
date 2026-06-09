import { Component } from '@angular/core';
import {
  OnInit,
  ViewChildren,
  ViewChild,
  QueryList,
  ViewContainerRef,
} from '@angular/core';

import { BarChartSimpleComponent } from 'src/app/bar-chart-simple/bar-chart-simple.component';
import { BarChartComponent } from 'src/app/bar-chart/bar-chart.component';
import { PieChartComponent } from 'src/app/pie-chart/pie-chart.component';
import { RadialChartComponent } from 'src/app/radial-chart/radial-chart.component';
import { ImageEdificioComponent } from '../../../image-edificio/image-edificio.component';

import { GraficasTercerSeccionComponent } from '../../component/graficas-tercer-seccion/graficas-tercer-seccion.component';
import { ProjectsService } from './../../../core/services/projects/projects.service';
import { MaterialsService } from './../../../core/services/materials/materials.service';
import { AnalisisService } from './../../../core/services/analisis/analisis.service';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import {
  animate,
  state,
  style,
  transition,
  trigger,
} from '@angular/animations';
import { Calculos } from '../../../calculos/calculos';
import { CalculosSegundaSeccion } from 'src/app/calculos/calculos-segunda-seccion';
import { CalculosTercerSeccion } from 'src/app/calculos/calculos-tercer-seccion';
import { UserService } from 'src/app/core/services/user/user.service';
//import { createThis } from 'typescript';

@Component({
    selector: 'app-comparar',
    templateUrl: './comparar.component.html',
    styleUrls: ['./comparar.component.scss', './styleSU.scss', './styleSD.scss', './styleST.scss'],
    animations: [
        trigger('detailExpand', [
            state('collapsed', style({ height: '0px', minHeight: '0' })),
            state('expanded', style({ height: '*' })),
            transition('expanded <=> collapsed', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)')),
        ]),
    ],
    standalone: false
})

export class CompararComponent implements OnInit {
  barChartComponent = BarChartComponent;
  radialChartComponent = RadialChartComponent;
  pieChartComponent = PieChartComponent;
  barChartSimpleComponent = BarChartSimpleComponent;
  graficasTercerSeccionComponent = GraficasTercerSeccionComponent;
  imgEdificioComponent = ImageEdificioComponent;

  @ViewChild('barContainer', { read: ViewContainerRef })
  container: ViewContainerRef;
  @ViewChild('barGraphDos', { read: ViewContainerRef })
  containerBarGrafica: ViewContainerRef;
  @ViewChild('barGraphTres', { read: ViewContainerRef })
  containerGraficaT: ViewContainerRef;
  @ViewChild('GraficasEspecificas', { read: ViewContainerRef })
  containerGraficas: ViewContainerRef;
  @ViewChild('GraficasEspecificasDos', { read: ViewContainerRef })
  containerGraficasDos: ViewContainerRef;
  @ViewChild('elementosCicloConteiner', { read: ViewContainerRef })
  containerElementosCiclo: ViewContainerRef;
  @ViewChild('dispercionImpactoConteiner', { read: ViewContainerRef })
  containerDispercionImpacto: ViewContainerRef;
  @ViewChild('imgEdificio', { read: ViewContainerRef })
  containerImgEdificio: ViewContainerRef;

  @ViewChildren(BarChartComponent)
  childBar: QueryList<BarChartComponent>;
  @ViewChildren(PieChartComponent)
  childPie: QueryList<PieChartComponent>;
  @ViewChildren(RadialChartComponent)
  childRadar: QueryList<RadialChartComponent>;
  @ViewChildren(BarChartSimpleComponent)
  childBarSimple: QueryList<BarChartSimpleComponent>;
  selector = 'Ninguno';
  bandera: number;
  showVar = false;
  showVar_1 = false;
  ID = ' ';
  proyecto = { nombre: ' ', num_epic: 0, num_epd: 0 };
  banderaGrapg = 0;
  proyect = [];
  proyect_active = [];
  inputproyect_bar_porcent: any;
  outproyect_bar = [];
  outproyect_radar = [];
  outproyect_pie = [];
  outproyect_bar_elementos = [];
  outproyect_pie_bar_elementos = [];
  indicador_impacto: string;
  hover = true;
  bandera_porcentaje = true;
  bandera_num = false;
  Impactos_menu = [];
  indicador_elegido = false;
  bandera_resultado = 0;
  show_elementos = true;
  Impactos_ambientales = true;
  Impactos_Elementos = false;
  Elementos_constructivos = false;
  show_Dispercion = false;
  selectedValue: string;
  seleccion_columna: any;
  delete_fase = true;
  bandera_por_metro = false;
  projectsList: any;
  materialList: [];
  materialSchemeDataList: [];
  materialSchemeProyectList: [];
  potentialTypesList: any;
  standarsList: [];
  CSEList: [];
  SIDList: [];
  SIList: [];
  ACRList: [];
  ECDList: [];
  TEDList: [];
  TEList: [];
  ULList: [];
  ECDPList: [];
  sectionList: [];
  materiales: [];
  PTList: [];
  DBList = [];
  conversionList: [];
  click_anterior: 'Ninguno';
  labelPosition: 'porcentaje' | 'numero' = 'porcentaje';
  proyectosMostrados_elementos = [];
  bandera_graph_bar = false;
  botones_elementos_constructivos = [];
  impacto_seleccionado = ' ';
  serie_Seleccionada: string;
  bandera_serie_Seleccionada = false;
  resultdosGraficos = true;
  resultdosTabla = false;
  DatosTabla = [];
  classBotones = 'boton-principal';
  fasesEliminadas = [];
  elementosContructivosEliminados = [];
  elementosContructivosEliminadosElementos = [];
  elementoContructivoSelecionado = ' ';
  iconosElementosConstrucivos = {};
  proyectosMostrados = [];
  idsIconosElementos = {};
  cargaElementos = false;
  imgSeleccionadaElemento = ' ';
  nombreProyectoElegidoSeleccionadoElementos = ' ';
  elementoSeleccionadoMostrado = ' ';
  impactoSeleccionadoElementoConstructivo = ' ';
  iconos = {
    Producción: 'visibility',
    Construccion: 'visibility',
    Uso: 'visibility',
    FinDeVida: 'visibility',
  };
  iconosCambioElementos = {
    Producción: 'visibility',
    Construccion: 'visibility',
    Uso: 'visibility',
    FinDeVida: 'visibility',
  };
  ciclosDeVidaIgnoradasElementos = [];
  idsImgEdificios = [];
  idProyectoSeleccionadoImagen = ' ';
  banderaTipoGraficaDispercion = true;
  infoTablaDispercion = [];
  displayedColumnsDispercion: string[] = [
    'no',
    'material',
    'porcentaje',
    'numero',
  ];
  colorGraficaDispercion = ' ';
  nivelesExistententesElementosConstructivos = [];
  coloresExistententesElementosConstructivos = [];
  impactoSeleccionadoElementoConstructivoGrafica = null;
  banderaAjusteElememtos = false;
  catologoImpactoAmbiental = [];
  elementosConstructivosMostradosElementos = {};
  elementosConstructivosMostradosElementosPorProyecto = {};
  cicloVidaSeleccionadoElemento = ' ';
  flagMaterialesDispercion = true;
  flagSinMaterialesDispercion = false;
  estadoTercerSeccion = {};
  unidadImpactoAmientalTabla = '';
  idsImpactosAmbientales = {};
  //basesDatos={'EDPs':true,'EPic':false,'MEX':false}
  basesDatos = {};
  selectionsByProject: { [projectId: number]: any[] } = {};
  toppingList: string[] = [
    'Extra cheese',
    'Mushroom',
    'Onion',
    'Pepperoni',
    'Sausage',
    'Tomato',
  ];

  // vars analisis
  idProyectoActivo: number;
  botones_grafica_activos = false;
  columnsToDisplay = [];
  impactoAmbientalSeleccionado: string;

  constructor(
    private materials: MaterialsService,
    private projects: ProjectsService,
    private analisis: AnalisisService,
    private router: Router,
    private users: UserService,
    private calculos: Calculos,
    private calculosSegunaSeccion: CalculosSegundaSeccion,
    private calculosTercerSeccion: CalculosTercerSeccion,
  ) {
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
          });
        });
      });
    forkJoin([
      this.analisis.getTypeEnergy(),
      this.materials.getMaterials(),
      this.analisis.getMaterialSchemeData(),
      this.analisis.getMaterialSchemeProyect(),
      this.analisis.getPotentialTypes(),
      this.analisis.getStandars(),
      this.analisis.getConstructiveSystemElement(),
      this.analisis.getSourceInformationData(),
      this.analisis.getSourceInformation(),
      this.analisis.getAnnualConsumptionRequired(),
      this.analisis.getElectricityConsumptionData(),
      this.analisis.getTypeEnergyData(),
      this.analisis.getUsefulLife(),
      this.analisis.getECDP(),
      this.analisis.getSectionsList(),
      this.analisis.getMaterials(),
      this.analisis.getPotentialTransport(),
      this.analisis.getConversion(),
      this.analisis.getDB(),
    ]).subscribe(
      ([
        TE,
        materialData,
        materialSchemeData,
        materialSchemeProyect,
        potentialTypes,
        standards,
        CSE,
        SID,
        SI,
        ACR,
        ECD,
        TED,
        UL,
        ECDP,
        sectionsList,
        materiales,
        PT,
        conversions,
        DB,
      ]) => {
        this.materialList = materialData;
        this.materialSchemeDataList = materialSchemeData;
        this.materialSchemeProyectList = materialSchemeProyect;
        this.potentialTypesList = potentialTypes;
        const aux = this.calculos.FiltradoDeImpactos(potentialTypes);
        this.catologoImpactoAmbiental = aux;
        this.llenarIdsBotonesImpactos(aux);
        this.selectedValue =
          this.catologoImpactoAmbiental[0]['name_complete_potential_type'];
        this.impactoAmbientalSeleccionado = this.calculos.ajustarNombre(
          this.catologoImpactoAmbiental[0]['name_complete_potential_type']
        );
        this.standarsList = standards;
        this.CSEList = CSE;
        this.SIDList = SID;
        this.SIList = SI;
        this.ACRList = ACR;
        this.ECDList = ECD;
        this.TEDList = TED;
        this.TEList = TE;
        this.ULList = UL;
        this.ECDPList = ECDP;
        this.sectionList = sectionsList;
        this.materiales = materiales;
        this.PTList = PT;
        this.conversionList = conversions;
        this.botones_elementos_constructivos = sectionsList;
        this.BDInicio(DB);
        this.llenarIdsBotones(sectionsList);
        this.idProyectoActivo = parseInt(sessionStorage.getItem('projectID'));
        this.columnsToDisplay = this.calculos.ImpactosSeleccionados(
          this.potentialTypesList
        );
        this.menu_inicio();
      }
    );
  }

  ngOnInit(): void {
    // Trigger database "selection"
    this.ajusteUsoBaseDatos(this.DBList);
  }

  //Regreso a la página de inicio
  returnHome() {
    this.router.navigateByUrl('home-evamed');
  }

  goToMaterialStage() {
    localStorage.setItem('idProyectoConstrucción', this.idProyectoActivo.toString());
    this.router.navigateByUrl('materials-stage/update');
  }

  editProject(id: number) {
    localStorage.setItem('idProyectoConstrucción', id.toString());
    this.router.navigateByUrl('materials-stage/update');
  }

  //ids Necesarios para modificar en html
  llenarIdsBotonesImpactos(catalogo) {
    this.idsImpactosAmbientales = { idsCiclo: [], idsElementos: [] };
    catalogo.forEach(impacto => {
      const auxIDCiclo = impacto['id'].toString().concat('LineaImpactoCiclo'),
        auxIDElementos = impacto['id']
        .toString()
        .concat('LineaImpactoElememtos');
      this.idsImpactosAmbientales['idsCiclo'].push(auxIDCiclo);
      this.idsImpactosAmbientales['idsElementos'].push(auxIDElementos);
      //this.idsImpactosAmbientales['respuesta'].push(impacto['id'])
    });
  }

  //inicio de Base de datos que se consideran para los calculos
  BDInicio(listaBD) {
    this.DBList = [];
    this.basesDatos = {};
    listaBD.forEach(element => {
      this.DBList.push(element['name']);
      this.basesDatos[element['name']] = true;
    });
  }

  //eliminar fase de ciclo de visa y redistribución;
  ajusteDeGraficaFASE(fase: string) {
    if (this.fasesEliminadas.includes(fase)) {
      this.fasesEliminadas.forEach((element, index) => {
        if (element == fase) {
          this.fasesEliminadas.splice(index, 1);
          document.getElementById(fase.concat('Ojo')).className = 'boton-icono';
          this.iconos[fase] = 'visibility';
        }
      });
    } else {
      this.iconos[fase] = 'visibility_off';
      document.getElementById(fase.concat('Ojo')).className =
        'boton-ojito-select';
      this.fasesEliminadas.push(fase);
    }
    this.outproyect_bar = [];
    this.proyect_active.forEach(element => {
      const data = this.llamarCalculos(element),
        analisis = this.getAnalisisBarras(element, data);
      this.outproyect_bar.push(analisis);
    });
    this.fasesEliminadas.forEach(value => {
      this.outproyect_bar.forEach((proyecto, index) => {
        const indicadores = Object.keys(proyecto.Datos);
        indicadores.forEach(element => {
          delete this.outproyect_bar[index].Datos[element][value];
        });
      });
    });
    if (this.resultdosGraficos) {
      this.iniciaBarras();
    } else {
      this.TablaResultados();
    }
  }

  //agregar proyecto a graficas

  private refreshProjectSelections(id: number): void {
    this.materials.getMaterialsStageSelections(id).pipe(
      catchError(() => of({ items: [] }))
    ).subscribe(response => {
      this.selectionsByProject[id] = response?.items || [];

      const data = this.llamarCalculos(id),
        analisis = this.getAnalisisBarras(id, data),
        analisisRad = this.getAnalisisRadial(id, data),
        analisisPie = this.getAnalisisPie(id, data),
        analisisBarDos = this.getAnalisisBarrasElementosConstructivos(id),
        analisisPieBarDos = this.getAnalisisPieBarSegunaSeccion(id),
        analisisPieTres = this.getAnalisisElementos(id);

      const barIdx = this.outproyect_bar.findIndex((e: any) => e.id == id);
      if (barIdx >= 0) this.outproyect_bar[barIdx] = analisis;
      const radIdx = this.outproyect_radar.findIndex((e: any) => e.id == id);
      if (radIdx >= 0) this.outproyect_radar[radIdx] = analisisRad;
      const pieIdx = this.outproyect_pie.findIndex((e: any) => e.id == id);
      if (pieIdx >= 0) this.outproyect_pie[pieIdx] = analisisPie;
      const barDosIdx = this.outproyect_bar_elementos.findIndex((e: any) => e.id == id);
      if (barDosIdx >= 0) this.outproyect_bar_elementos[barDosIdx] = analisisBarDos;
      const pieBarDosIdx = this.outproyect_pie_bar_elementos.findIndex((e: any) => e.id == id);
      if (pieBarDosIdx >= 0) this.outproyect_pie_bar_elementos[pieBarDosIdx] = analisisPieBarDos;
      const elemIdx = this.proyectosMostrados_elementos.findIndex((e: any) => e.idproyecto == id);
      if (elemIdx >= 0) this.proyectosMostrados_elementos[elemIdx].data = analisisPieTres;

      if (this.resultdosTabla) {
        this.TablaResultados();
      } else {
        this.iniciaBarras();
      }
      if (this.Impactos_Elementos) {
        this.iniciaBarrasSeccionDos();
      }
      if (this.Elementos_constructivos) {
        this.iniciarSeccionTres();
      }
    });
  }

  iniciar_graficas(id: number) {
    if (this.proyect_active.some(item => item == id)) {
      this.refreshProjectSelections(id);
      return;
    }
    this.proyect_active.push(id);
    this.idsImgEdificios.push(id.toString().concat('imagen'));

    if (this.proyect_active.length > 1) {
      this.banderaAjusteElememtos = true;
    }

    this.materials.getMaterialsStageSelections(id).pipe(
      catchError(() => of({ items: [] }))
    ).subscribe(response => {
      this.selectionsByProject[id] = response?.items || [];

      const data = this.llamarCalculos(id),

      analisis = this.getAnalisisBarras(id, data),
      analisisRad = this.getAnalisisRadial(id, data),
      analisisPie = this.getAnalisisPie(id, data),
      analisisBarDos = this.getAnalisisBarrasElementosConstructivos(id),
      analisisPieBarDos = this.getAnalisisPieBarSegunaSeccion(id),
      analisisPieTres = this.getAnalisisElementos(id);

      this.proyect.forEach((proyecto, index) => {
        if (proyecto.id == id && proyecto.id != this.idProyectoActivo) {
          this.proyect[index].num_epic = this.calculos.materiales_EPIC;
          this.proyect[index].num_epd = this.calculos.materiales_EPD;
          this.proyect[index].card = true;
          this.proyectosMostrados = [
            ...this.proyectosMostrados,
            {
              num: this.proyect_active.length,
              Nombre: this.proyect[index].Nombre,
              id: this.proyect[index].id,
            },
          ];
        }
      });

      this.banderaAjusteElememtos = false;
      this.outproyect_bar.push(analisis);
      this.outproyect_radar.push(analisisRad);
      this.outproyect_pie.push(analisisPie);
      this.outproyect_bar_elementos.push(analisisBarDos);
      this.outproyect_pie_bar_elementos.push(analisisPieBarDos);

      if(this.Impactos_ambientales) {
        //elementos de la dección 1
        if (this.ID != ' ') {
          document.getElementById(this.ID).className = 'boton-principal';
        }
      }
      if (this.resultdosTabla) {
        this.TablaResultados();
      } else {
        this.iniciaBarras();
      }
      if (this.Impactos_Elementos) {
        //elementos de la sección 2
        this.iniciaBarrasSeccionDos();
        if(this.imgSeleccionadaElemento != ' ') {
          this.DispercionAP(this.imgSeleccionadaElemento, ' ');
        }
        Object.keys(this.iconosElementosConstrucivos).forEach(element => {
          if(this.iconosElementosConstrucivos[element]['habilitado'] === false) {
            document.getElementById(this.idsIconosElementos[element]['idTEXTO']).className = 'espacio-sin-selecciomar';
          }
        })
        this.catologoImpactoAmbiental.forEach(impacto => {
          const auxID = impacto['id'].toString().concat('LineaImpactoElememtos'),
            elementosflag = document.getElementById(auxID);
          if (elementosflag != null) {
            elementosflag.className = 'dot';
          }
        });
        this.graficabar(null);
      }
      this.containerGraficas.clear();
      this.receiveSelector(null);
      this.banderaGrapg = 0;

      this.proyectosMostrados_elementos = [
        ...this.proyectosMostrados_elementos,
        {
          idproyecto: id,
          nombre: analisis.Nombre,
          data: analisisPieTres,
        },
      ];
      this.estadoTercerSeccion[id] = {
        agruparProduccion: false,
        cicloSeleccionado: ' ',
        flagPie: true,
        fragBar: false,
      };

      if (this.Elementos_constructivos) {
        this.iniciarSeccionTres();
      }
      this.showVar = false;
      this.showVar_1 = false;
      this.banderaGrapg = 0;
    });
  }

  private getFilteredScheme(idProyecto: number): any[] {
    const selections: any[] = this.selectionsByProject[idProyecto] ?? [];
    const deselectedKeys = new Set(
      selections
        .filter(s => s.is_selected === false)
        .map(s => `${s.label}:${s.origin_id ?? 'null'}`)
    );
    if (deselectedKeys.size === 0) return this.materialSchemeProyectList;
    return (this.materialSchemeProyectList as any[]).filter(item => {
      if (item.project_id != idProyecto) return true;
      const key = `${item.construction_system}:${item.origin_id ?? 'null'}`;
      return !deselectedKeys.has(key);
    });
  }

  iniciaBarras() {
    if (this.resultdosGraficos) {
      this.container.clear();
      const grafica = this.container.createComponent(this.barChartComponent);
      grafica.instance.porcentaje = this.bandera_porcentaje;
      grafica.instance.inputProyects = this.outproyect_bar;
      grafica.instance.showMe = true;
      grafica.instance.Bandera_bar = false;
      grafica.instance.Columna_seleccionada = this.selector;
      grafica.instance.banera_enfoqueSerie_externo =
        this.bandera_serie_Seleccionada;
      grafica.instance.serie_input = this.serie_Seleccionada;
      grafica.instance.impactos = this.potentialTypesList;
      grafica.instance.lastClickEvent.subscribe(e => this.receiveSelector(e));
    }
  }

  iniciarImgEdificio() {
    this.containerImgEdificio.clear();
    const containers = {}
    this.proyect_active.forEach((proyecto, index) => {
      //console.log(this.elementosConstructivosMostradosElementosPorProyecto[proyecto]);
      const auxN = 'imgEdificio'.concat(proyecto);
      containers[auxN] = this.containerImgEdificio.createComponent(this.imgEdificioComponent);
      containers[auxN].instance.inputPtoyect = this.coloresExistententesElementosConstructivos;
      containers[auxN].instance.elementoSeleccionado = this.elementoContructivoSelecionado;
      containers[auxN].instance.niveles = this.nivelesExistententesElementosConstructivos;
      containers[auxN].instance.idImg = this.idsImgEdificios[index];
      containers[auxN].instance.idP = this.proyect_active[index];
      containers[auxN].instance.impactoSeleccionado = this.impactoSeleccionadoElementoConstructivoGrafica;
      containers[auxN].instance.nivelesProyect = this.elementosConstructivosMostradosElementosPorProyecto[proyecto];
      containers[auxN].instance.seleccion.subscribe(e => this.recepcionAP(e));
    })
    /**
     const imgEdificioC = this.containerImgEdificio.createComponent(componentFactory);
     imgEdificioC.instance.inputPtoyect = this.coloresExistententesElementosConstructivos;
     imgEdificioC.instance.elementoSeleccionado = this.elementoContructivoSelecionado;
     imgEdificioC.instance.niveles = this.nivelesExistententesElementosConstructivos;
     imgEdificioC.instance.idImg = this.idsImgEdificios[0];
     imgEdificioC.instance.idP = this.proyect_active[0];
     imgEdificioC.instance.impactoSeleccionado = this.impactoSeleccionadoElementoConstructivoGrafica;
     imgEdificioC.instance.seleccion.subscribe((e) => this.recepcionAP(e));
     */
    //const imfEdificioCDOS = this.containerImgEdificio.createComponent(componentFactory);
    //imfEdificioCDOS.instance.inputPtoyect = 2;

  }

  //creación de gráfica de barras para la sección de impactos ambientales por
  //elementos onstructivos
  iniciaBarrasSeccionDos() {
    this.containerBarGrafica.clear();
    const grafica = this.containerBarGrafica.createComponent(this.barChartComponent);
    grafica.instance.inputProyects = this.outproyect_bar_elementos;
    grafica.instance.showMe = false;
    grafica.instance.Bandera_bar = this.bandera_graph_bar;
    grafica.instance.porcentaje = true;
    grafica.instance.elementoConstructivo = this.elementoContructivoSelecionado;
    grafica.instance.impactoAmbiental =
      this.impactoSeleccionadoElementoConstructivoGrafica;
    grafica.instance.ClickEvent.subscribe(e => this.receiveSelectorDos(e));
  }

  iniciarSeccionTres() {
    this.containerGraficaT.clear();
    const grafica = this.containerGraficaT.createComponent(this.graficasTercerSeccionComponent);
    grafica.instance.impactoAmbientalMostrado =
      this.impactoAmbientalSeleccionado;
    grafica.instance.ElementosContructivosEliminados =
      this.elementosContructivosEliminadosElementos;
    grafica.instance.FaseSeleccionada = this.cicloVidaSeleccionadoElemento;
    grafica.instance.FasesEliminadas = this.ciclosDeVidaIgnoradasElementos;
    grafica.instance.inputProyect = this.proyectosMostrados_elementos;
    grafica.instance.materiales = this.materialList;
    grafica.instance.Secciones = this.sectionList;
    grafica.instance.EstadoSeccion = this.estadoTercerSeccion;
    grafica.instance.unidades = this.potentialTypesList;
    grafica.instance.CambioEstadoTercerSeccion.subscribe(e =>
      this.cambioEstadoTercerSeccion(e)
    );
  }

  iniciaRadiales() {
    this.containerGraficas.clear();
    const grafica = this.containerGraficas.createComponent(this.radialChartComponent);
    grafica.instance.inputProyect = this.outproyect_radar;
    grafica.instance.showMe = this.showVar_1;
    grafica.instance.id = this.ID;
    grafica.instance.impactos = this.potentialTypesList;
  }
  iniciaPie() {
    this.containerGraficas.clear();
    const grafica = this.containerGraficas.createComponent(this.pieChartComponent);
    grafica.instance.inputProyect = this.outproyect_pie;
    grafica.instance.showMePartially = this.showVar;
    grafica.instance.indicador = this.selector;
    grafica.instance.id = this.ID;
    grafica.instance.Bandera_resultado = 2;
    grafica.instance.unidades = this.potentialTypesList;
  }

  llamarCalculosTercerSeccion(idProyecto) {
    const DatosCalculos = {
      TEList: this.TEList,
      projectsList: this.projectsList,
      materialList: this.materialList,
      materialSchemeDataList: this.materialSchemeDataList,
      materialSchemeProyectList: this.getFilteredScheme(idProyecto),
      potentialTypesList: this.potentialTypesList,
      standarsList: this.standarsList,
      CSEList: this.CSEList,
      SIDList: this.SIDList,
      SIList: this.SIList,
      ACRList: this.ACRList,
      ECDList: this.ECDList,
      TEDList: this.TEDList,
      ULList: this.ULList,
      ECDPList: this.ECDPList,
      sectionList: this.sectionList,
      PTList: this.PTList,
      conversionList: this.conversionList,
    },
     aux =
      this.calculosTercerSeccion.OperacionesDeFasePorElementoConstructivoCicloVida(
        idProyecto,
        DatosCalculos,
        this.basesDatos
      );
    //console.log(aux)
    return aux;
  }

  getAnalisisElementos(idProyecto) {
    return this.llamarCalculosTercerSeccion(idProyecto);
  }

  llamarCalculos(idProyecto) {
    const DatosCalculos = {
      TEList: this.TEList,
      projectsList: this.projectsList,
      materialList: this.materialList,
      materialSchemeDataList: this.materialSchemeDataList,
      materialSchemeProyectList: this.getFilteredScheme(idProyecto),
      potentialTypesList: this.potentialTypesList,
      standarsList: this.standarsList,
      CSEList: this.CSEList,
      SIDList: this.SIDList,
      SIList: this.SIList,
      ACRList: this.ACRList,
      ECDList: this.ECDList,
      TEDList: this.TEDList,
      ULList: this.ULList,
      ECDPList: this.ECDPList,
      sectionList: this.sectionList,
      PTList: this.PTList,
      conversionList: this.conversionList,
    },

     auxdata = this.calculos.OperacionesDeFase(
      idProyecto,
      DatosCalculos,
      this.basesDatos
    ),
     auxDatos = auxdata[0];
    return auxDatos;
  }

  getAnalisisBarras(idProyecto, data) {
    //Creación de espacio para guardar los datos del proyecto
    const analisisProyectos: Record<string, any> = {
      Nombre: this.projectsList.filter(p => p['id'] == idProyecto)[0][
        'name_project'
      ],
      id: idProyecto,
      Datos: {},
    },

     auxDatos = data;
    Object.keys(auxDatos).forEach(impacto => {
      analisisProyectos.Datos[impacto] = {};
      Object.keys(auxDatos[impacto]).forEach(fase => {
        analisisProyectos.Datos[impacto][fase] = 0;
        Object.keys(auxDatos[impacto][fase]).forEach(subetapa => {
          analisisProyectos.Datos[impacto][fase] =
            analisisProyectos.Datos[impacto][fase] +
            auxDatos[impacto][fase][subetapa];
        });
        if (this.bandera_por_metro) {
          let superficieConstruida = 0;
          if (fase === 'Uso') {
            superficieConstruida = this.calculos.projectsList.filter(
              p => p['id'] == idProyecto
            )[0]['living_area'];
          } else {
            superficieConstruida = this.calculos.projectsList.filter(
              p => p['id'] == idProyecto
            )[0]['builded_surface'];
          }
          analisisProyectos.Datos[impacto][fase] =
            analisisProyectos.Datos[impacto][fase] / superficieConstruida;
        }
      });
    });
    return analisisProyectos;
  }

  getAnalisisRadial(idProyecto, data) {
    const analisisProyectos: Record<string, any> = {
      Nombre: this.calculos.projectsList.filter(
        p => p['id'] == idProyecto
      )[0]['name_project'],
      id: idProyecto,
      Datos: {},
    },

     auxDatos = data,
      auxFases = [];
    Object.keys(auxDatos).forEach(impacto => {
      Object.keys(auxDatos[impacto]).forEach(fase => {
        if (!auxFases.includes(fase)) {
          auxFases.push(fase);
          analisisProyectos.Datos[fase] = {};
        }
        analisisProyectos.Datos[fase][impacto] = 0;
        Object.keys(auxDatos[impacto][fase]).forEach(subetapa => {
          analisisProyectos.Datos[fase][impacto] =
            analisisProyectos.Datos[fase][impacto] +
            auxDatos[impacto][fase][subetapa];
        });
        if (this.bandera_por_metro) {
          let superficieConstruida = 0;
          if (fase === 'Uso') {
            superficieConstruida = this.calculos.projectsList.filter(
              p => p['id'] == idProyecto
            )[0]['living_area'];
          } else {
            superficieConstruida = this.calculos.projectsList.filter(
              p => p['id'] == idProyecto
            )[0]['builded_surface'];
          }
          analisisProyectos.Datos[fase][impacto] =
            analisisProyectos.Datos[fase][impacto] / superficieConstruida;
        }
      });
    });
    return analisisProyectos;
  }

  getAnalisisPie(idProyecto, data) {
    const analisisProyectos: Record<string, any> = {
      Nombre: this.calculos.projectsList.filter(
        p => p['id'] == idProyecto
      )[0]['name_project'],
      id: idProyecto,
      Datos: {},
    },

     auxDatos = data;
    Object.keys(auxDatos).forEach(impacto => {
      const impacto_ambiental = impacto.replace(/\n/g, ' ');
      analisisProyectos.Datos[impacto_ambiental] = {};
      Object.keys(auxDatos[impacto]).forEach(fase => {
        analisisProyectos.Datos[impacto_ambiental][fase] =
          auxDatos[impacto][fase];
        if (this.bandera_por_metro) {
          let superficieConstruida = 0;
          if (fase === 'Uso') {
            superficieConstruida = this.calculos.projectsList.filter(
              p => p['id'] == idProyecto
            )[0]['living_area'];
          } else {
            superficieConstruida = this.calculos.projectsList.filter(
              p => p['id'] == idProyecto
            )[0]['builded_surface'];
          }
          Object.keys(analisisProyectos.Datos[impacto_ambiental][fase]).forEach(
            subetapa => {
              analisisProyectos.Datos[impacto_ambiental][fase][subetapa] =
                analisisProyectos.Datos[impacto_ambiental][fase][subetapa] /
                superficieConstruida;
            }
          );
        }
      });
    });

    return analisisProyectos;
  }

  getAnalisisPieBarSegunaSeccion(idProyecto) {
    //Calculos y obtención de datos para crear correctamente las gráficas de barras
    const analisisProyectos: Record<string, any> = {
      Nombre: this.calculos.projectsList.filter(
        p => p['id'] == idProyecto
      )[0]['name_project'],
      id: idProyecto,
      Datos: {},
    },
     auxData = {},
      auxDatosDos = this.llamarCalculosTercerSeccion(idProyecto);
    Object.keys(auxDatosDos['materiales']).forEach(impactoAmbiental => {
      auxData[impactoAmbiental] = {};
      const seccionesCreadas = [],
        materialSeccion = {};
      Object.keys(auxDatosDos['materiales'][impactoAmbiental]).forEach(
        cicloVida => {
          Object.keys(
            auxDatosDos['materiales'][impactoAmbiental][cicloVida]
          ).forEach(subEtapa => {
            Object.keys(
              auxDatosDos['materiales'][impactoAmbiental][cicloVida][subEtapa]
            ).forEach(seccion => {
              if (!seccionesCreadas.includes(seccion)) {
                auxData[impactoAmbiental][seccion] = {};
                materialSeccion[seccion] = [];
                seccionesCreadas.push(seccion);
              }
              Object.keys(
                auxDatosDos['materiales'][impactoAmbiental][cicloVida][
                  subEtapa
                ][seccion]
              ).forEach(material => {
                if (!materialSeccion[seccion].includes(material)) {
                  auxData[impactoAmbiental][seccion][material] = 0;
                  materialSeccion[seccion].push(material);
                }
                auxData[impactoAmbiental][seccion][material] +=
                  auxDatosDos['materiales'][impactoAmbiental][cicloVida][
                    subEtapa
                  ][seccion][material];
              });
            });
          });
        }
      );
    });
    analisisProyectos['Datos'] = auxData;
    return analisisProyectos;
  }

  AjustePorMetro(flag) {
    this.outproyect_bar = [];
    this.outproyect_pie = [];
    this.outproyect_radar = [];
    this.fasesEliminadas = [];
    this.proyect_active.forEach(id => {
      if (flag == 0) {
        this.bandera_por_metro = true;
      } else {
        this.bandera_por_metro = false;
      }

      const data = this.llamarCalculos(id),

        analisis = this.getAnalisisBarras(id, data),
        analisisRad = this.getAnalisisRadial(id, data),
        analisisPie = this.getAnalisisPie(id, data);

      this.outproyect_bar.push(analisis);
      this.outproyect_radar.push(analisisRad);
      this.outproyect_pie.push(analisisPie);
    });

    if (this.resultdosGraficos) {
      this.containerGraficas.clear();
      this.receiveSelector(null);
      this.ID = ' ';
      this.iniciaBarras();
    } else {
      this.TablaResultados();
    }
  }

  //creación de tabla de resultado
  TablaResultados() {
    this.botones_grafica_activos = true;
    this.container.clear();
    const auxL = ['Producción', 'Construccion', 'Uso', 'FinDeVida'],
      aux_color = ['#4DBE89', '#148A93', '#8F5091', '#DEA961', '#767676'];
    //se prepara la información por filas
    let aux = [],
      flagMasProyectos = false;
    const auxtotal = {},
      auxImpactosTotal = {};
    this.outproyect_bar.forEach(element => {
      auxtotal[element.id] = {};
      auxImpactosTotal[element.id] = [];
      Object.keys(element.Datos).forEach(impacto => {
        const auxNombreImpacto = impacto.replace(/\n/g, '');
        if (!auxImpactosTotal[element.id].includes(auxNombreImpacto)) {
          auxtotal[element.id][auxNombreImpacto] = 0;
          auxImpactosTotal[element.id].push(auxNombreImpacto);
        }
      });
    });
    auxL.forEach((ciclo, index) => {
      let auxdata = {},
       auximpactos = [];
      auxdata['ciclo de vida'] = ciclo;
      let flagCiclo = true;
      this.fasesEliminadas.forEach(cicloEliminado => {
        if (ciclo === cicloEliminado) {
          flagCiclo = false;
        }
      });
      if (flagCiclo) {
        this.outproyect_bar.forEach(element => {
          Object.keys(element.Datos).forEach(impacto => {
            const auxNombreImpacto = impacto.replace(/\n/g, ''),
             resultado = element.Datos[impacto][ciclo],
              resultadoExponencial = resultado.toExponential(2);
            if (!auximpactos.includes(auxNombreImpacto)) {
              auximpactos.push(auxNombreImpacto);
              auxdata[auxNombreImpacto] = resultadoExponencial
                .toString()
                .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
              auxtotal[element.id][auxNombreImpacto] += resultado;
            } else {
              flagMasProyectos = true;
              const last = auxdata[auxNombreImpacto].toString();
              auxdata[auxNombreImpacto] = last.concat(
                '\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0'
              );
              auxdata[auxNombreImpacto] = auxdata[auxNombreImpacto].concat(
                resultadoExponencial
                  .toString()
                  .replace(/\B(?=(\d{3})+(?!\d))/g, ',')
              );
              auxtotal[element.id][auxNombreImpacto] += resultado;
            }
          });
        });
        auximpactos = [];
        aux = [...aux, { data: auxdata, color: aux_color[index] }];
      }
      if (ciclo === 'FinDeVida') {
        auxdata = {};
        Object.keys(auxtotal).forEach((element, indexproyectos) => {
          if (indexproyectos == 0) {
            Object.keys(auxtotal[element]).forEach(impacto => {
              const resultado = auxtotal[element][impacto],
                resultadoExponencial = resultado.toExponential(2);
              auxdata[impacto] = resultadoExponencial;
            });
          } else {
            Object.keys(auxtotal[element]).forEach(impacto => {
              const resultado = auxtotal[element][impacto],
                resultadoExponencial = resultado.toExponential(2),
                last = auxdata[impacto].toString();
              auxdata[impacto] = last.concat(
                '\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0'
              );
              auxdata[impacto] = auxdata[impacto].concat(
                resultadoExponencial
                  .toString()
                  .replace(/\B(?=(\d{3})+(?!\d))/g, ',')
              );
            });
          }
        });
        auxdata['ciclo de vida'] = 'Total';
        aux = [...aux, { data: auxdata, color: aux_color[index + 1] }];
      }
      if (ciclo === 'FinDeVida' && flagMasProyectos == true) {
        auxdata = {};
        let numProyecto = 0;
        this.outproyect_bar.forEach(element => {
          numProyecto = numProyecto + 1;
          Object.keys(element.Datos).forEach(impacto => {
            const auxNombreImpacto = impacto.replace(/\n/g, '');
            if (!auximpactos.includes(auxNombreImpacto)) {
              auximpactos.push(auxNombreImpacto);
              auxdata[auxNombreImpacto] = numProyecto.toString();
            } else {
              const last = auxdata[auxNombreImpacto].toString();
              auxdata[auxNombreImpacto] = last.concat(
                '\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0'
              );
              auxdata[auxNombreImpacto] = auxdata[auxNombreImpacto].concat(
                numProyecto.toString()
              );
            }
          });
        });
        aux = [{ data: auxdata, color: aux_color[index + 1] }, ...aux];
      }
    });
    this.DatosTabla = aux;
    this.resultdosTabla = true;
    this.resultdosGraficos = false;
  }

  //regreso a gráfica
  GraficasResultados() {
    this.botones_grafica_activos = false;
    this.resultdosTabla = false;
    this.resultdosGraficos = true;
    this.iniciaBarras();
  }

  ajusteUsoBaseDatos(seleccion) {
    this.outproyect_bar = [];
    this.outproyect_pie = [];
    this.outproyect_radar = [];
    this.outproyect_bar_elementos = [];
    this.iconosElementosConstrucivos = {};
    this.outproyect_pie_bar_elementos = [];
    this.proyectosMostrados_elementos = [];
    this.estadoTercerSeccion = {};
    this.elementosConstructivosMostradosElementos = {};

    Object.keys(this.basesDatos).forEach(bd =>{
      let flag = false;
      seleccion.forEach(bdSelect => {
        if(bdSelect === bd) {
          flag = true;
        }
      });
      this.basesDatos[bd] = flag;
    });
    this.proyect_active.forEach(id => {
      const data = this.llamarCalculos(id),
        analisis = this.getAnalisisBarras(id, data),
        analisisRad = this.getAnalisisRadial(id, data),
        analisisPie = this.getAnalisisPie(id, data),
        analisisPieBarDos = this.getAnalisisPieBarSegunaSeccion(id),
        analisisPieTres = this.getAnalisisElementos(id);

      //sección uno
      this.outproyect_bar.push(analisis);
      this.outproyect_radar.push(analisisRad);
      this.outproyect_pie.push(analisisPie);
      //sección dos
      const analisisBarDos = this.getAnalisisBarrasElementosConstructivos(id);
      this.outproyect_bar_elementos.push(analisisBarDos);
      //sección tres
      this.outproyect_pie_bar_elementos.push(analisisPieBarDos);
      this.proyectosMostrados_elementos = [...this.proyectosMostrados_elementos, {
        idproyecto: id,
        nombre: analisis.Nombre,
        data: analisisPieTres,
      }];
      this.estadoTercerSeccion[id] = {
        'agruparProduccion': false,
        'cicloSeleccionado': " ",
        'flagPie': true,
        'fragBar': false
      }
    });
    //Se reinicia la sección 1
    if(this.Impactos_ambientales) {
      if(this.resultdosGraficos) {
        this.containerGraficas?.clear();
        this.receiveSelector(null);
        this.ID = ' ';
      }
    }
    if(this.resultdosGraficos) {
      this.iniciaBarras()
    } else{
      this.TablaResultados();
    }
    //se reinicia la sección 2
    if(this.Impactos_Elementos) {
      this.iniciaBarrasSeccionDos();
      if(this.imgSeleccionadaElemento != ' ') {
        this.DispercionAP(this.imgSeleccionadaElemento, ' ');
      }
      Object.keys(this.iconosElementosConstrucivos).forEach(element => {
        if(this.iconosElementosConstrucivos[element]['habilitado'] === false) {
          document.getElementById(this.idsIconosElementos[element]['idTEXTO']).className = 'espacio-sin-selecciomar';
        }
      })
      this.catologoImpactoAmbiental.forEach(impacto => {
        const auxID = impacto['id'].toString().concat('LineaImpactoElememtos'),
          elementosflag = document.getElementById(auxID);
        if (elementosflag != null) {
          elementosflag.className = 'dot';
        }
      });
      this.graficabar(null);
    }
    //se reinicia la sección tres
    if(this.Elementos_constructivos) {
      this.iniciarSeccionTres();
    }

  }

  //termino de cambio de sección
  finShow() {
    if(this.Impactos_ambientales) {
      const auxEtapas = ['Producción', 'Construccion', 'Uso', 'FinDeVida']
      if(this.ID === ' ') {
        auxEtapas.forEach(etapa =>{
          document.getElementById(etapa).className = 'boton-principal';
        })
      }
      if(this.selector == null) {
        this.catologoImpactoAmbiental.forEach(impacto => {
          const auxID = impacto['id'].toString().concat('LineaImpactoCiclo'),
            elementosflag = document.getElementById(auxID);
          if (elementosflag != null) {
            elementosflag.className = 'dot';
          }
        });
        this.containerGraficas.clear();
      }
    }
    if(this.Impactos_Elementos) {
      // this.impactoSeleccionadoElementoConstructivo != ' ' &&
      //this.elementoContructivoSelecionado != ' '
      if(this.imgSeleccionadaElemento === ' ') {
        this.idsImgEdificios.forEach(img=>{
          document.getElementById(img).className = 'edificio-individual';
        })
      }
      if(this.impactoSeleccionadoElementoConstructivo === ' ') {
        //this.show_Dispercion = false;
        this.catologoImpactoAmbiental.forEach(impacto => {
          const auxID = impacto['id'].toString().concat('LineaImpactoElememtos'),
            elementosflag = document.getElementById(auxID);
          if (elementosflag != null) {
            elementosflag.className = 'dot';
          }
        });
        this.graficabar(null);
      }
    }
  }

  //controlar la activación de elementos en la interacción con los tipos de resultados
  show($event) {
    if ($event == 0) {
      this.Impactos_ambientales = true;
      this.Impactos_Elementos = false;
      this.Elementos_constructivos = false;
      this.bandera_graph_bar = false;
      this.impacto_seleccionado = ' ';
    } else if ($event == 1) {
      this.Impactos_ambientales = false;
      this.Impactos_Elementos = true;
      this.Elementos_constructivos = false;
      this.bandera_graph_bar = true;
      this.iniciaBarrasSeccionDos();
      this.iniciarImgEdificio();
    } else {
      this.Impactos_ambientales = false;
      this.Impactos_Elementos = false;
      this.Elementos_constructivos = true;
      this.impacto_seleccionado = ' ';
      this.iniciarSeccionTres();
    }
    this.ResetTabs($event);
  }

  getAnalisisBarrasElementosConstructivos(idProyecto) {
    //Calculos y obtención de datos para crear correctamente las gráficas de barras
    const analisisProyectos: Record<string, any> = {
      Nombre: this.calculos.projectsList.filter(
        p => p['id'] == idProyecto
      )[0]['name_project'],
      id: idProyecto,
      Datos: {},
    },

     DatosCalculos = {
      TEList: this.TEList,
      projectsList: this.projectsList,
      materialList: this.materialList,
      materialSchemeDataList: this.materialSchemeDataList,
      materialSchemeProyectList: this.getFilteredScheme(idProyecto),
      potentialTypesList: this.potentialTypesList,
      standarsList: this.standarsList,
      CSEList: this.CSEList,
      SIDList: this.SIDList,
      SIList: this.SIList,
      ACRList: this.ACRList,
      ECDList: this.ECDList,
      TEDList: this.TEDList,
      ULList: this.ULList,
      ECDPList: this.ECDPList,
      sectionList: this.sectionList,
      PTList: this.PTList,
      conversionList: this.conversionList,
    },

     auxDatos =
      this.calculosSegunaSeccion.OperacionesDeFasePorElementoConstructivo(
        idProyecto,
        DatosCalculos,
        this.basesDatos
      );
    this.AjustarElementosMostrados(auxDatos);
    //console.log(this.iconosElementosConstrucivos)
    this.AjustarElementosMostradosElemntos(auxDatos);
    analisisProyectos['Datos'] = auxDatos;
    return analisisProyectos;
  }

  AjustarElementosMostrados(auxDatos) {
    if (this.elementoContructivoSelecionado != ' ') {
      const elementoDom = document.getElementById(
        'texto'.concat(this.elementoContructivoSelecionado)
      );
      if(elementoDom != null) {
        elementoDom.className = 'espacio-sin-selecciomar';
      }
    }
    this.impactoSeleccionadoElementoConstructivo = ' ';
    this.impactoSeleccionadoElementoConstructivoGrafica = null;
    this.elementoContructivoSelecionado = ' ';
    if (Object.keys(this.iconosElementosConstrucivos).length == 0) {
      this.sectionList.forEach(element => {
        //Aqui falta de que en caso de que se otro proyecto y tenga más o menos elementos que no cause problemas y se activen o desactiven bien los botones
        let flag = false;
        const auxidelemento: string = element['id'];
        Object.keys(auxDatos).forEach(impacto => {
          Object.keys(auxDatos[impacto]).forEach(idelemento => {
            if (idelemento == auxidelemento.toString() && auxDatos[impacto][idelemento] !== 0) {
              flag = true;
            }
          });
        });
        if (flag) {
          this.iconosElementosConstrucivos[auxidelemento.toString()] = {};
          this.iconosElementosConstrucivos[auxidelemento.toString()]['icono'] =
            'visibility';
          this.iconosElementosConstrucivos[auxidelemento.toString()][
            'habilitado'
          ] = false;
        } else {
          this.iconosElementosConstrucivos[auxidelemento.toString()] = {};
          this.iconosElementosConstrucivos[auxidelemento.toString()]['icono'] =
            'visibility_off';
          this.iconosElementosConstrucivos[auxidelemento.toString()][
            'habilitado'
          ] = true;
        }
      });
    }
    if (this.banderaAjusteElememtos) {
      this.sectionList.forEach(element => {
        //Aqui falta de que en caso de que se otro proyecto y tenga más o menos elementos que no cause problemas y se activen o desactiven bien los botones
        let flag = false;
        const auxidelemento: string = element['id'],
          auximpacto = this.calculosSegunaSeccion.ajustarNombre(
          this.potentialTypesList[0]['name_complete_potential_type']
        );
        Object.keys(auxDatos[auximpacto]).forEach(idelemento => {
          if (idelemento == auxidelemento.toString() && auxDatos[auximpacto][idelemento] !== 0) {
            flag = true;
          }
        });
        if (flag) {
          this.iconosElementosConstrucivos[auxidelemento.toString()] = {};
          this.iconosElementosConstrucivos[auxidelemento.toString()]['icono'] =
            'visibility';
          this.iconosElementosConstrucivos[auxidelemento.toString()][
            'habilitado'
          ] = false;
        }
      });
    }
  }

  AjustarElementosMostradosElemntos(auxDatos) {
    if (
      Object.keys(this.elementosConstructivosMostradosElementos).length == 0
    ) {
      this.sectionList.forEach(element => {
        //Aqui falta de que en caso de que se otro proyecto y tenga más o menos elementos que no cause problemas y se activen o desactiven bien los botones
        let flag = false;
        const auxidelemento: string = element['id'],
          auximpacto = this.calculosSegunaSeccion.ajustarNombre(
            this.potentialTypesList[0]['name_complete_potential_type']
          );
        Object.keys(auxDatos[auximpacto]).forEach(idelemento => {
          if (idelemento == auxidelemento.toString() && auxDatos[auximpacto][idelemento] !== 0) {
            flag = true;
          }
        });
        if (flag) {
          this.elementosConstructivosMostradosElementos[
            auxidelemento.toString()
          ] = {};
          this.elementosConstructivosMostradosElementos[
            auxidelemento.toString()
          ]['nombre'] = element['name_section'];
          this.elementosConstructivosMostradosElementos[
            auxidelemento.toString()
          ]['habilitado'] = false;
          this.elementosConstructivosMostradosElementos[
            auxidelemento.toString()
          ]['check'] = true;
        } else {
          this.elementosConstructivosMostradosElementos[
            auxidelemento.toString()
          ] = {};
          this.elementosConstructivosMostradosElementos[
            auxidelemento.toString()
          ]['nombre'] = element['name_section'];
          this.elementosConstructivosMostradosElementos[
            auxidelemento.toString()
          ]['habilitado'] = true;
          this.elementosConstructivosMostradosElementos[
            auxidelemento.toString()
          ]['check'] = false;
        }
      });
    }
    if (this.banderaAjusteElememtos) {
      this.sectionList.forEach(element => {
        let flag = false;
        const auxidelemento: string = element['id'],
          auximpacto = this.calculosSegunaSeccion.ajustarNombre(
            this.potentialTypesList[0]['name_complete_potential_type']
          );
        Object.keys(auxDatos[auximpacto]).forEach(idelemento => {
          if (idelemento == auxidelemento.toString() && auxDatos[auximpacto][idelemento] !== 0) {
            flag = true;
          }
        });
        if (flag) {
          this.elementosConstructivosMostradosElementos[
            auxidelemento.toString()
          ] = {};
          this.elementosConstructivosMostradosElementos[
            auxidelemento.toString()
          ]['nombre'] = element['name_section'];
          this.elementosConstructivosMostradosElementos[
            auxidelemento.toString()
          ]['habilitado'] = false;
          this.elementosConstructivosMostradosElementos[
            auxidelemento.toString()
          ]['check'] = true;
        }
      });
    }
  }

  //Se cargan los proyetcos existentes y se configura el menu
  menu_inicio() {
    this.projectsList.forEach(proyecto => {
      if (proyecto['id'] == this.idProyectoActivo) {
        this.proyecto.nombre = proyecto['name_project'];
        this.proyecto.num_epic = this.calculos.materiales_EPIC;
        this.proyecto.num_epd = this.calculos.materiales_EPD;
        return;
      }
      this.proyect = [
        ...this.proyect,
        {
          Nombre: proyecto['name_project'],
          id: proyecto['id'],
          num_epic: 0,
          card: false,
          num_epd: 0,
        },
      ];
    });

    this.iniciar_graficas(this.idProyectoActivo);
  }

  //activar gráfica de porcentaje
  porcentaje(val: boolean) {
    if (val == this.bandera_porcentaje) {
      return;
    }
    this.receiveSelector(null);
    this.bandera_porcentaje = val;
    this.ID = ' ';
    this.iniciaBarras();
    this.containerGraficas.clear();
    return;
  }

  //quitar proyecto a las gráficas
  quitarProyecto(ID: number) {
    this.proyect.forEach((proyecto, index) => {
      if (proyecto.id == ID) {
        this.proyect[index].card = false;
      }
    });
    this.proyect_active.forEach((element, index) => {
      if(element === ID) {
        this.idsImgEdificios.splice(index, 1);
      }
    });
    this.proyect_active = this.proyect_active.filter(item => item != ID);
    delete this.selectionsByProject[ID];

    this.proyectosMostrados = this.proyectosMostrados.filter(
      ({ id }) => id != ID
    );
    let nump = 1;
    this.proyect_active.forEach(element => {
      this.proyectosMostrados.forEach((pr, numproy) => {
        if (pr.id == element) {
          nump = nump + 1;
          this.proyectosMostrados[numproy].num = nump;
        }
      });
    });
    this.proyectosMostrados_elementos =
      this.proyectosMostrados_elementos.filter(
        ({ idproyecto }) => idproyecto != ID
      );
    this.outproyect_bar = this.outproyect_bar.filter(({ id }) => id != ID);
    this.outproyect_radar = this.outproyect_radar.filter(({ id }) => id != ID);
    this.outproyect_pie = this.outproyect_pie.filter(({ id }) => id != ID);
    this.outproyect_bar_elementos = this.outproyect_bar_elementos.filter(
      ({ id }) => id != ID
    );
    this.iconosElementosConstrucivos = {};
    this.elementosConstructivosMostradosElementos = {};
    delete this.estadoTercerSeccion[ID];
    this.outproyect_bar_elementos.forEach((element, index) => {
      if (index < 1) {
        this.banderaAjusteElememtos = false;
      } else {
        this.banderaAjusteElememtos = true;
      }
      this.AjustarElementosMostrados(element.Datos);
      this.AjustarElementosMostradosElemntos(element.Datos);
    });
    this.banderaAjusteElememtos = false;

    if (this.resultdosTabla) {
      this.TablaResultados();
    } else {
      this.iniciaBarras();
    }
    if (this.Impactos_ambientales) {
      this.containerGraficas.clear();
      this.receiveSelector(null);
      if (this.ID != ' ') {
        document.getElementById(this.ID).className = 'boton-principal';
      }
    }
    this.ID = ' ';
    this.selector = null;
    if (this.Impactos_Elementos) {
      this.iniciaBarrasSeccionDos();
      if (this.imgSeleccionadaElemento != ' ') {
        this.DispercionAP(this.imgSeleccionadaElemento, ' ');
      }
      if (this.elementoContructivoSelecionado != ' ') {
        document.getElementById(
          'texto'.concat(this.elementoContructivoSelecionado)
        ).className = 'espacio-sin-selecciomar';
      }
      this.catologoImpactoAmbiental.forEach(impacto => {
        const auxID = impacto['id'].toString().concat('LineaImpactoElememtos'),
          elementosflag = document.getElementById(auxID);
        if (elementosflag != null) {
          elementosflag.className = 'dot';
        }
      });
      this.graficabar(null);
    }
    this.elementoContructivoSelecionado = ' ';
    this.imgSeleccionadaElemento = ' ';
    if (this.Elementos_constructivos) {
      this.iniciarSeccionTres();
    }
    Object.keys(this.estadoTercerSeccion).forEach(pr =>{
      this.estadoTercerSeccion[pr] = {
        'agruparProduccion': false,
        'cicloSeleccionado': " ",
        'flagPie': true,
        'fragBar': false
      };
    })
  }

  //interacción con la gráfca de bar
  receiveSelector($event) {
    //cordinate with bar graph
    let aux;
    if (Array.isArray($event)) {
      let sl;
      $event.forEach((element, index) => {
        if (index == 0) {
          sl = element;
        } else {
          sl = sl.concat(' ', element);
        }
      });
      aux = sl;
    } else {
      aux = $event;
    }

    this.showVar_1 = false;
    this.showVar = false;
    this.selector = aux;

    if ($event == null) {
      this.bandera = 0;
      this.hover = true;
      if (this.ID != ' ') {
        const IDDom = document.getElementById(this.ID);
        if(IDDom != null) {
          IDDom.className = 'boton-principal';
        }
        this.ID = ' ';
      }
      this.catologoImpactoAmbiental.forEach(impacto => {
        const auxID = impacto['id'].toString().concat('LineaImpactoCiclo'),
          elementosflag = document.getElementById(auxID);
        if (elementosflag != null) {
          elementosflag.className = 'dot';
        }
      });
    } else {
      this.bandera = 1;
      this.hover = false;
      if (this.ID != ' ') {
        document.getElementById(this.ID).className = 'boton-principal';
      }
      this.catologoImpactoAmbiental.forEach(impacto => {
        const auxnameI = impacto['name_complete_potential_type'].replace(
          /\s/g,
          ''
        ),
          auxnameIS = aux.replace(/\s/g, '');
        if (auxnameIS === auxnameI) {
          const auxID = impacto['id'].toString().concat('LineaImpactoCiclo');
          document.getElementById(auxID).className = 'linea-select';
        } else {
          const auxID = impacto['id'].toString().concat('LineaImpactoCiclo');
          document.getElementById(auxID).className = 'dot';
        }
      });
      //catologoImpactoAmbiental
      this.ID = ' ';
    }
    this.containerGraficas.clear();
  }

  //Despliegue gráficas de pie o radar
  grafica(x: string) {
    //activate graph selectioned
    if (this.ID != ' ') {
      //console.log('in');
      document.getElementById(this.ID).className = 'boton-principal';
    }

    if (this.resultdosGraficos) {
      this.containerGraficas.clear();
      this.bandera_resultado = 2;
      if (this.banderaGrapg == 0) {
        this.banderaGrapg++;
        this.ID = ' ';
      }
      if (x === this.ID) {
        if (this.bandera == 1) {
          this.showVar = false;
        } else {
          this.showVar_1 = false;
          this.hover = true;
          this.bandera_serie_Seleccionada = false;
        }
        this.banderaGrapg = 0;
        this.ID = ' ';
        this.containerGraficas.clear();
      } else {
        this.ID = x;
        if (this.bandera == 1) {
          this.showVar = true;
          this.showVar_1 = false;
          this.iniciaPie();
        } else {
          this.showVar_1 = true;
          this.showVar = false;
          this.hover = false;
          this.serie_Seleccionada = x;
          this.iniciaRadiales();
        }
      }
      if (this.ID != ' ') {
        const boton = document.getElementById(this.ID);
        boton.className = 'boton-select';
      }
    }
  }

  //despliegue gráfica de pie para sección de resultados
  selectImpactoAmbiental() {
    this.impactoAmbientalSeleccionado = this.calculos.ajustarNombre(
      this.selectedValue
    );
    this.iniciarSeccionTres();
  }

  selectEtapa(etapa) {
    let flag = true;
    this.ciclosDeVidaIgnoradasElementos.forEach(etapaEliminada => {
      if (etapaEliminada === etapa) flag = false;
    });
    if (flag) {
      const color = {
        Producción: '#4DBE89',
        Construccion: '#0DADBA',
        Uso: '#8F5091',
        FinDeVida: '#DEA961',
      };
      let auxResultado = ' ';
      if (this.cicloVidaSeleccionadoElemento === ' ') {
        this.cicloVidaSeleccionadoElemento = etapa;
        auxResultado = etapa;
        document.getElementById(etapa.concat('TextoElemento')).className =
          'button-info-select';
        Object.keys(color).forEach(element => {
          if (element === etapa) {
            document.getElementById(
              etapa.concat('TextoElemento')
            ).style.borderColor = color[element];
          }
        });
      } else {
        if (this.cicloVidaSeleccionadoElemento != etapa) {
          document.getElementById(etapa.concat('TextoElemento')).className =
            'button-info-select';
          Object.keys(color).forEach(element => {
            if (element === etapa) {
              document.getElementById(
                etapa.concat('TextoElemento')
              ).style.borderColor = color[element];
            }
          });
          document.getElementById(
            this.cicloVidaSeleccionadoElemento.concat('TextoElemento')
          ).className = 'button-info';
          this.cicloVidaSeleccionadoElemento = etapa;
          auxResultado = etapa;
        } else {
          document.getElementById(
            this.cicloVidaSeleccionadoElemento.concat('TextoElemento')
          ).className = 'button-info';
          this.cicloVidaSeleccionadoElemento = ' ';
          auxResultado = ' ';
        }
      }
      Object.keys(this.estadoTercerSeccion).forEach(idP => {
        this.estadoTercerSeccion[idP]['cicloSeleccionado'] = auxResultado;
      });
      this.iniciarSeccionTres();
    }
  }

  eliminarEtapa(etapa) {
    if (this.ciclosDeVidaIgnoradasElementos.includes(etapa)) {
      this.ciclosDeVidaIgnoradasElementos.forEach((element, index) => {
        if (element === etapa) {
          this.iconosCambioElementos[etapa] = 'visibility';
          this.ciclosDeVidaIgnoradasElementos.splice(index, 1);
        }
      });
    } else {
      this.iconosCambioElementos[etapa] = 'visibility_off';
      this.ciclosDeVidaIgnoradasElementos.push(etapa);
      if (this.cicloVidaSeleccionadoElemento === etapa) {
        document.getElementById(
          this.cicloVidaSeleccionadoElemento.concat('TextoElemento')
        ).className = 'button-info';
        this.cicloVidaSeleccionadoElemento = ' ';
      }
      const auxBotonesEtapa = {
        A1: 'Producción',
        A2: 'Producción',
        A3: 'Producción',
        A4: 'Construccion',
        B4: 'Uso',
      };
      Object.keys(this.estadoTercerSeccion).forEach(idP => {
        if (this.estadoTercerSeccion[idP]['cicloSeleccionado'] === etapa) {
          this.estadoTercerSeccion[idP]['cicloSeleccionado'] = ' ';
        } else if (
          this.estadoTercerSeccion[idP]['cicloSeleccionado'] ===
          auxBotonesEtapa[etapa]
        ) {
          this.estadoTercerSeccion[idP]['cicloSeleccionado'] = ' ';
        }
      });
    }
    this.iniciarSeccionTres();
  }

  elementoSeleccionadoElementos(recive) {
    if (
      this.elementosContructivosEliminadosElementos.includes(recive.toString())
    ) {
      this.elementosContructivosEliminadosElementos.forEach(
        (element, index) => {
          if (element == recive.toString()) {
            this.elementosContructivosEliminadosElementos.splice(index, 1);
          }
        }
      );
    } else {
      this.elementosContructivosEliminadosElementos.push(recive.toString());
    }
    this.iniciarSeccionTres();
  }

  //resetear secciones
  ResetTabs(value: number) {
    if (value == 2) {
      this.outproyect_bar_elementos.forEach((element, index) => {
        if (index < 1) {
          this.banderaAjusteElememtos = false;
        } else {
          this.banderaAjusteElememtos = true;
        }
        this.AjustarElementosMostradosElemntos(element.Datos);
      });
      this.banderaAjusteElememtos = false;
    }
  }

  //cambio entre grafica pie y bar en sección elementos contructivos
  change_graph(value: number, IDproyect: number) {
    this.proyectosMostrados_elementos.forEach(element => {
      if (element.idproyecto == IDproyect) {
        element.showciclo = false;
        element.showcimenta = false;
        element.ciclo = ' ';
        element.elemento = ' ';
        //activar pie
        if (value == 1) {
          element.showbar = false;
          element.showpie = true;
        } else {
          //activar bar
          element.showbar = true;
          element.showpie = false;
        }
      }
    });
  }

  //configuración de la sección dispersión del en fase de ciclo de vida
  configurarDatos($event, IDproyect: number) {
    const auxdatos = $event;
    this.proyectosMostrados_elementos.forEach(element => {
      if (element.idproyecto == IDproyect) {
        element.showcimenta = false;
        element.showciclo = auxdatos.show;
        element.ciclo = auxdatos.etapa;
        if (element.showciclo) {
          this.childPie.forEach(c => c.cambioID(element.ciclo, IDproyect));
        }
      }
    });
  }

  recepcionAP($event) {
    this.DispercionAP($event[0], $event[1])
  }

  DispercionAP(item, proyectoID) {
    let flagMostrarInfo = false;
    if (item != null) {
      if (
        this.impactoSeleccionadoElementoConstructivo != ' ' &&
        this.elementoContructivoSelecionado != ' '
      ) {
        if (this.imgSeleccionadaElemento === ' ') {
          this.show_Dispercion = true;
          this.imgSeleccionadaElemento = item;
          this.idProyectoSeleccionadoImagen = proyectoID;
          document.getElementById(item).className = 'edificio-individual-seleccionado';
          flagMostrarInfo = true;
          this.proyectosMostrados_elementos.forEach(element => {
            if (element.idproyecto == proyectoID) {
              this.nombreProyectoElegidoSeleccionadoElementos = element.nombre;
            }
          });
          const elemento = this.sectionList.filter(
            ({ id }) => id == Number(this.elementoContructivoSelecionado)
          );
          this.elementoSeleccionadoMostrado = elemento[0]['name_section'];
        } else {
          if (item != this.imgSeleccionadaElemento) {
            document.getElementById(this.imgSeleccionadaElemento).className =
              'edificio-individual';
            document.getElementById(item).className =
              'edificio-individual-seleccionado';
            this.imgSeleccionadaElemento = item.toString();
            this.idProyectoSeleccionadoImagen = proyectoID;
            flagMostrarInfo = true;
            this.proyectosMostrados_elementos.forEach(element => {
              if (element.idproyecto == proyectoID) {
                this.nombreProyectoElegidoSeleccionadoElementos =
                  element.nombre;
              }
            });
            const elemento = this.sectionList.filter(
              ({ id }) => id == Number(this.elementoContructivoSelecionado)
            );
            this.elementoSeleccionadoMostrado = elemento[0]['name_section'];
          } else {
            this.show_Dispercion = false;
            document.getElementById(item).className = 'edificio-individual';
            this.nombreProyectoElegidoSeleccionadoElementos = ' ';
            this.imgSeleccionadaElemento = ' ';
            this.idProyectoSeleccionadoImagen = ' ';
            this.banderaTipoGraficaDispercion = true;
          }
        }
      }
    } else {
      flagMostrarInfo = true;
    }
    if (flagMostrarInfo) {
      this.iniciarTabaDispercion();
      if (this.containerGraficasDos != undefined) {
        this.iniciarGraficaEspecificaDispercion();
      }
    }
  }

  findUnidad(indicador) {
    let final_unit,
     impacto = indicador.replace(/\n/g, '');
    impacto = impacto.replace(/\s/g, '');
    this.potentialTypesList.forEach(element => {
      const aux_element = element['name_complete_potential_type'].replace(
        /\s/g,
        ''
      );
      if (impacto === aux_element) {
        final_unit = element['unit_potential_type'];
      }
    });
    if (indicador != undefined) {
      //
    }
    return final_unit;
  }

  iniciarTabaDispercion() {
    this.infoTablaDispercion = [];
    //'color-'no', 'material', 'porcentaje', 'numero'
    //console.log(this.outproyect_pie_bar_elementos)
    this.outproyect_pie_bar_elementos.forEach(element => {
      if (element['id'] == this.idProyectoSeleccionadoImagen) {
        let auxhelp = [],
         suma = 0,
         auxdatos = [];
        Object.keys(element.Datos).forEach(impacto => {
          const auxNombre = this.calculosSegunaSeccion.ajustarNombre(
            this.impactoSeleccionadoElementoConstructivo
          );
          if (impacto === auxNombre) {
            Object.keys(element.Datos[impacto]).forEach(elementoC => {
              if (elementoC == this.elementoContructivoSelecionado) {
                //Ordear de mayor a menor
                Object.keys(element.Datos[impacto][elementoC]).forEach(
                  material => {
                    suma += element.Datos[impacto][elementoC][material];
                    auxhelp = [
                      ...auxhelp,
                      element.Datos[impacto][elementoC][material],
                    ];
                  }
                );
                auxdatos = auxhelp.sort((n1, n2) => {
                  if (n1 > n2) {
                    return 1;
                  }

                  if (n1 < n2) {
                    return -1;
                  }

                  return 0;
                });
              }
            });
          }
        });
        auxdatos = auxdatos.reverse();
        let num = 0;
        const auxColor = {
          '#5A1002': 'rgb(90,16,2)',
          '#902511': 'rgb(144,37,17)',
          '#BE3218': 'rgb(190,50,24)',
          '#EB3F20': 'rgb(235,63,32)',
          '#EB5720': 'rgb(235,87,32)',
          '#EB7620': 'rgb(235,118,32)',
          '#EB9520': 'rgb(235,149,32)',
          '#EBC420': 'rgb(235,196,32)',
          '#EBDB20': 'rgb(235,219,32)',
          '#CCEB20': 'rgb(204,235,32)',
          '#76EB20': 'rgb(118,235,32)',
        };
        if (auxdatos.length == 0) {
          this.flagMaterialesDispercion = false;
          this.flagSinMaterialesDispercion = true;
        } else {
          const colorhelp = auxColor[this.colorGraficaDispercion].match(
            /rgba?\((\d{1,3}), ?(\d{1,3}), ?(\d{1,3})\)?(?:, ?(\d(?:\.\d?))\))?/
          );
          let cambioR = colorhelp[1],
           cambioG = colorhelp[2],
           cambioB = colorhelp[3];
          auxdatos.forEach((lugar, ii) => {
            Object.keys(element.Datos).forEach(impacto => {
              const auxNombre = this.calculosSegunaSeccion.ajustarNombre(
                this.impactoSeleccionadoElementoConstructivo
              );
              if (impacto === auxNombre) {
                this.unidadImpactoAmientalTabla = impacto;
                Object.keys(element.Datos[impacto]).forEach(elementoC => {
                  if (elementoC == this.elementoContructivoSelecionado) {
                    Object.keys(element.Datos[impacto][elementoC]).forEach(
                      material => {
                        const aux = {};
                        if (
                          lugar == element.Datos[impacto][elementoC][material]
                        ) {
                          //Sección para determinar el color en la tabla con relación a la gráfica
                          let auxrgbcolor = 'rgb(';
                          if (ii <= 2) {
                            auxrgbcolor = auxrgbcolor
                              .concat(cambioR.toString())
                              .concat(',')
                              .concat(cambioG)
                              .concat(',')
                              .concat(cambioB)
                              .concat(')');
                            if (255 - cambioR >= 40) {
                              cambioR = (Number(cambioR) + 40).toString();
                            } else if (cambioG - 40 >= 0) {
                              cambioG = (Number(cambioG) - 40).toString();
                            } else {
                              cambioB = (Number(cambioB) + 40).toString();
                            }
                          } else {
                            auxrgbcolor = auxrgbcolor
                              .concat(cambioR.toString())
                              .concat(',')
                              .concat(colorhelp[2])
                              .concat(',')
                              .concat(colorhelp[3])
                              .concat(')');
                          }
                          aux['color'] = auxrgbcolor;
                          const helpMaterial = this.materiales.filter(
                            ({ id }) => id == material
                          );
                          num = num + 1;
                          aux['no'] = num;
                          aux['material'] = helpMaterial[0]['name_material'];
                          aux['porcentaje'] = (
                            (element.Datos[impacto][elementoC][material] / suma) *
                            100
                          ).toFixed(2);
                          aux['numero'] =
                            element.Datos[impacto][elementoC][
                              material
                            ].toExponential(2);
                          this.infoTablaDispercion.push(aux);
                        }
                      }
                    );
                  }
                });
              }
            });
          });
          this.flagMaterialesDispercion = true;
          this.flagSinMaterialesDispercion = false;
        }
      }
    });
    if (this.flagMaterialesDispercion) {

      this.unidadImpactoAmientalTabla = this.findUnidad(
        this.unidadImpactoAmientalTabla
      );
    }
  }

  iniciarGraficaEspecificaDispercion() {
    //true = pie ; false = barras
    //let auxDatos;
    const aux = {};
    this.outproyect_pie_bar_elementos.forEach(element => {
      if (element['id'] == this.idProyectoSeleccionadoImagen) {
        Object.keys(element.Datos).forEach(impacto => {
          const auxNombre = this.calculosSegunaSeccion.ajustarNombre(
            this.impactoSeleccionadoElementoConstructivo
          );
          if (impacto === auxNombre) {
            Object.keys(element.Datos[impacto]).forEach(elementoC => {
              if (elementoC == this.elementoContructivoSelecionado) {
                Object.keys(element.Datos[impacto][elementoC]).forEach(
                  material => {
                    aux[material] = element.Datos[impacto][elementoC][material];
                  }
                );
              }
            });
          }
        });
      }
    });
    this.asignarColorGraficaDispercion();
    if (this.banderaTipoGraficaDispercion) {
      this.containerGraficasDos.clear();
      const grafica = this.containerGraficasDos.createComponent(this.pieChartComponent);
      grafica.instance.inputProyect = aux;
      grafica.instance.showMePartially = this.showVar;
      grafica.instance.indicador = this.selector;
      grafica.instance.id = this.ID;
      grafica.instance.Bandera_resultado = 1;
      grafica.instance.unidades = this.potentialTypesList;
      grafica.instance.colorDispercion = this.colorGraficaDispercion;
    } else {
      this.containerGraficasDos.clear();
      const grafica = this.containerGraficasDos.createComponent(this.barChartSimpleComponent);
      grafica.instance.banderaDispercion = true;
      grafica.instance.info = aux;
      grafica.instance.showGr = false;
      grafica.instance.showlastGr = true;
      grafica.instance.colorDispercion = this.colorGraficaDispercion;
    }
  }

  cambioDeTipoGraficaDispercion(bandera) {
    this.banderaTipoGraficaDispercion = bandera;
    this.DispercionAP(null, this.idProyectoSeleccionadoImagen);
  }

  //configuración de la sección dispersión del impacto en cimentación
  configurarData($event, IDproyect: number) {
    const auxdatos = $event;
    this.proyectosMostrados_elementos.forEach(element => {
      if (element.idproyecto == IDproyect) {
        element.showcimenta = auxdatos.show;
        element.elemento = auxdatos.etapa;
        if (element.showcimenta) {
          this.childBarSimple.forEach(c =>
            c.CargarDatos(element.elemento, element.ciclo)
          );
        }
      }
    });
  }

  receiveSelectorDos($event) {
    //cordinate with bar graph
    let aux = ' ';
    this.impactoSeleccionadoElementoConstructivoGrafica = $event['selec'];
    if ($event['seleccion'] != null) {
      if (Array.isArray($event['seleccion'])) {
        let sl;
        $event['seleccion'].forEach((element, index) => {
          if (index == 0) {
            sl = element;
          } else {
            sl = sl.concat('', element);
          }
        });
        aux = sl;
      } else {
        aux = $event['seleccion'];
      }
      this.catologoImpactoAmbiental.forEach(impacto => {
        const auxnameI = impacto['name_complete_potential_type'].replace(
          /\s/g,
          ''
        ),
          auxnameIS = aux.replace(/\s/g, '');
        if (auxnameIS === auxnameI) {
          const auxID = impacto['id'].toString().concat('LineaImpactoElememtos');
          document.getElementById(auxID).className = 'linea-select';
        } else {
          const auxID = impacto['id'].toString().concat('LineaImpactoElememtos');
          document.getElementById(auxID).className = 'dot';
        }
      });
      const auxnombre = this.calculos.ajustarNombre(aux);
      this.elementosConstructivosMostradosElementosPorProyecto = $event['nivelesProyectos'];
      this.nivelesExistententesElementosConstructivos =
        $event['niveles'][auxnombre];
      this.coloresExistententesElementosConstructivos = $event['color'];
      this.graficabar(aux);
      this.asignarColorGraficaDispercion();
    } else {
      this.catologoImpactoAmbiental.forEach(impacto => {
        const auxID = impacto['id'].toString().concat('LineaImpactoElememtos'),
          elementosflag = document.getElementById(auxID);
        if (elementosflag != null) {
          elementosflag.className = 'dot';
        }
      });
      this.graficabar(null);
    }
  }

  asignarColorGraficaDispercion() {
    if (this.impactoSeleccionadoElementoConstructivo != ' ') {
      if (this.elementoContructivoSelecionado != ' ') {
        this.nivelesExistententesElementosConstructivos.forEach(
          (element, index) => {
            if (element == Number(this.elementoContructivoSelecionado)) {
              this.colorGraficaDispercion =
                this.coloresExistententesElementosConstructivos[index];
            }
          }
        );
      }
    }
  }

  graficabar(item) {
    if (Number.isInteger(item)) {
      //En caso de oprimir un elemento constructivo
      if (this.elementoContructivoSelecionado === ' ') {
        this.elementoContructivoSelecionado = item.toString();
        if (this.impactoSeleccionadoElementoConstructivo === ' ') {
          //Opción sin seleccionar ningún impacto ambiental se selecciona un elemento;
          document.getElementById('texto'.concat(item.toString())).className =
            'espacio-seleccionado';
          this.iniciaBarrasSeccionDos();
        } else {
          //Opción con un impacto elemento seleccionado y todos los botones prendidos
          Object.keys(this.iconosElementosConstrucivos).forEach(element => {
            if (
              this.iconosElementosConstrucivos[element]['habilitado'] === false
            ) {
              if (element === item.toString()) {
                document.getElementById(
                  this.idsIconosElementos[element]['idTEXTO']
                ).className = 'espacio-seleccionado';
              } else {
                document.getElementById(
                  this.idsIconosElementos[element]['idTEXTO']
                ).className = 'espacio-sin-selecciomar';
              }
            }
          });
          //Actualizar grafica para que se ilumen el elemento solo del impacto seleccionado
          this.iniciaBarrasSeccionDos();
          if (this.imgSeleccionadaElemento != ' ') {
            this.show_Dispercion = true;
          }
        }
      } else {
        //En caso de tener un elemento constructivo ya seleccionado
        if (item != this.elementoContructivoSelecionado) {
          //Cambio de elemento seleccionado
          document.getElementById(
            'texto'.concat(this.elementoContructivoSelecionado)
          ).className = 'espacio-sin-selecciomar';
          document.getElementById('texto'.concat(item.toString())).className =
            'espacio-seleccionado';
          this.elementoContructivoSelecionado = item.toString();
          this.iniciaBarrasSeccionDos();
        } else {
          //quitar la selección del elemento constructivo
          document.getElementById('texto'.concat(item.toString())).className =
            'espacio-sin-selecciomar';
          this.elementoContructivoSelecionado = ' ';
          this.impactoSeleccionadoElementoConstructivo = ' ';
          this.impactoSeleccionadoElementoConstructivoGrafica = null;
          this.catologoImpactoAmbiental.forEach(impacto => {
            const auxID = impacto['id'].toString().concat('LineaImpactoElememtos'),
              elementosflag = document.getElementById(auxID);
            if (elementosflag != null) {
              elementosflag.className = 'dot';
            }
          });
          this.iniciaBarrasSeccionDos();
          if (this.imgSeleccionadaElemento != ' ') {
            //Quitar la selección dela imagen seleccionado y que se desactiven las graficas de las potencias de impactos
            document.getElementById(this.imgSeleccionadaElemento).className =
              'img-edificio';
            this.imgSeleccionadaElemento = ' ';
            this.show_Dispercion = false;
          }
        }
      }
    } else {
      //cuando se presiona un impacto ambiental
      if (item === null) {
        //Se elimina la selección del impacto ambiental
        this.impactoSeleccionadoElementoConstructivo = ' ';
        this.impactoSeleccionadoElementoConstructivoGrafica = null;
        Object.keys(this.iconosElementosConstrucivos).forEach(element => {
          if (
            this.iconosElementosConstrucivos[element]['habilitado'] === false
          ) {
            document.getElementById(
              this.idsIconosElementos[element]['idTEXTO']
            ).className = 'espacio-sin-selecciomar';
          }
        });
        this.elementoContructivoSelecionado = ' ';
        if (this.imgSeleccionadaElemento != ' ') {
          //Quitar la selección dela imagen seleccionado y que se desactiven las graficas de las potencias de impactos
          document.getElementById(this.imgSeleccionadaElemento).className =
            'img-edificio';
          this.imgSeleccionadaElemento = ' ';
        }
        this.show_Dispercion = false;
        this.catologoImpactoAmbiental.forEach(impacto => {
          const auxID = impacto['id'].toString().concat('LineaImpactoElememtos'),
            elementosflag = document.getElementById(auxID);
          if (elementosflag != null) {
            elementosflag.className = 'dot';
          }
        });
      } else {
        //seleccionar un impacto ambiental
        if (this.impactoSeleccionadoElementoConstructivo === ' ') {
          this.impactoSeleccionadoElementoConstructivo = item;
          if (this.elementoContructivoSelecionado === ' ') {
            //Opción sin seleccionar ningún elemento constructivo se seleccionan todos los elementos;
            Object.keys(this.iconosElementosConstrucivos).forEach(element => {
              if (
                this.iconosElementosConstrucivos[element]['habilitado'] ===
                false
              ) {
                document.getElementById(
                  this.idsIconosElementos[element]['idTEXTO']
                ).className = 'espacio-seleccionado';
              }
            });
          } else {
            //recetear el impacto constructivo seleccionado
            if (this.imgSeleccionadaElemento != ' ') {
              this.show_Dispercion = true;
            }
          }
        } else {
          //cambio de selección en el impacto ambiental
          this.impactoSeleccionadoElementoConstructivo = item;
          if (this.elementoContructivoSelecionado != ' ') {
            this.asignarColorGraficaDispercion();
            if (this.imgSeleccionadaElemento != ' ') {
              this.show_Dispercion = true;
            }
          }
        }
      }
    }
    if (this.show_Dispercion) {
      const elemento = this.sectionList.filter(
        ({ id }) => id == Number(this.elementoContructivoSelecionado)
      );
      this.elementoSeleccionadoMostrado = elemento[0]['name_section'];
      this.DispercionAP(null, this.idProyectoSeleccionadoImagen);
    }
    this.iniciarImgEdificio();
  }

  AjusteGraficaElementosContructivos(item) {
    if (this.elementosContructivosEliminados.includes(item.toString())) {
      this.elementosContructivosEliminados.forEach((element, index) => {
        if (element == item.toString()) {
          this.elementosContructivosEliminados.splice(index, 1);
          document.getElementById('ojo'.concat(item.toString())).className =
            'button-icono';
          this.iconosElementosConstrucivos[item.toString()]['icono'] =
            'visibility';
        }
      });
    } else {
      this.iconosElementosConstrucivos[item.toString()]['icono'] =
        'visibility_off';
      document.getElementById('ojo'.concat(item.toString())).className =
        'button-icono-seleccionado';
      this.elementosContructivosEliminados.push(item.toString());
    }

    this.outproyect_bar_elementos = [];
    this.proyect_active.forEach(element => {
      const analisis = this.getAnalisisBarrasElementosConstructivos(element);
      this.outproyect_bar_elementos.push(analisis);
    });
    this.elementosContructivosEliminados.forEach(value => {
      this.outproyect_bar_elementos.forEach((proyecto, index) => {
        const indicadores = Object.keys(proyecto.Datos);
        indicadores.forEach(element => {
          delete this.outproyect_bar_elementos[index].Datos[element][value];
        });
      });
    });
    this.iniciaBarrasSeccionDos();
    if(this.imgSeleccionadaElemento != ' ') {
      this.DispercionAP(this.imgSeleccionadaElemento, ' ');
    }
    Object.keys(this.iconosElementosConstrucivos).forEach(element => {
      if(this.iconosElementosConstrucivos[element]['habilitado'] === false) {
        document.getElementById(this.idsIconosElementos[element]['idTEXTO']).className = 'espacio-sin-selecciomar';
      }
    })
    this.catologoImpactoAmbiental.forEach(impacto => {
      const auxID = impacto['id'].toString().concat('LineaImpactoElememtos'),
        elementosflag = document.getElementById(auxID);
      if (elementosflag != null) {
        elementosflag.className = 'dot';
      }
    });
    this.graficabar(null);
  }

  llenarIdsBotones(elementos) {
    elementos.forEach(element => {
      this.idsIconosElementos[element.id.toString()] = {};
      this.idsIconosElementos[element.id.toString()]['idOJO'] = 'ojo'.concat(
        element.id.toString()
      );
      this.idsIconosElementos[element.id.toString()]['idTEXTO'] =
        'texto'.concat(element.id.toString());
    });
    this.cargaElementos = true;
  }

  cambioEstadoTercerSeccion(cambio) {
    Object.keys(this.estadoTercerSeccion).forEach(idP => {
      if (cambio['idProyecto'].toString() === idP) {
        if (cambio['cambioEn'] === 'CicloVida') {
          if (this.cicloVidaSeleccionadoElemento != ' ') {
            document.getElementById(
              this.cicloVidaSeleccionadoElemento.concat('TextoElemento')
            ).className = 'button-info';
            this.cicloVidaSeleccionadoElemento = ' ';
          }
          this.estadoTercerSeccion[idP]['cicloSeleccionado'] = cambio['cambio'];
        } else if (cambio['cambioEn'] === 'CambioGrafica') {
          //'flagPie':true,
          //'fragBar':false
          this.estadoTercerSeccion[idP]['flagPie'] = cambio['cambio'].pie;
          this.estadoTercerSeccion[idP]['fragBar'] = cambio['cambio'].bar;
        } else {
          this.estadoTercerSeccion[idP]['agruparProduccion'] = cambio['cambio'];
        }
      }
    });
  }

  getSelectedImpactName(value: any): string {
    const selected = this.catologoImpactoAmbiental.find(option => option.name_complete_potential_type === value);
    return selected ? selected.name_complete_potential_type : '';
  }
}
