import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';

@Component({
    selector: 'app-user-manual',
    templateUrl: './user-manual.component.html',
    styleUrls: ['./user-manual.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class UserManualComponent implements OnInit {

  constructor() { }

  ngOnInit(): void {
  }

}
