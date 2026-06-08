import { Component, OnInit, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { MaterialsService } from './../../../core/services/materials/materials.service';

@Component({
    selector: 'app-intermedial',
    templateUrl: './intermedial.component.html',
    styleUrls: ['./intermedial.component.scss'],
    host: {
        'stage': 'construction-stage'
    },
    standalone: false
})
export class IntermedialComponent implements OnInit {
  constructor(
    private router: Router,
    private materialsService: MaterialsService,
    public dialogRef: MatDialogRef<IntermedialComponent>,
    @Inject(MAT_DIALOG_DATA) public data: object
  ) {}

  ngOnInit(): void {}

  onNoClick() {
    this.dialogRef.close(this.data);
  }

  continueStep(event: Event) {
    event.preventDefault();
    if (this.data && (this.data as { mode?: string }).mode === 'update') {
      this.materialsService.getACR().subscribe(acr => {
        const schemaFilter = acr.filter(
          schema =>
            schema.project_id == localStorage.getItem('idProyectoConstrucción')
        );

        if (schemaFilter.length === 0) {
          this.router.navigateByUrl('usage-stage');
        } else {
          this.router.navigateByUrl('usage-stage/update');
        }
      });
      this.onNoClick();
      return;
    }

    this.onNoClick();
  }
}
