import { Injectable } from '@angular/core';
import { Auth, authState, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  UserCredential, signOut, sendPasswordResetEmail, sendEmailVerification,
  GoogleAuthProvider, FacebookAuthProvider, TwitterAuthProvider, OAuthProvider,
  AuthProvider, signInWithPopup, deleteUser,} from '@angular/fire/auth';

// Social providers supported by the app. 'apple' is wired but deferred (it
// requires a paid Apple Developer account); it is simply not offered in the UI.
export type SocialProvider = 'google' | 'apple' | 'facebook' | 'microsoft' | 'twitter';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  constructor(
    private auth: Auth,
  ) { }

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

  // Refresca el estado del usuario para detectar emailVerified tras hacer clic en el correo
  reloadCurrentUser(): Promise<void> {
    return this.auth.currentUser?.reload() ?? Promise.resolve();
  }

   // Verificar usuario
   isEmailVerified() {
    return this.auth.currentUser?.emailVerified ?? false;
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

  hasUser() {
    return authState(this.auth);
  }

  // Undo a half-finished registration so the email isn't left "already in use".
  deleteCurrentUser(): Promise<void> {
    return this.auth.currentUser ? deleteUser(this.auth.currentUser) : Promise.resolve();
  }
}
