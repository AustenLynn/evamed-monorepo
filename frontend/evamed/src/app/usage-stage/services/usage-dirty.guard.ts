import { Injectable } from '@angular/core';
import { CanDeactivate } from '@angular/router';

@Injectable({providedIn: 'root'})
export class UsageDirtyGuard implements CanDeactivate<{canLeave(): boolean}> {
  canDeactivate(component: {canLeave(): boolean}): boolean {return component.canLeave();}
}
