import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';

@Component({
    selector: 'app-about',
    templateUrl: './about.component.html',
    styleUrls: ['./about.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class AboutComponent implements OnInit {
  constructor(private router: Router) {}

  ngOnInit(): void {}

  return() {
    this.router.navigate(['/auth/login']);
  }
}
