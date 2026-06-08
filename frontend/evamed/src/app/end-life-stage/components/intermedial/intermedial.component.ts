import { Component, OnInit, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { MaterialsService } from './../../../core/services/materials/materials.service';

@Component({
    selector: 'app-intermedial',
    templateUrl: './intermedial.component.html',
    styleUrls: ['./intermedial.component.scss'],
    host: {
        'stage': 'end-life-stage'
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
      this.router.navigateByUrl('/');
      this.onNoClick();
      return;
    }

    this.onNoClick();
  }
}
