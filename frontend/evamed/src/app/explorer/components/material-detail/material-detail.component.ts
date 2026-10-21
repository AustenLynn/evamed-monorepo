import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, startWith, switchMap } from 'rxjs/operators';

import { Comparison, MaterialDetail } from '../../explorer.models';
import { ExplorerService } from '../../services/explorer.service';

type Load = { status: 'loading' } | { status: 'error'; notFound: boolean } | { status: 'ready'; detail: MaterialDetail };

interface Bar {
  label: string;
  value: number;
  width: number;
  current: boolean;
}

/** Ficha de material (HANDOFF §4, screen 02). */
@Component({
  selector: 'app-material-detail',
  templateUrl: './material-detail.component.html',
  styleUrls: ['./material-detail.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class MaterialDetailComponent implements OnChanges {
  @Input({ required: true }) materialId!: number;
  /** Offers "Seleccionar recurso" (the stage page's picker); the browse-only page doesn't. */
  @Input() canSelect = false;
  @Output() readonly selected = new EventEmitter<MaterialDetail>();
  /** With canSelect: whether the material is in the picker's selection, and the button that toggles it. */
  @Input() inSelection = false;
  @Output() readonly selectToggle = new EventEmitter<MaterialDetail>();

  private readonly id$ = new BehaviorSubject<number | null>(null);
  private readonly retry$ = new BehaviorSubject<void>(undefined);
  readonly load$: Observable<Load>;
  descriptionOpen = false;

  constructor(private explorer: ExplorerService) {
    this.load$ = this.retry$.pipe(
      switchMap(() => this.id$),
      switchMap(id =>
        id === null
          ? of<Load>({ status: 'loading' })
          : this.explorer.material(id).pipe(
              map(detail => ({ status: 'ready', detail }) as Load),
              catchError(error => of<Load>({ status: 'error', notFound: error?.status === 404 })),
              startWith<Load>({ status: 'loading' })
            )
      )
    );
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['materialId']) {
      this.descriptionOpen = false;
      this.id$.next(this.materialId);
    }
  }

  retry(): void {
    this.retry$.next();
  }

  /** This material, the group's mean and its best quarter, on one scale. */
  bars(comparison: Comparison): Bar[] {
    const rows = [
        { label: 'Este material', value: comparison.value, current: true },
        { label: `Promedio de ${comparison.n} materiales`, value: comparison.mean, current: false },
        { label: 'Mejor 25 %', value: comparison.p25, current: false },
      ],
      max = Math.max(...rows.map(row => Math.abs(row.value))) || 1;
    return rows.map(row => ({ ...row, width: Math.max(2, (Math.abs(row.value) / max) * 100) }));
  }
}
