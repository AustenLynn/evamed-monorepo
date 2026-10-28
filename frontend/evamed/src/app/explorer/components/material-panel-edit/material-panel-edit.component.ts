import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output } from '@angular/core';

import { MaterialDetail } from '../../explorer.models';
import { ExplorerPickerService } from '../../explorer-picker.service';
import { ExplorerService } from '../../services/explorer.service';
import { PickedMaterial, PickerContext, PickerInitial } from '../../picker.models';

/**
 * A project row's Edición inside the stage page's Materiales panel, so the list
 * and the system stay in view. Choosing another material, or reading the full
 * Ficha, still opens the explorer full-screen.
 */
@Component({
  selector: 'app-material-panel-edit',
  templateUrl: './material-panel-edit.component.html',
  styleUrls: ['./material-panel-edit.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class MaterialPanelEditComponent implements OnInit {
  /** Edit mode, with the row's catalogue material and its values. */
  @Input({ required: true }) context!: PickerContext;
  @Output() readonly save = new EventEmitter<PickedMaterial>();
  @Output() readonly cancelled = new EventEmitter<void>();

  /** One entry: a new material re-creates the form from the values carried over. */
  shown: { detail: MaterialDetail; context: PickerContext }[] = [];
  failed = false;

  constructor(
    private explorer: ExplorerService,
    private picker: ExplorerPickerService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.failed = false;
    this.explorer.material(this.context.materialId!).subscribe({
      next: detail => this.show(detail, this.context),
      error: () => {
        this.failed = true;
        this.cdr.markForCheck();
      },
    });
  }

  /** "Cambiar material" opens the list; "Ver ficha completa" the current material's Ficha. */
  async choose(values: PickerInitial, fromFicha: boolean): Promise<void> {
    const current = this.shown[0].detail,
      chosen = await this.picker.choose({ ...this.context, materialId: fromFicha ? current.id : null });
    if (chosen && chosen.id !== current.id) {
      // The values typed so far stay; a different material brings its own name (as in the explorer).
      this.show(chosen, { ...this.context, initial: values });
    }
  }

  private show(detail: MaterialDetail, context: PickerContext): void {
    this.shown = [{ detail, context }];
    this.cdr.markForCheck();
  }
}
