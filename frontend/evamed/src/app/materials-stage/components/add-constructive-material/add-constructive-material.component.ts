import { Component, OnInit, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { CatalogsService } from 'src/app/core/services/catalogs/catalogs.service';
import { MaterialsService } from './../../../core/services/materials/materials.service';

export interface DialogData {
  name?: string;
  cantidad?: string;
  unidad?: string;
  descripcion?: string;
  vidaUtil?: string;
  reemplazos?: string;
  transporte1?: any;
  transporte2?: any;
  distancia1?: string;
  distancia2?: string;
  material: { name: string; database: string };

}

@Component({
  selector: 'app-add-constructive-material',
  templateUrl: './add-constructive-material.component.html',
  styleUrls: ['./add-constructive-material.component.scss'],
  standalone: false
})
export class AddConstructiveMaterialComponent implements OnInit {

  catalogoTransportesLocal: any;
  catalogoTransportesExtrangero: any;
  materialsList: any;
  units: any;
  catalogoVidaUtil: any;
  selectedMaterial: { name: string; database: string } | null = null;

  constructor(
    private catalogsService: CatalogsService,
    private materialsService: MaterialsService,
    public dialogRef: MatDialogRef<AddConstructiveMaterialComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData,
  ) {
    this.catalogsService.getTransports().subscribe(data => {
      this.catalogoTransportesLocal = data;
      this.catalogoTransportesExtrangero = data;
    });

    this.materialsService.getMaterials().subscribe(data => {
      this.materialsList = data;
    });

    this.materialsService.getUnits().subscribe(data => {
      this.units = data;
    });
    this.catalogsService.usefulLifeCatalog().subscribe(data => {
      this.catalogoVidaUtil = data;
    });

  }

  ngOnInit(): void {
    if (!this.data.vidaUtil) {
      this.data.vidaUtil = '50'; // Que el valor predeterminado sea "50"
    }
  }

  onNoClick(): void {
    this.dialogRef.close(this.data);
  }

}
