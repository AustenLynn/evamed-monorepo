import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { MaterialsService } from './../../../core/services/materials/materials.service';

@Component({
    selector: 'app-prev-steps',
    templateUrl: './prev-steps.component.html',
    styleUrls: ['./prev-steps.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class PrevStepsComponent implements OnInit {
  ConstructiveSystems: number;
  // Distinct materials in the file, split by whether the database has them.
  // Unset until the catalogue has loaded.
  identifiedMaterials: number | null = null;
  unidentifiedMaterials: number | null = null;

  constructor(
    private materialsService: MaterialsService,
    public dialogRef: MatDialogRef<PrevStepsComponent>,
    private router: Router
  ) { }

  ngOnInit(): void {
    const data = JSON.parse(sessionStorage.getItem('dataProject')),
      constructiveSystems = new Set(),
      materialsExcel = new Set();

    data.data.forEach(sheet => {
      sheet.forEach(row => {
        // Empty cells come through as '' (or null with defval).
        if (this.hasValue(row.Sistema_constructivo)) {
          constructiveSystems.add(row.Sistema_constructivo);
        }
        if (this.hasValue(row.Material)) {
          materialsExcel.add(row.Material);
        }
      });
    });
    this.ConstructiveSystems = constructiveSystems.size;

    this.materialsService.getMaterials().subscribe(materials => {
      const catalogue = new Set(materials.map(material => material.name_material)),
        identified = [...materialsExcel].filter(material => catalogue.has(material)).length;
      this.identifiedMaterials = identified;
      this.unidentifiedMaterials = materialsExcel.size - identified;
    });
  }

  private hasValue(value): boolean {
    return value !== null && value !== undefined && String(value).trim() !== '';
  }

  goToSteps() {
    this.dialogRef.close();
    this.router.navigateByUrl('materials-stage');
  }

}
