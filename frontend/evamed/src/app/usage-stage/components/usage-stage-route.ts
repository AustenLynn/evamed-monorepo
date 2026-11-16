import { Directive, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { UsageEditorComponent } from './usage-editor/usage-editor.component';

/** Route wrappers retain their public navigation methods without persistence. */
@Directive()
export abstract class UsageStageRoute {
  @ViewChild(UsageEditorComponent) editor?: UsageEditorComponent;
  projectId: number | null = null;
  nameProject = '';
  constructor(protected router: Router, reopened: boolean) {
    let primary: {id?: number; name_project?: string} = {};
    try {primary = JSON.parse(sessionStorage.getItem('primaryDataProject') || '{}');} catch { /* A missing context is shown by the editor. */ }
    const stored = Number(localStorage.getItem('idProyectoConstrucción')),
     current = Number(primary.id),
     chosen = reopened ? (stored > 0 ? stored : current) : (current > 0 ? current : stored);
    this.projectId = Number.isSafeInteger(chosen) && chosen > 0 ? chosen : null;
    this.nameProject = chosen === current ? primary.name_project ?? '' : '';
  }
  canLeave(): boolean {return this.editor?.canLeave() ?? true;}
  goToMaterialStage(): void {void this.editor?.navigate('materials-stage');}
  goToConstructionStage(): void {void this.editor?.navigate('construction-stage');}
  goToUsageStage(): void {void this.editor?.navigate('usage-stage');}
  goToEndLife(): void {void this.editor?.navigate('end-life-stage');}
  continue(): void {this.goToEndLife();}
  goToResultados(): void {
    if (this.editor) {void this.editor.navigate('resultados'); return;}
    sessionStorage.setItem('projectID', String(this.projectId)); void this.router.navigateByUrl('resultados');
  }
}
