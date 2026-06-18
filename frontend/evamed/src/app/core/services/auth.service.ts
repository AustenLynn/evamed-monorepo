import { Injectable } from '@angular/core';
import { Auth, authState, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  UserCredential, signOut, sendPasswordResetEmail, sendEmailVerification,} from '@angular/fire/auth';

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
   // Verificar usuario
   isEmailVerified() {
    return this.auth.currentUser?.emailVerified ?? false;
   }
  hasUser() {
    return authState(this.auth);
  }
}
