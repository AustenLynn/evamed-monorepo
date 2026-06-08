import { Component, OnInit, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MaterialsService } from './../../../core/services/materials/materials.service';
import { UntypedFormGroup, UntypedFormBuilder, Validators } from '@angular/forms';

export interface DialogData {
  name_transport: string;
}

@Component({
    selector: 'app-add-transport',
    templateUrl: './add-transport.component.html',
    styleUrls: ['./add-transport.component.scss'],
    standalone: false
})
export class AddTransportComponent implements OnInit {
  form: UntypedFormGroup;

  constructor(
    private materialsService: MaterialsService,
    private formBuilder: UntypedFormBuilder,
    public dialogRef: MatDialogRef<AddTransportComponent>,
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
      name_transport: [null, Validators.required],
    });
  }

  addTransport(event: Event) {
    event.preventDefault();
    if (this.form.valid) {
      const transport = this.form.value;
      this.materialsService.addTransport(transport).subscribe(() => {
        this.onNoClick();
      });
    }
  }
}
