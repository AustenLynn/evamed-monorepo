import { Component, ElementRef, ViewChild } from '@angular/core';
/** Layout only: callers own heading semantics, close locks and dialog focus. */
@Component({selector: 'app-ev-menu-shell', templateUrl: './menu-shell.component.html', styleUrls: ['./menu-shell.component.scss'], standalone: true})
export class MenuShellComponent {
  @ViewChild('scrollBody', {static: true}) body!: ElementRef<HTMLElement>;
}
