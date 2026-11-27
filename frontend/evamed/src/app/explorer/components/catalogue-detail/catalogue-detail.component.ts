import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { BehaviorSubject, combineLatest, Observable, of } from 'rxjs';
import { catchError, map, startWith, switchMap } from 'rxjs/operators';

import { CatalogueDetail } from '../../explorer.models';
import { ExplorerService } from '../../services/explorer.service';

type Load = { status: 'loading' } | { status: 'error' } | { status: 'ready'; detail: CatalogueDetail };

/** Detail sheet of an equipment or use source, inside its picker (2026-11-27). Only stored data. */
@Component({
  selector: 'app-catalogue-detail',
  templateUrl: './catalogue-detail.component.html',
  styleUrls: ['../material-detail/material-detail.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class CatalogueDetailComponent implements OnChanges {
  @Input({ required: true }) stage!: 'construccion' | 'uso';
  @Input({ required: true }) itemId!: number;
  /** The picker's action for this item ('Agregar a la selección', 'Elegir este equipo', …); none hides it. */
  @Input() actionLabel: string | null = null;
  @Input() disabled = false;
  @Output() readonly back = new EventEmitter<void>();
  @Output() readonly action = new EventEmitter<void>();

  private readonly key$ = new BehaviorSubject<{ stage: 'construccion' | 'uso'; id: number } | null>(null);
  private readonly retry$ = new BehaviorSubject<void>(undefined);
  readonly load$: Observable<Load>;

  constructor(private explorer: ExplorerService) {
    this.load$ = combineLatest([this.key$, this.retry$]).pipe(
      switchMap(([key]) => key === null ? of<Load>({ status: 'loading' }) : this.explorer.catalogueDetail(key.stage, key.id).pipe(
        map(detail => ({ status: 'ready', detail }) as Load),
        catchError(() => of<Load>({ status: 'error' })),
        startWith<Load>({ status: 'loading' }),
      )),
    );
  }

  ngOnChanges(): void {
    if (this.stage && this.itemId) this.key$.next({ stage: this.stage, id: this.itemId });
  }

  retry(): void {
    this.retry$.next();
  }
}
