import { InjectionToken } from '@angular/core';
import { FirebaseApp, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';

import { environment } from './../../environments/environment';

// One Firebase app and one Auth instance for the whole SPA. @angular/fire used
// to do this through provideFirebaseApp/provideAuth; it pinned us to Angular 20,
// so we call the SDK directly.
let app: FirebaseApp | undefined;
let auth: Auth | undefined;

export function firebaseApp(): FirebaseApp {
  return (app ??= initializeApp(environment.firebaseConfig));
}

export function firebaseAuth(): Auth {
  return (auth ??= getAuth(firebaseApp()));
}

// Injected wherever the code used to inject `Auth` from '@angular/fire/auth'.
export const FIREBASE_AUTH = new InjectionToken<Auth>('FIREBASE_AUTH', {
  providedIn: 'root',
  factory: firebaseAuth,
});
