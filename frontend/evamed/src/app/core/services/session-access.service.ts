import { Injectable, InjectionToken, OnDestroy, inject, signal } from '@angular/core';
import { onIdTokenChanged } from 'firebase/auth';
import { firstValueFrom } from 'rxjs';
import { FIREBASE_AUTH } from '../firebase';
import { CatalogueCacheService } from './catalogue-cache/catalogue-cache.service';
import { UserService } from './user/user.service';

/** A full navigation also discards legacy services' replayed factors and results. */
export const RESET_ACCESS_VIEW = new InjectionToken<() => void>('RESET_ACCESS_VIEW', {
  providedIn: 'root', factory: () => () => window.location.replace('/home-evamed'),
});
const SNAPSHOT_KEY = 'evamed-access-identity';

export function clearProjectContext(): void {
  for (const key of ['primaryDataProject', 'dataProject', 'projectID']) sessionStorage.removeItem(key);
  for (const key of ['idProyectoConstrucción', 'newProjectDataId']) localStorage.removeItem(key);
}

@Injectable({ providedIn: 'root' })
export class SessionAccessService implements OnDestroy {
  private auth = inject(FIREBASE_AUTH);
  private users = inject(UserService);
  private cache = inject(CatalogueCacheService);
  private resetView = inject(RESET_ACCESS_VIEW);
  private allowed = signal(false);
  readonly canAccessEcoplatform = this.allowed.asReadonly();
  private snapshot = sessionStorage.getItem(SNAPSHOT_KEY);
  private revision = 0;
  private stopWatching?: () => void;
  private resetting = false;
  private onFocus = () => { void this.refresh(); };

  start(): void {
    if (this.stopWatching) return;
    this.stopWatching = onIdTokenChanged(this.auth, () => { void this.refresh(); });
    window.addEventListener('focus', this.onFocus);
  }

  async refresh(): Promise<void> {
    const revision = ++this.revision;
    const user = this.auth.currentUser;
    const identity = user ? JSON.stringify([user.uid, user.email, user.emailVerified]) : 'anonymous';
    if (this.snapshot && !this.snapshot.startsWith(identity + ':')) {
      this.allowed.set(false);
      // Persist before navigation: the new page must not repeat the same reset.
      this.snapshot = `${identity}:pending`;
      sessionStorage.setItem(SNAPSHOT_KEY, this.snapshot);
      this.denyProject();
    }
    let allowed = false;
    try {
      allowed = !!user && (await firstValueFrom(this.users.getMe())).can_access_ecoplatform === true;
    } catch { /* Failed or missing identity/capability is ineligible. */ }
    if (revision !== this.revision) return;
    const next = `${identity}:${allowed}`;
    const changed = this.snapshot !== null && !this.snapshot.endsWith(':pending') && this.snapshot !== next;
    this.allowed.set(allowed);
    this.snapshot = next;
    sessionStorage.setItem(SNAPSHOT_KEY, next);
    if (changed) this.denyProject();
  }

  denyProject(): void {
    this.cache.clear();
    clearProjectContext();
    // Registration/social sign-in still have profile and verification work to
    // finish after Firebase emits its token event. Let those routes navigate.
    if (!this.resetting && !window.location.pathname.startsWith('/auth/')) {
      this.resetting = true;
      this.resetView();
    }
  }

  ngOnDestroy(): void {
    ++this.revision;
    this.stopWatching?.();
    window.removeEventListener('focus', this.onFocus);
  }
}
