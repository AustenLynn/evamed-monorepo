import { Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { UserService } from './../../../core/services/user/user.service';
import { AuthService } from './../../../core/services/auth.service';
import { CatalogsService } from './../../../core/services/catalogs/catalogs.service';

@Component({
    selector: 'app-register',
    templateUrl: './register.component.html',
    styleUrls: ['./register.component.scss'],
    standalone: false
})
export class RegisterComponent implements OnInit {
  form: UntypedFormGroup;
  catalogoPaises: any;

  constructor(
    private formBuilder: UntypedFormBuilder,
    private router: Router,
    private authService: AuthService,
    private user: UserService,
    private catalogsService: CatalogsService
  ) {
    this.buildForm();
    this.catalogsService.countriesCatalog().subscribe(data => {
      this.catalogoPaises = data;
    });
  }

  ngOnInit() {}

  register(event: Event) {
    event.preventDefault();

    if (this.form.valid) {
      const value = this.form.value;

      if (value.password === value.password2) {
        this.user.addUser(value).subscribe(() => {});
        this.authService
          .createUser(value.email, value.password)
          .then(() => {
            this.authService.verifyEmail();
            alert('Registro correcto');
            this.router.navigate(['/auth/login']);
          })
          .catch( () => {
            alert(
              'El correo ya esta registrado con otro usuario, registra un nuevo correo'
            );
          });
      } else {
        alert('las contraseñas deben de coincidir');
      }
    }
  }

  private buildForm() {
    this.form = this.formBuilder.group({
      name: ['', [Validators.required]],
      email: ['', [Validators.required]],
      institution: ['', [Validators.required]],
      password: ['', [Validators.required]],
      password2: ['', [Validators.required]],
      sector: ['', [Validators.required]],
      country: ['', [Validators.required]],
    });
  }

  login() {
    this.router.navigate(['/auth/login']);
  }

  about() {
    this.router.navigate(['/auth/about']);
  }
}
