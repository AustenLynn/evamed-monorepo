import { Component, ChangeDetectionStrategy, OnInit, inject } from '@angular/core';

import { SessionAccessService } from './core/services/session-access.service';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class AppComponent implements OnInit {
  private access = inject(SessionAccessService);
  ngOnInit(): void { this.access.start(); }
  title = 'evamed';
}
