import { Component, Input, OnInit, ViewChild } from '@angular/core';
import { ChartOptions, ChartType } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { MatCardModule } from '@angular/material/card';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-radial-chart',
    templateUrl: './radial-chart.component.html',
    styleUrls: ['./radial-chart.component.scss'],
    imports: [BaseChartDirective, MatCardModule, CommonModule]
})
export class RadialChartComponent implements OnInit {
  @ViewChild('MyChart') chartDir: BaseChartDirective;
  @Input() inputProyect:any;
  @Input() showMe: boolean;
  @Input() id:string;
  @Input() impactos:any;
  subtitulo: string;


  private backcolores: any[] = [
     'rgba(77,190,137,0.2)',
     'rgba(20,136,147,0.2)',
     'rgba(143,80,145,0.2)',
     'rgba(222,169,97,0.2)'];

  private pointcolores: any[] = [
    '#4DBE89',
    '#148A93',
    '#8F5091',
    '#DEA961'
  ];

  public radarChartOptions: ChartOptions = {
    responsive: true,
    layout: {
      padding: 0,
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: { enabled: false },
      datalabels: {
        display: false
      }
    },
    scales: {
      r: {
        pointLabels: {
          font: {
            size: 12,
          }
        },
        ticks: {
          font: {
            size: 7,
          }
        },
      }
    }
  }

  public radarChartData = [];
  public radarChartType: ChartType = 'radar';
  public radarChartLabels: BaseChartDirective["labels"];
  public chartData = {};

  constructor() { }

  ngOnInit(): void {
    this.cargarDatos(this.id);
    console.log("Radar");
  }

  cargarLabels(ID:string) {
    this.radarChartLabels = [];
    this.subtitulo = ID;
    this.inputProyect.forEach(proyecto => {
      Object.keys(proyecto.Datos).forEach(indicador => {
        if (indicador === ID) {
          Object.keys(proyecto.Datos[indicador]).forEach(element => {
            let auxAbr = ""
            this.impactos.forEach(impacto => {
              const auxNameImpacto = this.ajustarNombre(impacto['name_complete_potential_type']);
              if(element === auxNameImpacto) {
                auxAbr = impacto['name_potential_type']
              }
            });
            if (!this.radarChartLabels.includes(auxAbr)) {
              this.radarChartLabels = [...this.radarChartLabels, auxAbr];
            }
          });
        }
      });
    });
    this.chartData['labels'] = this.radarChartLabels;
  }

  cargarDatos(ID:string) {
    this.radarChartData = [];
    const auxlabel = ['Producción', 'Construccion', 'Uso', 'FinDeVida'];
    let auxdata = [],
     auxdatos = [],
     datos = [],
     bcolor = '',
     pcolor = '';
    this.cargarLabels(ID);
    this.subtitulo = ID;

    Object.keys(auxlabel).forEach(indicador => {
      if (auxlabel[indicador] === ID) {
        bcolor = this.backcolores[indicador];
        pcolor = this.pointcolores[indicador];
      }
    });
       //console.log(suma)
    this.inputProyect.forEach(proyecto => {
      console.log(proyecto)
      const valores_suma = [];
      Object.keys(proyecto.Datos[auxlabel[0]]).forEach(element => {
        valores_suma[element] = 0;
      });
      Object.keys(auxlabel).forEach(indicador => {
        auxdatos = proyecto.Datos[auxlabel[indicador]]
        Object.keys(proyecto.Datos[auxlabel[indicador]]).forEach(element => {
          valores_suma[element] = valores_suma[element] + auxdatos[element];
        });
      })
      Object.keys(auxlabel).forEach(indicador => {
        if (auxlabel[indicador] === ID) {
          auxdatos = proyecto.Datos[auxlabel[indicador]]
          Object.keys(proyecto.Datos[auxlabel[indicador]]).forEach(element => {
            datos = [...datos, ((auxdatos[element] * 100) / valores_suma[element]).toFixed(2)];
          });
        }
      });
      auxdata = [
        {
          data: datos,
          backgroundColor: bcolor,
          pointBackgroundColor: pcolor,
          borderColor: "transparent",
          borderWidth: 0.1,
          label: `${ID}-${proyecto.id}`,
          project: proyecto.Nombre,
          fill: 'start'
        }
      ];
      this.radarChartData.push({ labels: this.chartData['labels'], datasets: auxdata });
      datos = [];
      auxdata = [];
      auxdatos = [];
    });

  }

  ajustarNombre(name: string) {
    let help = name,
     spacios = 0,
     numC = 0,
     maxlinea = 0;
    for (const i of help) {
      if(i === ' ') {
        spacios = spacios + 1;
        if(spacios == 1 && maxlinea >= 9) {
          help = [help.slice(0, numC), '\n', help.slice(numC)].join('');
          spacios = 0;
          maxlinea = 0;
          numC = numC + 1;
        }
        if(spacios == 2) {
          help = [help.slice(0, numC), '\n', help.slice(numC)].join('');
          spacios = 0;
          numC = numC + 1;
        }
      }
      maxlinea = maxlinea + 1;
      numC = numC + 1;
    }

    return help
  }

}
