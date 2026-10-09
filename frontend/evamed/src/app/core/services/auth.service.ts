import { Injectable, inject } from '@angular/core';
import { Auth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  UserCredential, signOut, sendPasswordResetEmail, sendEmailVerification,
  GoogleAuthProvider, FacebookAuthProvider, TwitterAuthProvider, OAuthProvider,
  AuthProvider, signInWithPopup, deleteUser, onAuthStateChanged, User } from 'firebase/auth';
import { Observable } from 'rxjs';

import { FIREBASE_AUTH } from './../firebase';

// Social providers supported by the app. 'apple' is wired but deferred (it
// requires a paid Apple Developer account); it is simply not offered in the UI.
export type SocialProvider = 'google' | 'apple' | 'facebook' | 'microsoft' | 'twitter';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private auth = inject(FIREBASE_AUTH);

  createUser(email: string, password: string) {
    return createUserWithEmailAndPassword(this.auth, email, password);
  }

  login(email: string, password: string): Promise<UserCredential> {
    return signInWithEmailAndPassword(this.auth, email, password);
  }

  logout() {
    localStorage.removeItem('email-login');
    return signOut(this.auth);
  }

  // Recuperar contraseña
  resetPassword(email): Promise<void> {
     return sendPasswordResetEmail(this.auth, email);
  }

  // Verificar correo
  verifyEmail(): Promise<void> {
     return sendEmailVerification(this.auth.currentUser);
   }

  // Reenviar correo de verificación (desde el aviso en la app)
  resendVerification(): Promise<void> {
    if (!this.auth.currentUser) {
      return Promise.reject(new Error('No hay un usuario autenticado.'));
    }
    return sendEmailVerification(this.auth.currentUser);
  }

  /**
   * Firebase keeps the ID token it issued before verification
   * (email_verified=false) for up to an hour, and the API trusts only the
   * token. Once the user is verified, make sure the token says so too.
   */
  async ensureVerifiedToken(): Promise<void> {
    const user = this.auth.currentUser;
    if (!user?.emailVerified) {
      return;
    }
    const { claims } = await user.getIdTokenResult();
    if (claims['email_verified'] !== true) {
      await user.getIdToken(true);
    }
  }

  /**
   * Re-reads the signed-in user from Firebase, which picks up a click on the
   * verification link in another tab. True once verified (with a fresh token).
   */
  async refreshVerification(): Promise<boolean> {
    if (!this.auth.currentUser) {
      return false;
    }
    await this.auth.currentUser.reload();
    if (!this.auth.currentUser?.emailVerified) {
      return false;
    }
    await this.ensureVerifiedToken();
    return true;
  }

  // Iniciar sesión con un proveedor social mediante popup.
  loginWithProvider(provider: SocialProvider): Promise<UserCredential> {
    return signInWithPopup(this.auth, this.buildProvider(provider));
  }

  // Alias retrocompatible.
  loginWithGoogle(): Promise<UserCredential> {
    return this.loginWithProvider('google');
  }

  private buildProvider(provider: SocialProvider): AuthProvider {
    switch (provider) {
      case 'google':
        return new GoogleAuthProvider();
      case 'facebook':
        return new FacebookAuthProvider();
      case 'twitter':
        return new TwitterAuthProvider();
      case 'apple':
        return new OAuthProvider('apple.com');
      case 'microsoft':
        return new OAuthProvider('microsoft.com');
    }
  }

  // Usuario autenticado actual (p. ej. para prellenar el perfil de Google)
  get currentUser() {
    return this.auth.currentUser;
  }

  // Replaces @angular/fire's authState(): emits the current user immediately
  // and again on every sign-in/sign-out.
  hasUser(): Observable<User | null> {
    return new Observable<User | null>(subscriber =>
      onAuthStateChanged(this.auth, subscriber));
  }

  // Undo a half-finished registration so the email isn't left "already in use".
  deleteCurrentUser(): Promise<void> {
    return this.auth.currentUser ? deleteUser(this.auth.currentUser) : Promise.resolve();
  }
}
