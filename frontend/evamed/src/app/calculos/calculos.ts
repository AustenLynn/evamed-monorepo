import { valorReferenciaCarbono } from '../home-evamed/climate';
import subetapasInfo from 'src/app/calculos/Subetapas.json';
import escalasCarbono from 'src/app/calculos/EscalasCarbono.json';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class Calculos {
  subetapas_list: any = subetapasInfo;
  catalogoEscalasCarbono :any = escalasCarbono;

  impactosIgnorar2 = [
    'PARNR',
    'POT',
    'Human toxicity',
    'Fresh water aquatic ecotox.',
    'Marine aquatic ecotoxicity',
    'Terrestrial ecotoxicity',
  ];

  constructor(
  ) {}

  ValoresProcentaje(data, ignorar) {
    const auxsumetapa = {};
    Object.keys(data).forEach(element => {
      let auxsumimpacto = 0;
      auxsumetapa[element] = {};
      let flag = true;
      Object.keys(data[element]).forEach(etapa => {
        ignorar.forEach(element => {
          if(element == etapa)
            flag = false;
        });
        Object.keys(data[element][etapa]).forEach(subetapa => {
          if(flag) {
            auxsumimpacto = auxsumimpacto + data[element][etapa][subetapa];
          }
        });
        flag = true;
      });
      Object.keys(data[element]).forEach(etapa => {
        flag = true;
        let auxsumET = 0;
        ignorar.forEach(element => {
          if(element == etapa)
            flag = false
        });
        auxsumetapa[element][etapa] = {};
        auxsumetapa[element][etapa]['num'] = 0;
        if(flag) {
          Object.keys(data[element][etapa]).forEach(subetapa => {
            auxsumetapa[element][etapa]['num'] =
              auxsumetapa[element][etapa]['num'] + data[element][etapa][subetapa];
          });
        }
        auxsumET = auxsumetapa[element][etapa]['num'];
        auxsumetapa[element][etapa]['num'] =
        auxsumetapa[element][etapa]['num'].toExponential(2);
        if(auxsumimpacto != 0) {
          auxsumetapa[element][etapa]['porcentaje'] = (
            (auxsumET / auxsumimpacto) *
            100
          ).toFixed(2);
        }else{
          auxsumetapa[element][etapa]['porcentaje'] = 0
        }
      });
    });

    return auxsumetapa;
  }

  ValoresProcentajeSubeapa(data, ignorar) {
    const auxsumetapa = {};
    let flag = true;
    Object.keys(data).forEach(element => {
      let auxsumimpacto = 0;
      auxsumetapa[element] = {};
      Object.keys(data[element]).forEach(etapa => {
        ignorar.forEach(element => {
          if(element == etapa)
            flag = false;
        });
        if(flag) {
          Object.keys(data[element][etapa]).forEach(subetapa => {
            auxsumimpacto = auxsumimpacto + data[element][etapa][subetapa];
          });
        }
        flag = true;
      });
      Object.keys(data[element]).forEach(etapa => {
        ignorar.forEach(element => {
          if(element == etapa)
            flag = false;
        });
        auxsumetapa[element][etapa] = {};
        Object.keys(data[element][etapa]).forEach(subetapa => {
          auxsumetapa[element][etapa][subetapa] = {};
          if(flag) {
            auxsumetapa[element][etapa][subetapa]['num'] =
              data[element][etapa][subetapa].toExponential(2);
          }else{
            auxsumetapa[element][etapa][subetapa]['num'] = 0;
          }
          if(auxsumimpacto != 0) {
            auxsumetapa[element][etapa][subetapa]['porcentaje'] = (
              (auxsumetapa[element][etapa][subetapa]['num'] / auxsumimpacto) *
              100
            ).toFixed(1);
          }else{
            auxsumetapa[element][etapa][subetapa]['porcentaje'] = 0
          }
        });
        flag = true
      });
    });

    return auxsumetapa;
  }

  Porcentaje(data) {
    let sum = 0;
    const auxdata = [];
    data.forEach(element => {
      sum = sum + Number(element);
    });
    data.forEach(element => {
      auxdata.push((Number(element) / sum * 100).toFixed(1));
    });
    return auxdata;
  }

  ImpactosSeleccionados(potList) {
    let impacto_ban = true;
    const auxNombre = [];
    let auxnombreSalto: string;
    auxNombre.push("ciclo de vida")
    potList.forEach(impacto => {
      this.impactosIgnorar2.forEach(ignorar => {
        if (impacto['name_potential_type'] === ignorar) {
          impacto_ban = false;
        }
      });
      if (impacto_ban) {
        auxnombreSalto = impacto['name_complete_potential_type'];
        auxNombre.push(auxnombreSalto);
        //auxNombre.push(this.ajustarNombre(auxnombreSalto));
      }
      impacto_ban = true;
    });
    return auxNombre;
  }

  FiltradoDeImpactos(data) {
    const aux = [9, 10, 11, 12, 13, 14];
    let b = true;
    const auxdata = [];
    data.forEach(element => {
      aux.forEach(ignorar => {
        if (element['id'] == ignorar) {
          b = false;
        }
      });
      if (b) {
        auxdata.push(element);
      }
    });
    return auxdata;
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

  findColor(subetapa) {
    const sub = this.subetapas_list.filter(s => s['abreviacion'] === subetapa);
    return sub[0]['color'];
  }

  findSubetapas(etapa, impactoS, porcentajesMostrados) {
    const auxReturn = []
    Object.keys(porcentajesMostrados).forEach(impacto => {
      const auxIDImpacto = this.ajustarNombre(impactoS)
      if(impacto === auxIDImpacto) {
        Object.keys(porcentajesMostrados[impacto]).forEach(ciclo =>{
          if(ciclo === etapa) {
            Object.keys(porcentajesMostrados[impacto][ciclo]).forEach(subEtapa =>{
              const aux = this.subetapas_list.filter(s => s['abreviacion'] == subEtapa);
              auxReturn.push(aux[0])
            })
          }
        })
      }
    })
    return auxReturn;
  }

  llenarGraficaCarbono(opcion) {
    const auxdata = [],
      auxcolor = [],
      auxlabels = [],
      auxDataLabels = {1: "A", 2: "B", 3: "C", 4: "D", 5: "E", 6: "F", 7: "G"};
    let aux = [];
    this.catalogoEscalasCarbono.forEach(element => {
      if(element.nombre_caso === opcion) {
        for (let _i = 1; _i < 8; _i++) {
          let auxl = "",
           auxv = 0
          const valor = "valor_".concat(_i.toString()),
            color = "color_".concat(_i.toString())
          auxcolor.push(element[color])
          if(element[valor].length > 1) {
            auxl = auxl.concat((element[valor][0]).toString()).concat(" - ").concat((element[valor][1]).toString())
            if(_i != 1) {
              const auxValor = "valor_".concat((_i - 1).toString());
              auxv = element[auxValor][0]
            }
            auxdata.push(element[valor][1] + auxv)
          }else{
            if(_i == 1) {
              auxl = auxl.concat((element[valor][0]).toString()).concat(" < ")
              auxdata.push(element[valor][0])
            }else{
              const auxValor = "valor_".concat((_i - 1).toString());
              auxv = element[auxValor][0]
              auxl = auxl.concat((element[valor][0]).toString()).concat(" > ")
              auxdata.push(element[valor][0] + auxv)
            }
          }
          auxl = auxl.concat(" : ").concat(auxDataLabels[_i])
          auxlabels.push(auxl)
        }
      }
    });
    aux = [...aux,
    {
      data: auxdata,
      backgroundColor: auxcolor,
      hoverBackgroundColor: '#FF829DCC'
    }]
    return {datasets: aux, labels: auxlabels}
  }

  determinaValorCarbono(data, projectL, idP, UFL) {
    // EN 15804+A2 climate change total when served, else the CML indicator (owner-approved, 2026-11-20).
    const a2Total = this.ajustarNombre("Calentamiento global, total");
    const impacto = data[a2Total] ? a2Total : this.ajustarNombre("Calentamiento Global");
    let res = 0;
    Object.keys(data[impacto]["Uso"]).forEach(subetapa =>{
      res += data[impacto]["Uso"][subetapa]
    })
    const proyecto = projectL.find(p => p['id'] == idP),
      vida = UFL.find(p => p['id'] == proyecto?.['useful_life_id']);
    // Null instead of Infinity/NaN or a misleading 0 "A" (audit A-28).
    return valorReferenciaCarbono(res, Number(proyecto?.['living_area']), Number(vida?.['name_useful_life']));
  }

  determinarDescripcionCarbono(opcion) {
    let aux = ""
    this.catalogoEscalasCarbono.forEach(element => {
      if(element.nombre_caso === opcion) {
        aux = element['descripcion']
      }
    });
    return aux
  }

  buscarValosCarbono(data, opcion, projectL, idP, UFL) {
    const aux = {},
      valorCarbono = this.determinaValorCarbono(data, projectL, idP, UFL);
    // No value: no band is marked (null would compare as 0 and light up "A").
    if (valorCarbono === null) return aux;
    this.catalogoEscalasCarbono.forEach(element => {
      if(element.nombre_caso === opcion) {
        for (let _i = 1; _i < 8; _i++) {
          const valor = "valor_".concat(_i.toString()),
            color = "color_".concat(_i.toString());
          aux[valor] = "#FFFFFF"
          if(element[valor].length > 1) {
            if ((valorCarbono <= element[valor][1]) && (valorCarbono >= element[valor][0])) {
              aux[valor] = element[color]
            }
          }else{
            if(_i == 1) {
              if(valorCarbono < element[valor][0]) {
                aux[valor] = element[color]
              }
            }else{
              if(valorCarbono > element[valor][0]) {
                aux[valor] = element[color]
              }
            }
          }
        }
      }
    });
    return aux
  }
}
