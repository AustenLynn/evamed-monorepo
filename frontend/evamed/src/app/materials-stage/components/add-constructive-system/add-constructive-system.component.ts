import { Component, Inject, ChangeDetectionStrategy } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

export interface DialogData {
  /** The systems the element already has, so a name isn't used twice. */
  existing: string[];
}

/** Asks for a new sistema constructivo's name; closes with it, or with nothing on cancel. */
@Component({
    selector: 'app-add-constructive-system',
    templateUrl: './add-constructive-system.component.html',
    styleUrls: ['./add-constructive-system.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class AddConstructiveSystemComponent {
  name = '';

  constructor(
    public dialogRef: MatDialogRef<AddConstructiveSystemComponent, string>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData
  ) { }

  get trimmed(): string {
    return this.name.trim();
  }

  get duplicate(): boolean {
    const name = this.trimmed.toLocaleLowerCase();
    return (this.data?.existing ?? []).some(system => String(system).trim().toLocaleLowerCase() === name);
  }

  get valid(): boolean {
    return this.trimmed !== '' && !this.duplicate;
  }

  create(): void {
    if (this.valid) {
      this.dialogRef.close(this.trimmed);
    }
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
