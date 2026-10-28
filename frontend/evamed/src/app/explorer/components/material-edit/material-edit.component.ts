import { ChangeDetectionStrategy, Component, EventEmitter, HostBinding, Input, OnInit, Output } from '@angular/core';
import { AbstractControl, FormBuilder, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { CatalogsService } from '../../../core/services/catalogs/catalogs.service';
import { MaterialDetail } from '../../explorer.models';
import {
  DEFAULT_TRANSPORT_END,
  DEFAULT_TRANSPORT_ORIGIN,
  lifeFor,
  PickedMaterial,
  PickerContext,
  PickerInitial,
  replacesFor,
} from '../../picker.models';

interface TransportOption {
  id: number;
  name: string;
}

/** A distance needs a transport type to count (HANDOFF §4 validation). */
const legNeedsTransport =
  (distance: string, transport: string): ValidatorFn =>
  (group: AbstractControl): ValidationErrors | null => {
    const km = Number(group.get(distance)?.value);
    return km > 0 && !group.get(transport)?.value ? { [`${transport}Required`]: true } : null;
  };

/** Edición de material en el proyecto (HANDOFF §4, screen 03). */
@Component({
  selector: 'app-material-edit',
  templateUrl: './material-edit.component.html',
  styleUrls: ['./material-edit.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class MaterialEditComponent implements OnInit {
  @Input({ required: true }) detail!: MaterialDetail;
  @Input({ required: true }) context!: PickerContext;
  /** Materials are already ticked in the picker: saving joins them (R-43). */
  @Input() inSelection = false;
  /** The picker is saving: a second click would add the material twice. */
  @Input() saving = false;
  /** 'panel': one column, summary first, for the stage page's Materiales panel. */
  @Input() layout: 'dialog' | 'panel' = 'dialog';
  /** "Ver ficha completa", with the form's values so far. */
  @Output() readonly back = new EventEmitter<PickerInitial>();
  @Output() readonly cancelled = new EventEmitter<void>();
  /** Edit mode: pick another catalogue material for this row, with the form's values so far. */
  @Output() readonly changeMaterial = new EventEmitter<PickerInitial>();

  @HostBinding('class.edit--panel') get inPanel(): boolean {
    return this.layout === 'panel';
  }
  @Output() readonly save = new EventEmitter<PickedMaterial>();

  readonly transports$: Observable<TransportOption[]>;
  readonly form;
  submitted = false;

  constructor(
    private fb: FormBuilder,
    catalogs: CatalogsService
  ) {
    this.transports$ = catalogs.getTransports().pipe(
      map((rows: { id: number; name_transport: string }[]) =>
        rows
          .map(row => ({ id: row.id, name: cleanTransport(row.name_transport) }))
          .sort((a, b) => a.id - b.id)
      )
    );
    this.form = this.fb.nonNullable.group(
      {
        comercialName: ['', Validators.required],
        quantity: [null as number | null, [Validators.required, Validators.min(Number.MIN_VALUE)]],
        comments: [''],
        transportOrigin: [DEFAULT_TRANSPORT_ORIGIN as number | null],
        distanceOrigin: [null as number | null, Validators.min(0)],
        transportEnd: [DEFAULT_TRANSPORT_END as number | null],
        distanceEnd: [null as number | null, Validators.min(0)],
        lifeYears: [0, [Validators.required, Validators.min(1)]],
        replaces: [0, [Validators.required, Validators.min(0)]],
      },
      {
        validators: [
          legNeedsTransport('distanceOrigin', 'transportOrigin'),
          legNeedsTransport('distanceEnd', 'transportEnd'),
        ],
      }
    );
  }

  get editing(): boolean {
    return this.context.mode === 'edit';
  }

  get submitLabel(): string {
    if (this.saving) {
      return 'Agregando…';
    }
    if (this.inSelection) {
      return 'Agregar a la selección';
    }
    return this.editing ? 'Guardar cambios' : 'Agregar material';
  }

  /** The row was entered in another unit than the catalogue's declared one. */
  get unitMismatch(): string | null {
    const unit = this.context.initial?.rowUnit;
    return unit && this.detail.unit && unit.toLowerCase() !== this.detail.unit.toLowerCase() ? unit : null;
  }

  ngOnInit(): void {
    const life = this.context.projectLife,
      initial = this.context.initial;
    this.form.patchValue({
      comercialName: this.detail.display_name,
      lifeYears: life,
      replaces: replacesFor(life, life),
    });
    if (initial) {
      // "Cambiar material" picked another one: its name replaces the old row's.
      const replaces = initial.replaces ?? 0,
        changed = this.detail.id !== this.context.materialId;
      this.form.patchValue({
        comercialName: (!changed && initial.comercialName) || this.detail.display_name,
        quantity: initial.quantity,
        comments: initial.comments,
        transportOrigin: initial.transportOrigin,
        distanceOrigin: initial.distanceOrigin,
        transportEnd: initial.transportEnd,
        distanceEnd: initial.distanceEnd,
        replaces,
        lifeYears: lifeFor(life, replaces),
      });
    }
  }

  /** Life and replacements follow each other, as in the stage pages (K-09). */
  onLifeChange(): void {
    const life = Number(this.form.controls.lifeYears.value);
    if (life > 0) {
      this.form.controls.replaces.setValue(replacesFor(this.context.projectLife, life));
    }
  }

  onReplacesChange(): void {
    const replaces = Number(this.form.controls.replaces.value);
    if (replaces >= 0) {
      this.form.controls.lifeYears.setValue(lifeFor(this.context.projectLife, replaces));
    }
  }

  submit(): void {
    if (this.saving) {
      return;
    }
    this.submitted = true;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue(),
      number = (input: number | null) => (input === null || String(input) === '' ? null : Number(input));
    this.save.emit({
      material: {
        id: this.detail.id,
        name: this.detail.name,
        unit: this.detail.unit,
        source: this.detail.source,
      },
      comercialName: value.comercialName.trim(),
      quantity: Number(value.quantity),
      comments: value.comments.trim(),
      transportOrigin: value.transportOrigin,
      distanceOrigin: number(value.distanceOrigin),
      transportEnd: value.transportEnd,
      distanceEnd: number(value.distanceEnd),
      lifeYears: Number(value.lifeYears),
      replaces: Number(value.replaces),
    });
  }

  /** The form's values as a starting point, to carry them over to another material. */
  currentValues(): PickerInitial {
    const value = this.form.getRawValue(),
      number = (input: number | null) => (input === null || String(input) === '' ? null : Number(input));
    return {
      comercialName: value.comercialName,
      quantity: number(value.quantity),
      comments: value.comments,
      transportOrigin: value.transportOrigin,
      distanceOrigin: number(value.distanceOrigin),
      transportEnd: value.transportEnd,
      distanceEnd: number(value.distanceEnd),
      replaces: number(value.replaces),
      rowUnit: this.context.initial?.rowUnit ?? null,
    };
  }

  error(name: string): boolean {
    const control = this.form.get(name);
    return !!control && control.invalid && (control.touched || this.submitted);
  }

  legError(transport: 'transportOrigin' | 'transportEnd'): boolean {
    return !!this.form.errors?.[`${transport}Required`] && (this.submitted || this.form.touched);
  }
}

/** "Vehículo de carga, mayor a 32 Ton, tipo EURO 3 (RoW)-Ecoinvent 3" → without the source suffix. */
export const cleanTransport = (name: string): string =>
  name
    .replace(/\s*-\s*Ecoinvent 3$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
