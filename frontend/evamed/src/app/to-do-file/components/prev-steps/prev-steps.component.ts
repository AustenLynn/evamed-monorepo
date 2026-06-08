import { Component, OnInit } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { MaterialsService } from './../../../core/services/materials/materials.service';

@Component({
    selector: 'app-prev-steps',
    templateUrl: './prev-steps.component.html',
    styleUrls: ['./prev-steps.component.scss'],
    standalone: false
})
export class PrevStepsComponent implements OnInit {
  ConstructiveSystems: number;
  TotalMaterialsDB: number;
  TotalExistDB: number;

  constructor(
    private materialsService: MaterialsService,
    public dialogRef: MatDialogRef<PrevStepsComponent>,
    private router: Router
  ) { }

  ngOnInit(): void {
    const data = JSON.parse(sessionStorage.getItem('dataProject')),
     constructiveSystems = [],
      materialsExcel = [];

    data.data.map( item => {
      item.map(
        data => {
          if ( data.Sistema_constructivo !== null && data.Sistema_constructivo !== undefined ) {
            constructiveSystems.push(data.Sistema_constructivo)
          }
          if ( data.Material !== null && data.Material !== undefined ) {
            materialsExcel.push(data.Material);
          }
        }
      );
    });
    const filterConstructiveSystems = constructiveSystems.filter(this.onlyUnique);
    this.ConstructiveSystems = filterConstructiveSystems.length;
    this.ConstructiveSystems = this.ConstructiveSystems - 1;

    const filterMaterialsExcel = materialsExcel.filter(this.onlyUnique);
    this.TotalMaterialsDB = filterMaterialsExcel.length;
    this.TotalMaterialsDB = this.TotalMaterialsDB - 1;

    this.TotalExistDB = 0
    filterMaterialsExcel.map( filteredMaterial => {
      this.materialsService.getMaterials().subscribe( materials => {
        materials.map( material => {
          if (material.name_material === filteredMaterial) {
            this.TotalExistDB++;
          }
        });
      });
    });

  }

  onlyUnique(value, index, self) {
    return self.indexOf(value) === index;
  }

  goToSteps() {
    this.dialogRef.close();
    this.router.navigateByUrl('materials-stage');
  }

}
