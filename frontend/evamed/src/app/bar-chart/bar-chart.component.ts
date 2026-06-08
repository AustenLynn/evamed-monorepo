import {
  Component,
  OnInit,
  AfterViewInit,
  ViewChild,
  Input,
  Output,
  EventEmitter,
} from '@angular/core';
import { ChartOptions, ChartType, ChartDataset, ChartEvent } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { CommonModule } from '@angular/common';
import ChartDataLabels from 'chartjs-plugin-datalabels';

@Component({
    selector: 'app-bar-chart',
    templateUrl: './bar-chart.component.html',
    styleUrls: ['./bar-chart.component.scss'],
    imports: [BaseChartDirective, CommonModule]
})
export class BarChartComponent implements OnInit, AfterViewInit {
  @ViewChild('MyChart') chartDir: BaseChartDirective;
  private canvas: any;

  @Input() inputProyects: any;
  @Input() porcentaje: any;
  @Input() showMe: boolean;
  @Input() Bandera_bar: boolean;
  @Input() Columna_seleccionada: string;
  @Input() banera_enfoqueSerie_externo: boolean;
  @Input() serie_input: string;
  @Input() bandera_enfoqueColumna: boolean;
  @Input() elementoConstructivo: string;
  @Input() impactoAmbiental: any;
  @Input() impactos: any;

  private colores = {
    FinDeVida: '#DEA961',
    Uso: '#8F5091',
    Construccion: '#148A93',
    Producción: '#4DBE89',
  };
  private coloresBWGraph2Nuevo = [
    'rgb(90, 16, 2,0.5)',
    'rgb(144, 37, 17,0.5)',
    'rgb(190, 50, 24,0.5)',
    'rgb(235, 63, 32,0.5)',
    'rgb(235, 87, 32,0.5)',
    'rgb(235, 118, 32,0.5)',
    'rgb(235, 173, 32,0.5)',
    'rgb(235, 196, 32,0.5)',
    'rgb(235, 219, 32,0.5)',
    'rgb(204, 235, 32,0.5)',
    'rgb(118, 235, 32,0.5)',
  ];
  private coloresGraph2Nuevo = [
    '#5A1002',
    '#902511',
    '#BE3218',
    '#EB3F20',
    '#EB5720',
    '#EB7620',
    '#EB9520',
    '#EBC420',
    '#EBDB20',
    '#CCEB20',
    '#76EB20',
  ];
  private coloresBW = {
    Producción: '#B1B1B1',
    Construccion: '#6A6A6A',
    Uso: '#686868',
    FinDeVida: '#969696',
  };
  private auxColor = [];
  private auxColorBW = [];
  private ElementosEnNiveles = [];
  private banderaImpacto = false;

  private lastClick = 'Ninguno';
  private hovered = null;
  private centrosX = {};
  private proyectos = [];
  private auxElementos = {};
  private auxElemntosData = {};
  @Output() lastClickEvent = new EventEmitter<string>();
  @Output() ClickEvent = new EventEmitter<any>();
  private maxValue = 0;

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
  };
  public barChartLabels: BaseChartDirective["labels"];
  public barChartType: ChartType = 'bar';
  public barChartLegend = false;
  public barChartPlugins = [
    ChartDataLabels,
    {
      afterDraw: this.agregaTitulosProyectos.bind(this),
      beforeInit: chart => {
        chart.data.labels.forEach( (e, i, a) => {
          if (/\n/.test(e)) {
            a[i] = e.split(/\n/);
          }
        });
      },
    },
    { id: 'clickOnChart',
      afterEvent: (chart, args) => {
        const event = args.event;
        if (event.type === 'click') {
          const value = chart.scales.x.getValueForPixel(args.event.x),
              label = chart.data.labels[value],
              limiteSuperior = Object.values(this.chartDir.chart.scales).filter(s => s.id === 'y')[0].top,
              limiteInferior = Object.values(this.chartDir.chart.scales).filter(s => s.id === 'y')[0].bottom;
              if (event.y > limiteInferior) {
                // Control de click en etiquetas
                this.focusColumnas({ label: label, index: value });
              } else if (event.y < limiteSuperior) {
                // Control de click de Proyecto
                this.focusProyecto(event);
              } else {
                //this.togglePorcentaje();
              }
        }
      }
    }
  ];

  public barChartData: ChartDataset[];
  constructor() {}

  ngOnInit(): void {
    this.iniciaIndicadores();
    this.iniciaDatos();
    this.ajustaEjeY();
  }

  ngAfterViewInit() {
    // Ya que se inicializa el componente
    //this.canvas = this.chartDir.chart.canvas;
    this.canvas = this.chartDir.ctx['canvas'];
    this.canvas.addEventListener('mousemove', e => {
      this.onHover(e);
    });
    /*this.canvas.addEventListener('mousedown', e => {
      this.onMouseDown(e);
    });*/
  }

  // configuración de datos (lectura de datos de entrada)
  private ajustaEjeY() {
    // se se usan porcentajes, limita el eje y de 0 a 100
    if (this.porcentaje) {
      this.barChartOptions.scales = {
        y: {
            display: true,
            beginAtZero: true,
            stacked: true,
            max: 100,
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
            max: 100,
            ticks: {
              font: {
                size: 11,
              }
            },
          },
      };
    } else {
      this.barChartOptions.scales = {
        y: {
            display: true,
            beginAtZero: true,
            stacked: true,
            max: this.maxValue,
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
            max: 100,
            ticks: {
              font: {
                size: 11,
              }
            },
          },
      };
    }
  }

  private iniciaIndicadores() {
    // se obtienen todos los indicadores en los proyectos
    this.barChartLabels = [];
    if (this.Bandera_bar) {
      this.inputProyects.forEach(proyecto => {
        Object.keys(proyecto.Datos).forEach(indicador => {
          if (!this.barChartLabels.includes(indicador)) {
            this.barChartLabels = [...this.barChartLabels, indicador];
          }
        });
      });
    } else {
      this.inputProyects.forEach(proyecto => {
        Object.keys(proyecto.Datos).forEach(indicador => {
          let auxAbr = '';
          this.impactos.forEach(impacto => {
            const auxNameImpacto = this.ajustarNombre(
              impacto['name_complete_potential_type']
            );
            if (indicador === auxNameImpacto) {
              auxAbr = impacto['name_potential_type'];
            }
          });
          const auxIndicador = indicador.concat('\n(', auxAbr, ')');
          if (!this.barChartLabels.includes(auxIndicador)) {
            this.barChartLabels = [...this.barChartLabels, auxIndicador];
          }
          proyecto.Datos[indicador].total = 0;
          proyecto.Datos[indicador].total = Object.values(
            proyecto.Datos[indicador]
          ).reduce((a: any, b: any) => a + b, 0);
          this.maxValue = Math.max(
            this.maxValue,
            proyecto.Datos[indicador].total
          );
        });
      });
    }
  }

  private iniciaDatos() {
    // le da el formato necesario a los datos para que se puedan graficar
    let datos = [];
    this.barChartData = [];
    this.ElementosEnNiveles = [];
    if (this.Bandera_bar) {
      //Sección para la gráfica de barras mostradas en los impactos ambientales por elementos constructivos
      let numElementos = 0;
      this.inputProyects.forEach(proyecto => {
        const auxData = {},
          auxDatos = {},
          auxDataElementos = {},
          auxDatosElementos = {},
          niveles_existentes = [];
        this.auxElemntosData[proyecto.id] = {};
        this.barChartLabels.forEach(indicador => {
          Object.keys(proyecto.Datos[indicador.toString()]).forEach(
            (element, index) => {
              const helpn = 'n'.concat(index.toString());
              auxDatos[helpn] = [];
              auxDatosElementos[helpn] = [];
              if (!niveles_existentes.includes(helpn)) {
                numElementos = numElementos + 1;
                niveles_existentes.push(helpn);
              }
            }
          );
        });

        this.barChartLabels.forEach((indicador, indexLabel) => {
          this.auxElementos[indicador.toString()] = [];
          this.auxElemntosData[proyecto.id][indexLabel.toString()] = [];
          let suma = 0;
          //creaición de los espacios para guardar los valores por niveles
          Object.keys(proyecto.Datos[indicador.toString()]).forEach(
            element => {
              suma = suma + proyecto.Datos[indicador.toString()][element];
            }
          );
          //acomodar conforme porcentajes y en orden para niveles
          let auxdatos = [],
           help = [];
          Object.keys(proyecto.Datos[indicador.toString()]).forEach(
            element => {
              help = [...help, proyecto.Datos[indicador.toString()][element]];
            }
          );
          auxdatos = help.sort((n1, n2) => {
            if (n1 > n2) {
              return 1;
            }

            if (n1 < n2) {
              return -1;
            }

            return 0;
          });
          auxdatos = auxdatos.reverse();
          //se guarda el nivel de cada elemento constructivo dependiendo del impacto ambiental
          auxdatos.forEach(datoC => {
            Object.keys(proyecto.Datos[indicador.toString()]).forEach(
              element => {
                if (datoC == proyecto.Datos[indicador.toString()][element]) {
                  this.auxElementos[indicador.toString()].push(element);
                  this.auxElemntosData[proyecto.id][indexLabel.toString()].push(
                    element
                  );
                }
              }
            );
          });
          //Pasar a porsentaje
          auxdatos.forEach((datoC, index) => {
            const resultado = ((datoC * 100) / suma).toFixed(2);
            auxdatos[index] = resultado;
          });

          //se guardan por niveles dependiendo del impacto ambiental
          auxdatos.forEach((element, index) => {
            const helpn = 'n'.concat(index.toString());
            auxData[helpn] = element;
            auxDataElementos[helpn] =
              this.auxElementos[indicador.toString()][index];
          });

          //se llenan los niveles en orden
          Object.keys(auxDatos).forEach(element => {
            Object.keys(auxData).forEach(valor => {
              if (element === valor) {
                auxDatos[element].push(auxData[valor]);
              }
            });
          });
          Object.keys(auxDatosElementos).forEach(element => {
            Object.keys(auxDataElementos).forEach(valor => {
              if (element === valor) {
                auxDatosElementos[element].push(auxDataElementos[valor]);
              }
            });
          });
        });
        this.auxColor = this.coloresGraph2Nuevo;
        this.auxColorBW = this.coloresBWGraph2Nuevo;

        Object.keys(auxDatosElementos).forEach(etapa => {
          this.ElementosEnNiveles.push(auxDatosElementos[etapa]);
        });
        Object.keys(auxDatos).forEach((etapa, index) => {
          datos = [
            ...datos,
            {
              data: auxDatos[etapa],
              label: etapa,
              stack: proyecto.Nombre,
              backgroundColor: this.coloresGraph2Nuevo[index],
              hoverBackgroundColor: this.coloresGraph2Nuevo[index],
            },
          ];
        });
      });
    } else {
      datos = [];
      this.inputProyects.forEach(proyecto => {
        const auxDatos = {
          Producción: [],
          Construccion: [],
          Uso: [],
          FinDeVida: [],
        };
        this.barChartLabels.forEach(indicador => {
          const auxIndicador = this.reajusteNombre(indicador.toString());
          Object.keys(auxDatos).forEach(etapa => {
            const indicadores = Object.keys(proyecto.Datos);
            if (
              !indicadores.includes(auxIndicador.toString()) ||
              !Object.keys(proyecto.Datos[auxIndicador.toString()]).includes(
                etapa
              )
            ) {
              auxDatos[etapa] = [...auxDatos[etapa], 0];
            } else {
              auxDatos[etapa] = [
                ...auxDatos[etapa],
                this.porcentaje
                  ? (
                      (proyecto.Datos[auxIndicador.toString()][etapa] * 100) /
                      proyecto.Datos[auxIndicador.toString()].total
                    ).toFixed(2)
                  : proyecto.Datos[auxIndicador.toString()][
                      etapa
                    ].toExponential(2),
              ];
            }
          });
        });
        //console.log(auxDatos)
        Object.keys(auxDatos).forEach(etapa => {
          datos = [
            ...datos,
            {
              data: auxDatos[etapa],
              label: etapa,
              stack: proyecto.Nombre,
              backgroundColor: this.colores[etapa],
              hoverBackgroundColor: this.colores[etapa],
            },
          ];
        });
      });
    }
    //this.barChartData = datos;
    this.barChartData['datasets'] = datos;
    this.barChartData['labels'] = this.barChartLabels;

    if (this.Bandera_bar) {
      if (this.impactoAmbiental != null) {
        if (this.elementoConstructivo != ' ') {
          this.banderaImpacto = true;
          this.focusColumnas(this.impactoAmbiental);
          this.banderaImpacto = false;
        }
      } else {
        if (this.elementoConstructivo != ' ') {
          this.focusSeries(this.elementoConstructivo);
        }
      }
    }
  }

  reajusteNombre(name: string) {
    const help = name;
    let aux = name,
     flag = true;
    for (let _i = help.length - 1; _i >= 0; _i--) {
      if (flag) {
        aux = aux.slice(0, _i);
      }
      if (help[_i] === '\n') {
        flag = false;
      }
    }
    return aux;
  }

  // configurcion de estilo (Titulos de proyectos)
  private iniciaPosiciones(chart: any) {
    // Se encuentran las posiciones de las barras
    const labels = chart['$datalabels']['_labels'];
    this.centrosX = {};
    this.proyectos = [];
    labels.some(label => {
      if (this.Bandera_bar) {
        const proyecto = label['$context']['dataset'].stack,
         elemento = label['_el'],
         //x = elemento['_view'].x;
         x = elemento.x;
        if (this.centrosX[proyecto] == undefined) {
          this.centrosX[proyecto] = [];
          this.proyectos = [proyecto, ...this.proyectos];
        }
        if (!Number.isNaN(x)) {
          if (!this.centrosX[proyecto].includes(x)) {
            this.centrosX[proyecto].push(x);
          }
        }
      } else {
        const proyecto = label['$context']['dataset'].stack,
         elemento = label['_el'],
         //x = elemento['_view'].x;
         x = elemento.x;

        if (this.centrosX[proyecto] == undefined) {
          this.centrosX[proyecto] = [];
          this.proyectos = [proyecto, ...this.proyectos];
        }
        if (!this.centrosX[proyecto].includes(x)) {
          this.centrosX[proyecto].push(x);
        }
      }
    });
  }

  private agregaTitulosProyectos(chart: any) {
    // Se agrega los titulos de las barras de varios proyectos (solo cuando son más de uno)
    const ctx = chart.canvas.getContext('2d'),
      labels = chart['$datalabels']['_labels'],
      centroY = chart['boxes'][2].height / 2;

    this.iniciaPosiciones(chart);
    if (labels.length == 0) {
      return;
    }
    ctx.font = labels[0]['_ctx'].font; //'30px Comic Sans MS';
    ctx.fillStyle = 'gray';
    ctx.textAlign = 'center';
    if (this.proyectos.length < 2) {
      return;
    }
    // ctx.clearRect( 0, 0,this.canvas.width, chart['boxes'][1].height*3/4 );
    this.proyectos.forEach((proyecto, index) => {
      this.centrosX[proyecto].forEach(x => {
        ctx.fillText((index + 1).toString(), x, centroY);
      });
    });
  }

  // Control de eventos en la grafica

  /*public onMouseDown(e: any) {
    const limiteInferior =
      this.chartDir.chart.height - this.chartDir.chart['boxes'][2].height,
     limiteSuperior = this.chartDir.chart['boxes'][1].height;

    if (e.offsetY > limiteInferior) {
      // Control de click en etiquetas
      const seleccion = this.getEtiquetaCercana(e);
      this.focusColumnas(seleccion);
    } else if (e.offsetY < limiteSuperior) {
      // Control de click de Proyecto
      this.focusProyecto(e);
    } else {
      //this.togglePorcentaje();
    }
  }*/

  private focusProyecto(e: any) {
    // Selecciona todas las barras de un proyecto cuando se hace click en el area superior de la grafica
    const labels = this.chartDir.chart['$datalabels']['_labels'];
    let stack = null;
    if (!this.Bandera_bar) {
      labels.some(label => {
        const elemento = label['_el'];
        if (elemento.inXRange(e.native.offsetX)) {
          stack = label['$context']['dataset'].stack;
          return true;
        }
      });

      if (this.lastClick !== stack) {
        this.barChartData['datasets'].forEach((data, index) => {
          const color = new Array(data.data.length);
          if (data.stack == stack) {
            color.fill(this.colores[data.label]);
          } else {
            color.fill(this.coloresBW[data.label]);
          }
          this.barChartData['datasets'][index].backgroundColor = color;
          this.barChartData['datasets'][index].hoverBackgroundColor = color;
        });
        this.chartDir.update();
        this.lastClick = stack;
      } else {
        this.resetColores();
        this.lastClick = null;
      }
    }
  }

  public focusColumnas(seleccion: any) {
    // Selecciona todas las barras de una categoria cuando se hace click en la etiqueta
    const selec = seleccion;
    if (this.lastClick !== seleccion.label) {
      if (this.Bandera_bar) {
        if (this.banderaImpacto) {
          let nivelesAux = [],
          count = -1;
          this.barChartData['datasets'].forEach((datos, index) => {
            let color = new Array(datos.data.length);
            const coloraux = [];
            if (!nivelesAux.includes(datos.label)) {
              nivelesAux.push(datos.label);
              count += 1;
            } else {
              nivelesAux = [];
              nivelesAux.push(datos.label);
              count = 0;
            }
            this.ElementosEnNiveles[index].forEach((element, ii) => {
              if (ii == seleccion.index) {
                if (element === this.elementoConstructivo) {
                  coloraux.push(this.auxColor[count]);
                } else {
                  coloraux.push(this.auxColorBW[count]);
                }
              } else {
                coloraux.push(this.auxColorBW[count]);
              }
            });
            color = coloraux;

            this.barChartData['datasets'][index].backgroundColor = color;
            this.barChartData['datasets'][index].hoverBackgroundColor = color;
          });
        } else {
          let nivelesAux = [],
           count = -1;
           this.barChartData['datasets'].forEach((datos, index) => {
            let color = new Array(datos.data.length);
            if (!nivelesAux.includes(datos.label)) {
              nivelesAux.push(datos.label);
              count += 1;
            } else {
              nivelesAux = [];
              nivelesAux.push(datos.label);
              count = 0;
            }
            if (this.elementoConstructivo != ' ') {
              const coloraux = [];
              this.ElementosEnNiveles[index].forEach((element, ii) => {
                if (ii == seleccion.index) {
                  if (element === this.elementoConstructivo) {
                    coloraux.push(this.auxColor[count]);
                  } else {
                    coloraux.push(this.auxColorBW[count]);
                  }
                } else {
                  coloraux.push(this.auxColorBW[count]);
                }
              });
              color = coloraux;
            } else {
              color.fill(this.auxColorBW[count]);
              color[seleccion.index] = this.auxColor[count];
            }
            this.barChartData['datasets'][index].backgroundColor = color;
            this.barChartData['datasets'][index].hoverBackgroundColor = color;
          });
          this.chartDir.update();
        }
        this.lastClick = seleccion.label;
      } else {
        this.barChartData['datasets'].forEach((datos, index) => {
          const color = new Array(datos.data.length);
          color.fill(this.coloresBW[datos.label]);
          color[seleccion.index] = this.colores[datos.label];
          this.barChartData['datasets'][index].backgroundColor = color;
          this.barChartData['datasets'][index].hoverBackgroundColor = color;
        });
        this.chartDir.update();
        this.lastClick = seleccion.label;
      }
      this.showMe = false;
    } else {
      if (this.Bandera_bar) {
        //
      } else {
        this.showMe = true;
      }
      this.resetColores();
      this.lastClick = null;
    }
    if (this.Bandera_bar) {
      //aqui faltara uno que mande el color de los elementos constructivos
      const aux = {
        niveles: this.auxElementos,
        seleccion: this.lastClick,
        color: this.auxColor,
        selec: selec,
        nivelesProyectos: this.auxElemntosData,
      };
      //console.log(this.auxElementos,this.barChartData)
      this.ClickEvent.emit(aux);
    } else {
      if (this.lastClick !== null) {
        const auxLast = this.lastClick.slice(0, -1);
        this.lastClickEvent.emit(auxLast);
      } else {
        this.lastClickEvent.emit(this.lastClick);
      }
    }
  }

  /*private getEtiquetaCercana(e: any) {
    // Obtiene la etiqueta mas cercana al click en el eje X de acuerdo con barChartLabels
    const etiquetas = this.chartDir.chart['boxes'][2]['_labelItems'];
    let max = this.chartDir.chart.width,
     seleccion = '',
     indice = -1;

    etiquetas.forEach((etiqueta, i) => {
      const distancia = Math.abs(etiqueta.x - e.offsetX);
      if (distancia < max) {
        max = distancia;
        seleccion = etiqueta.label;
        indice = i;
      }
    });
    return { label: seleccion, index: indice };
  }*/

  public onHover(e: any) {
    // Controla el flujo de hover sobre los elementos de las barras
    //console.log(this.showMe);
    if (this.showMe) {
      if (this.hovered !== null && this.hovered !== undefined) {
        //console.log(this.showMe);
        const serie = this.chartDir.chart.data.datasets[this.hovered.datasetIndex].label;
        if (this.hovered.element.inRange(e.offsetX, e.offsetY)) {
          if (this.lastClick !== serie) {
            this.focusSeries(serie);
            this.lastClick = serie;
          }
        } else {
          this.resetColores();
          this.hovered = null;
          this.lastClick = null;
        }
      }
    }
  }

  public resetColores() {
    // Pone todas las series en color normal
    if (this.Bandera_bar) {
      let nivelesAux = [],
       count = -1;
      this.barChartData['datasets'].forEach((data, index) => {
        if (!nivelesAux.includes(data.label)) {
          nivelesAux.push(data.label);
          count += 1;
        } else {
          nivelesAux = [];
          nivelesAux.push(data.label);
          count = 0;
        }
        const color = this.auxColor[count];
        // use [...[color]] to force a new array reference
        this.barChartData['datasets'][index].backgroundColor = [...[color]];
        this.barChartData['datasets'][index].hoverBackgroundColor = [...[color]];
      });
    } else {
      this.barChartData['datasets'].forEach((data, index) => {
        const color = this.colores[data.label];
        // use [...[color]] to force a new array reference
        this.barChartData['datasets'][index].backgroundColor = [...[color]];
        this.barChartData['datasets'][index].hoverBackgroundColor = [...[color]];
      });
    }
    this.chartDir.update();
  }

  public focusSeries(serie) {
    // Pone la serie seleccionada de color normal, el resto se pone en blanco y negro
    let count = -1,
     nivelesAux = [];
    this.barChartData['datasets'].forEach((datos, index) => {
      let color: any;
      if (this.Bandera_bar) {
        const coloraux = [];
        if (!nivelesAux.includes(datos.label)) {
          nivelesAux.push(datos.label);
          count += 1;
        } else {
          nivelesAux = [];
          nivelesAux.push(datos.label);
          count = 0;
        }
        this.ElementosEnNiveles[index].forEach(element => {
          if (element === serie) {
            coloraux.push(this.auxColor[count]);
          } else {
            coloraux.push(this.auxColorBW[count]);
          }
        });
        color = coloraux;
        // TODO: not sure when this color value is used.
        // Need to check if color is an array or not and maybe cast it
      } else {
        //console.log(this.banera_enfoqueSerie_externo,serie);
        if (datos.label !== serie) {
          color = this.coloresBW[datos.label];
        } else {
          color = this.colores[datos.label];
        }
      }
      // use [...[color]] to force a new array reference
      this.barChartData['datasets'][index].backgroundColor = [...[color]];
      this.barChartData['datasets'][index].hoverBackgroundColor = [...[color]];
    });
    if (this.Bandera_bar) {
      //
    } else {
      this.chartDir.update();
    }
  }

  public onChartHover( { event }: { event?: ChartEvent; } ): void {
    // Asigna el elemento de la grafica sobre el cual se hace hover
    this.hovered = this.chartDir['chart'].getElementsAtEventForMode(event.native, 'nearest', { intersect: true }, false)[0];

    // if(!this.hoverIniciado){
    //   this.hoverIniciado = true;
    //   console.log('hovered')
    // // Ya que se inicializa el componente
    //   this.canvas = this.chartDir.chart.canvas;
    //   this.canvas.addEventListener('mousemove', e => { this.onHover(e); });
    //   this.canvas.addEventListener('mousedown', e => { this.onMouseDown(e); });
    // }
  }

  public onChartClick(e: any): void {}

  ajustarNombre(name: string) {
    let help = name,
     spacios = 0,
     numC = 0,
     maxlinea = 0;
    for (const i of help) {
      if (i === ' ') {
        spacios = spacios + 1;
        if (spacios == 1 && maxlinea >= 9) {
          help = [help.slice(0, numC), '\n', help.slice(numC)].join('');
          spacios = 0;
          maxlinea = 0;
          numC = numC + 1;
        }
        if (spacios == 2) {
          help = [help.slice(0, numC), '\n', help.slice(numC)].join('');
          spacios = 0;
          numC = numC + 1;
        }
      }
      maxlinea = maxlinea + 1;
      numC = numC + 1;
    }

    return help;
  }
}
