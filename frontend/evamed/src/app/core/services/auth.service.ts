import { Injectable } from '@angular/core';
import { Auth, authState, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  UserCredential, signOut, sendPasswordResetEmail, sendEmailVerification,} from '@angular/fire/auth';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs/operators';
import { TokenService } from './token.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  servicioResponse: string;

  boolError: boolean;

  response: object;

  constructor(
    //private af: AngularFireAuth,
    private auth: Auth,
    private http: HttpClient,
    private token: TokenService
  ) { }

  createUser(email: string, password: string) {
    return createUserWithEmailAndPassword(this.auth, email, password);
  }

  login(email: string, password: string): Promise<UserCredential> {
    return signInWithEmailAndPassword(this.auth, email, password);
  }

  logout() {
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
    return this.auth.currentUser.emailVerified;
   }
  hasUser() {
    return authState(this.auth);
  }

  loginCoreEVAMED( username: string, password: string ) {

    return this.http.post<any>(
      //'http://127.0.0.1:8000/api-profiles/login/',
      'http://10.2.102.118:8000/api-profiles/login/',
      { username, password }
    ).pipe(
      tap((data: { token: string }) => {
        const token = data.token;
        this.token.saveToken(token);
      })
    );
  }
}
