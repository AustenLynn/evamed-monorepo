import { CatalogsService } from 'src/app/core/services/catalogs/catalogs.service';
import { Component, OnInit, Inject, ChangeDetectionStrategy } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { ProjectsService } from 'src/app/core/services/projects/projects.service';
import { mensajeErrorProyecto, payloadProyecto, ProjectFormErrors, validarProyecto } from './project-form';

export interface DialogData {
  nombre: string;
  catalogoUsos: any;
  catalogoPaises: any;
  catalogoTipo: any;
  catalogoVidaUtil: any;
  catalogoEsqHabitacional: any;
  catalogoEstados: any;
  filtroUsoSeleccionado: number;
  usoSeleccionado: number;
  paisSeleccionado: any;
  tipoSeleccionado: any;
  ciudadSeleccionada: any;
  vidaUtilSeleccionado: number;
  esqHabitacionalSeleccionado: string;
  estadoSeleccionado: any;
  superficieConstruida: string;
  superficieHabitable: string;
  noNiveles: string;
  vidaUtil: string;
}

@Component({
    selector: 'app-add-new-project',
    templateUrl: './add-new-project.component.html',
    styleUrls: ['./add-new-project.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class AddNewProjectComponent implements OnInit {
  catalogoCiudades: any;
  /** Set after the first "Siguiente", so errors don't show on an untouched form. */
  intentado = false;
  guardando = false;
  errorServidor = '';

  constructor(
    private catalogsService: CatalogsService,
    private projectsService: ProjectsService,
    public dialogRef: MatDialogRef<AddNewProjectComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData
  ) {}

  /** "Todos" is the home page's filter option, not a project use (audit A-08). */
  get usos(): any[] {
    return (this.data.catalogoUsos ?? []).filter(uso => uso.id !== 0);
  }

  get errores(): ProjectFormErrors {
    return this.intentado ? validarProyecto(this.data as any) : {};
  }

  /** Saves the project and closes with it; on an error the dialog stays open with what was typed (audit A-05). */
  guardar(): void {
    this.intentado = true;
    this.errorServidor = '';
    if (this.guardando || Object.keys(validarProyecto(this.data as any)).length) return;
    this.guardando = true;
    const userId = parseInt(localStorage.getItem('email-id') ?? '', 10);
    this.projectsService.addProject(payloadProyecto(this.data as any, userId)).subscribe({
      next: project => this.dialogRef.close({ project, estadoSeleccionado: this.data.estadoSeleccionado }),
      error: (error: HttpErrorResponse) => {
        this.guardando = false;
        this.errorServidor = mensajeErrorProyecto(error);
      },
    });
  }

  ngOnInit(): void {
    if (!this.data.vidaUtilSeleccionado) {
      this.data.vidaUtilSeleccionado = 1; // Que el valor predeterminado sea "50"
    }
  }

  select(id) {
    this.catalogoCiudades = [];
    this.catalogsService.getCities().subscribe(data => {
      data.map(item => {
        if (item.state_id === id) {
          this.catalogoCiudades.push(item);
        }
      });
    });
  }
}
