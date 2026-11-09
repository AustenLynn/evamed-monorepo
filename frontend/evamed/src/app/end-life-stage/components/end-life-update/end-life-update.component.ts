import { Component, ViewChild, OnInit, AfterViewInit, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { MatListOption, MatSelectionList } from '@angular/material/list';
import { take } from 'rxjs/operators';
import { MaterialsService } from '../../../core/services/materials/materials.service';
import { ProjectsService } from '../../../core/services/projects/projects.service';
import { SelectionService } from '../../../core/services/selection/selection.service';
import { EnergyTotalService } from '../../../core/services/energy-total/energy-total.service';
import { BUILDING_SECTIONS } from '../../../shared/building-sections';
import { EquipmentStagePanelComponent } from '../../../equipment-stage/equipment-stage-panel.component';

@Component({
  selector: 'app-end-life-update',
  templateUrl: './end-life-update.component.html',
  styleUrls: ['./end-life-update.component.scss'],
  // Preserve the host shell’s existing asynchronous project/selection rendering.
  // eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class EndLifeUpdateComponent implements OnInit, AfterViewInit {
  @ViewChild(EquipmentStagePanelComponent) equipmentPanel?: EquipmentStagePanelComponent;
  @ViewChild('sheets') sheetsList?: MatSelectionList;
  sheetNames: string[] = [];
  indexSheet: number | undefined;
  nameProject = '';
  projectId: number;
  selectedSheet: string;
  procesoSeleccionado = '';
  endSave = false;
  equipmentPending = false;

  constructor(
    private materialsService: MaterialsService,
    private projectsService: ProjectsService,
    private router: Router,
    private selectionService: SelectionService,
    private energyTotalService: EnergyTotalService,
  ) {}

  ngOnInit(): void {
    this.sheetNames = [...BUILDING_SECTIONS];
    this.projectId = Number(localStorage.getItem('idProyectoConstrucción'));
    this.energyTotalService.loadAll(this.projectId);
    this.projectsService.getProjectById(String(this.projectId)).subscribe((project: any) => {
      this.nameProject = project.name_project;
    });
  }

  ngAfterViewInit(): void {
    this.selectionService.section$.pipe(take(1)).subscribe(section => {
      if (section) queueMicrotask(() => this.selectSheetInUI(section));
    });
  }

  selectSheetInUI(section: string | { name_section: string }): void {
    const name = typeof section === 'string' ? section : section.name_section,
     option = this.sheetsList?.options.find(item => item.value === name);
    if (option) {
      this.sheetsList.selectedOptions.select(option);
      this.onGroupsChange([option]);
    }
  }

  onGroupsChange(options: MatListOption[]): void {
    const selected = options[0]?.value,
     index = this.sheetNames.indexOf(selected);
    if (index < 0) return;
    this.selectedSheet = selected;
    this.procesoSeleccionado = selected;
    this.indexSheet = index;
  }

  onEquipmentTotalChange(total: number): void {
    this.energyTotalService.setEndLifeTotal(total);
  }

  private async navigateStage(path: string, records: any): Promise<void> {
    // Capture the current project rather than rereading a previous route's storage.
    const projectId = this.projectId;
    await this.equipmentPanel?.whenIdle();
    records.subscribe((items: any[]) => {
      const exists = items.some(item => Number(item.project_id) === projectId);
      localStorage.setItem('idProyectoConstrucción', String(projectId));
      this.router.navigateByUrl(exists ? `${path}/update` : path);
    });
  }

  goToMaterialStage(): Promise<void> {
    return this.navigateStage('materials-stage', this.materialsService.getMaterialSchemeProyects());
  }

  goToConstructionStage(): Promise<void> {
    return this.navigateStage('construction-stage', this.materialsService.getConstructionStage());
  }

  goToUsageStage(): Promise<void> {
    return this.navigateStage('usage-stage', this.materialsService.getACR());
  }

  goToEndLife(): Promise<void> {
    return this.navigateStage('end-life-stage', this.materialsService.getEDCP());
  }

  async goToResultados(): Promise<void> {
    await this.equipmentPanel?.whenIdle();
    sessionStorage.setItem('projectID', String(this.projectId));
    this.router.navigateByUrl('resultados');
  }

  async goToProjects(event?: Event): Promise<void> {
    event?.preventDefault();
    await this.equipmentPanel?.whenIdle();
    this.router.navigateByUrl('/');
  }

  async continue(): Promise<void> {
    await this.equipmentPanel?.whenIdle();
    this.router.navigateByUrl('/');
  }

  continueStep(event: Event): Promise<void> {
    event.preventDefault();
    return this.continue();
  }
}
