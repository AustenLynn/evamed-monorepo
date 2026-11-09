import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { EMPTY, of } from 'rxjs';
import { ExplorerUiModule } from '../../../explorer/explorer-ui.module';
import { MaterialDetail } from '../../../explorer/explorer.models';
import { ExplorerService } from '../../../explorer/services/explorer.service';
import { ExplorerFeed } from '../../../explorer/services/explorer-feed';
import { CatalogsService } from '../../../core/services/catalogs/catalogs.service';
import { EvUiModule } from '../ui.module';

const material: MaterialDetail = {
  id: 12, stage: 'produccion', name: 'Ejemplo_Concreto AAC', display_name: 'Concreto AAC · ejemplo de referencia',
  category: 'Concreto', region: 'México', description: 'Datos sintéticos para revisar componentes. No representan un producto ni un cálculo de proyecto.',
  source: 'ECOINVENT 3', unit: 'kg', gwp: 0.4, impact_level: 'bajo', ecoinvent: null, indicators: [], comparison: null,
},
 page = {count: 1, next: null, previous: null, results: [material], facets: {sources: {'ECOINVENT 3': 1}}};
/** Development only. Uses the actual feature components with local synthetic data. */
@Component({selector: 'app-design-system-reference', standalone: true, imports: [CommonModule, EvUiModule, ExplorerUiModule],
  templateUrl: './reference.component.html', styleUrls: ['./reference.component.scss'], providers: [
    {provide: ExplorerService, useValue: {feed: ()=>new ExplorerFeed(()=>of(page)), material: ()=>of(material)}},
    {provide: CatalogsService, useValue: {getTransports: ()=>of([{id: 1, name_transport: 'Barco'}, {id: 4, name_transport: 'Camión'}])}},
    {provide: MAT_DIALOG_DATA, useValue: {system: 'Sistema de ejemplo', section: 'Cimentación', projectLife: 50}},
    {provide: MatDialogRef, useValue: {close: ()=>undefined, backdropClick: ()=>EMPTY, keydownEvents: ()=>EMPTY}},
  ]})
export class ReferenceComponent {
  readonly material = material;
  readonly context = {system: 'Sistema de ejemplo', section: 'Cimentación', projectLife: 50};
  readonly pending = signal(false);
  readonly items = signal([{id: 73, name: 'Material con un nombre muy largo para revisar el espacio disponible y la eliminación por teclado'}, {id: 74, name: 'Otro material'}]);
  readonly message = signal('');
  remove(id:number):void {this.items.update(items=>items.filter(item=>item.id !== id));}
}
