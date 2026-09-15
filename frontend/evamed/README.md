# Evamed

This project uses [Angular CLI](https://github.com/angular/angular-cli) version 22.1.8.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The app will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory. Use the `--configuration production` flag for a production build.

## Running unit tests

`npm test` runs the Vitest suite through `ng test` (`@angular/build:unit-test`).
In this repo the container form avoids host Node/npm drift:

```bash
docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp \
  -v "$PWD:/app" -w /app node:22-alpine sh -lc 'npm test -- --watch=false'
```

## End-to-end tests

There are none. The Protractor setup was removed in 2026-09 (unsupported since
Angular 12). The frontend's gates are the production build plus a manual
click-through; see `docs/superpowers/plans/2026-09-13-angular-upgrade.md`.

[//]: # "## Further help"

[//]: # "To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI README](https://github.com/angular/angular-cli/blob/master/README.md)."
