import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute, Params } from '@angular/router';
import { UntypedFormGroup, UntypedFormBuilder, Validators } from '@angular/forms';
import { MaterialsService } from './../../../core/services/materials/materials.service';
import { MatDialog } from '@angular/material/dialog';
import { AddPotentialTransportComponent } from '../potential/add-potential-transport/add-potential-transport.component';
import { UpdatePotentialTransportComponent } from '../potential/update-potential-transport/update-potential-transport.component';
import { DeletePotentialTransportComponent } from '../potential/delete-potential-transport/delete-potential-transport.component';

@Component({
    selector: 'app-update-transport',
    templateUrl: './update-transport.component.html',
    styleUrls: ['./update-transport.component.scss'],
    standalone: false
})
export class UpdateTransportComponent implements OnInit {
  form: UntypedFormGroup;

  id: string;

  potentialList: any;

  potentialTypeList: any;

  displayedColumns: string[] = ['id', 'potential_type_id', 'value', 'actions'];

  constructor(
    private router: Router,
    private formBuilder: UntypedFormBuilder,
    private activatedRoute: ActivatedRoute,
    private materialsService: MaterialsService,
    public dialog: MatDialog
  ) {
    this.buildForm();
    this.materialsService.getPotentialTypes().subscribe(data => {
      this.potentialTypeList = data;
    });
  }

  ngOnInit(): void {
    this.activatedRoute.params.subscribe((params: Params) => {
      this.materialsService.getTransports().subscribe(data => {
        const transportFiltered = data.filter(
          transporte => transporte.id === parseInt(params.id)
        );

        transportFiltered.map(transport => {
          this.id = transport.id;
          this.form.patchValue(transport);
          this.potentialList = [];
          this.materialsService.getPotentialTransport().subscribe(data => {
            const potentialList = data.filter(
              potential => potential.transport_id === transport.id
            );
            this.potentialList = potentialList;
          });
        });
      });
    });
  }

  private buildForm() {
    this.form = this.formBuilder.group({
      name_transport: [null, Validators.required],
    });
  }

  updateMaterial(event: Event) {
    event.preventDefault();
    if (this.form.valid) {
      const transport = this.form.value;
      this.materialsService
        .updateTransport(this.id, transport)
        .subscribe(() => {
          this.ngOnInit();
          this.router.navigate(['./admin-transports/']);
        });
    }
  }

  goToTransportList() {
    this.router.navigateByUrl('admin-transports');
  }

  addPotential(event: Event) {
    event.preventDefault();
    const dialogRef = this.dialog.open(AddPotentialTransportComponent, {
      width: '680px',
      data: { transport_id: this.id },
    });

    dialogRef.afterClosed().subscribe(() => {
      this.ngOnInit();
    });
  }

  updatePotential(event: Event, potentialId) {
    event.preventDefault();
    const potentialSelected = this.potentialList.filter(
      data => data.id === potentialId
    ),
     dialogRef = this.dialog.open(UpdatePotentialTransportComponent, {
      width: '680px',
      data: potentialSelected,
    });

    dialogRef.afterClosed().subscribe(() => {
      this.ngOnInit();
    });
  }

  deletePotential(event: Event, potentialId) {
    event.preventDefault();
    const potentialSelected = this.potentialList.filter(
      data => data.id === potentialId
    ),
     dialogRef = this.dialog.open(DeletePotentialTransportComponent, {
      width: '680px',
      data: potentialSelected,
    });

    dialogRef.afterClosed().subscribe(() => {
      this.ngOnInit();
    });
  }

  getPotential(id: number) {
    const potencial = this.potentialTypeList.filter(
      potencial => potencial.id === id
    );

    return potencial[0].name_complete_potential_type;
  }
}
