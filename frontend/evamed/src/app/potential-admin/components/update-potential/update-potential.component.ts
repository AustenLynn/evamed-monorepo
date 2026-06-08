import { Component, OnInit, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MaterialsService } from './../../../core/services/materials/materials.service';
import { UntypedFormGroup, UntypedFormBuilder, Validators } from '@angular/forms';

export interface DialogData {
  name_complete_potential_type: string;
  name_potential_type: number;
  unit_potential_type: number;
}

@Component({
    selector: 'app-update-potential',
    templateUrl: './update-potential.component.html',
    styleUrls: ['./update-potential.component.scss'],
    standalone: false
})
export class UpdatePotentialComponent implements OnInit {
  form: UntypedFormGroup;

  units: any;

  id: string;

  constructor(
    private materialsService: MaterialsService,
    private formBuilder: UntypedFormBuilder,
    public dialogRef: MatDialogRef<UpdatePotentialComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData
  ) {
    this.buildForm();

    this.materialsService.getUnits().subscribe(data => {
      this.units = data;
    });
  }

  ngOnInit(): void {
    this.id = this.data[0].id;
    this.form.patchValue(this.data[0]);
  }

  onNoClick(): void {
    this.dialogRef.close(this.data);
  }

  private buildForm() {
    this.form = this.formBuilder.group({
      name_complete_potential_type: [null, Validators.required],
      name_potential_type: [null, Validators.required],
      unit_potential_type: [null, Validators.required],
    });
  }

  updatePotentialType(event: Event) {
    event.preventDefault();
    if (this.form.valid) {
      const unit = this.form.value;
      this.materialsService
        .updatePotentialTypes(this.id, unit)
        .subscribe(() => {
          this.onNoClick();
        });
    }
  }
}
