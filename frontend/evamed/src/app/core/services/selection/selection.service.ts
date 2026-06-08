import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SelectionService {
  private _section = new BehaviorSubject<string | null>(null);
  section$ = this._section.asObservable();

  setSection(section: string | null) {
    this._section.next(section);
  }

  clearSection() {
    this._section.next(null);
  }
}
