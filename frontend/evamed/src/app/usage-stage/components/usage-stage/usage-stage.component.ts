import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { CanDeactivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MaterialsService } from '../../../core/services/materials/materials.service';
import { EnergyTotalService } from '../../../core/services/energy-total/energy-total.service';
import { UsageEditorComponent } from '../../editor/usage-editor.component';

@Component({selector: 'app-usage-stage', templateUrl: './usage-stage.component.html',
  styleUrls: ['./usage-stage.component.scss'], standalone: false, changeDetection: ChangeDetectionStrategy.OnPush})
export class UsageStageComponent implements OnInit {
  @ViewChild(UsageEditorComponent) editor: UsageEditorComponent;
  projectId: number;
  navigationPending = false;
  navigationError = '';
  constructor(private materials: MaterialsService, private totals: EnergyTotalService,
    private router: Router, private cdr: ChangeDetectorRef) {}
  ngOnInit(): void {
    let primary: {id?: number} = {};
    try {primary = JSON.parse(sessionStorage.getItem('primaryDataProject') || '{}');} catch { /* The editor reports missing context. */ }
    this.projectId = Number(this.router.url.includes('/update') ? localStorage.getItem('idProyectoConstrucción') :
      primary?.id || localStorage.getItem('idProyectoConstrucción'));
    if (Number.isInteger(this.projectId) && this.projectId > 0) {
      localStorage.setItem('idProyectoConstrucción', String(this.projectId));
      this.totals.loadAll(this.projectId);
    }
  }
  canLeave(): boolean {return !this.navigationPending && (this.editor?.canLeave() ?? true);}
  get exitLocked(): boolean {
    return this.navigationPending || this.editor?.pending || this.editor?.pickerOpen || this.editor?.reviewRequired;
  }
  get navigationLocked(): boolean {
    return this.navigationPending || !this.editor?.state || this.editor.loading || this.editor.pending ||
      this.editor.pickerOpen || this.editor.reviewRequired;
  }
  async go(stage: 'materials-stage' | 'construction-stage' | 'end-life-stage' | 'resultados' | ''): Promise<void> {
    if (stage ? this.navigationLocked : this.exitLocked) return;
    this.navigationPending = true; this.navigationError = '';
    try {
      let target = stage as string;
      if (stage === 'resultados') sessionStorage.setItem('projectID', String(this.projectId));
      else if (stage) {
        const request = stage === 'materials-stage' ? this.materials.getMaterialSchemeProyects() :
          stage === 'construction-stage' ? this.materials.getConstructionStage() : this.materials.getEDCP(),
         rows = await firstValueFrom(request);
        if (rows.some(row => Number(row.project_id) === this.projectId)) target += '/update';
      }
      this.navigationPending = false;
      await this.router.navigateByUrl(target || '/');
    } catch {this.navigationError = 'No se pudo abrir la etapa. Intenta de nuevo.';} finally {this.navigationPending = false; this.cdr.markForCheck();}
  }
}
export const leaveUsage: CanDeactivateFn<UsageStageComponent> = component => component.canLeave();
