import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({selector: 'app-usage-stage-shell', standalone: false, templateUrl: './usage-stage-shell.component.html', styleUrls: ['./usage-stage-shell.component.scss'], changeDetection: ChangeDetectionStrategy.OnPush})
export class UsageStageShellComponent {
  @Input() projectName = '';
  @Input() pending = false;
  @Input() navigationDisabled = false;
  @Output() navigate = new EventEmitter<string>();
  go(event: Event, destination: string): void {
    event.preventDefault();
    if (!this.pending && (destination === 'projects' || !this.navigationDisabled)) this.navigate.emit(destination);
  }
}
