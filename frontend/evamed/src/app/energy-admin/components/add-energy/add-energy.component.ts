import { Component, OnInit, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MaterialsService } from './../../../core/services/materials/materials.service';
import { UntypedFormGroup, UntypedFormBuilder, Validators } from '@angular/forms';

export interface DialogData {
  name_type_energy: string;
}

@Component({
    selector: 'app-add-energy',
    templateUrl: './add-energy.component.html',
    styleUrls: ['./add-energy.component.scss'],
    standalone: false
})
export class AddEnergyComponent implements OnInit {
  form: UntypedFormGroup;

  constructor(
    private materialsService: MaterialsService,
    private formBuilder: UntypedFormBuilder,
    public dialogRef: MatDialogRef<AddEnergyComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData
  ) {
    this.buildForm();
  }

  ngOnInit(): void {}

  onNoClick(): void {
    this.dialogRef.close(this.data);
  }

  private buildForm() {
    this.form = this.formBuilder.group({
      name_type_energy: [null, Validators.required],
    });
  }

  addEnergy(event: Event) {
    event.preventDefault();
    if (this.form.valid) {
      const energy = this.form.value;
      this.materialsService.addTypeEnergy(energy).subscribe(() => {
        this.onNoClick();
      });
    }
  }
}
