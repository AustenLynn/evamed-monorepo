import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { shareReplay } from 'rxjs/operators';
import { environment } from './../../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class CatalogsService {
  private _localDistances$: Observable<any>;
  private _externalDistances$: Observable<any>;
  private _usesCatalog$: Observable<any>;
  private _countriesCatalog$: Observable<any>;
  private _typeProjectCatalog$: Observable<any>;
  private _usefulLifeCatalog$: Observable<any>;
  private _housingSchemeCatalog$: Observable<any>;
  private _sourceInformation$: Observable<any>;
  private _bulkUnits$: Observable<any>;
  private _energyUnits$: Observable<any>;
  private _volumeUnits$: Observable<any>;
  private _typeEnergy$: Observable<any>;
  private _states$: Observable<any>;
  private _cities$: Observable<any>;
  private _transports$: Observable<any>;
  private _potentialTypes$: Observable<any>;
  private _sections$: Observable<any>;

  constructor(private http: HttpClient) {}

  getLocalDistances() {
    if (!this._localDistances$) {
      this._localDistances$ = this.http.get<any>(environment.api_local_distances).pipe(shareReplay(1));
    }
    return this._localDistances$;
  }

  getExternalDistances() {
    if (!this._externalDistances$) {
      this._externalDistances$ = this.http.get<any>(environment.api_exterternal_distances).pipe(shareReplay(1));
    }
    return this._externalDistances$;
  }

  usesCatalog() {
    if (!this._usesCatalog$) {
      this._usesCatalog$ = this.http.get<any>(environment.api_uses).pipe(shareReplay(1));
    }
    return this._usesCatalog$;
  }

  countriesCatalog() {
    if (!this._countriesCatalog$) {
      this._countriesCatalog$ = this.http.get<any>(environment.api_countries).pipe(shareReplay(1));
    }
    return this._countriesCatalog$;
  }

  typeProjectCatalog() {
    if (!this._typeProjectCatalog$) {
      this._typeProjectCatalog$ = this.http.get<any>(environment.api_type_project).pipe(shareReplay(1));
    }
    return this._typeProjectCatalog$;
  }

  usefulLifeCatalog() {
    if (!this._usefulLifeCatalog$) {
      this._usefulLifeCatalog$ = this.http.get<any>(environment.api_useful_life).pipe(shareReplay(1));
    }
    return this._usefulLifeCatalog$;
  }

  housingSchemeCatalog() {
    if (!this._housingSchemeCatalog$) {
      this._housingSchemeCatalog$ = this.http.get<any>(environment.api_housing_scheme).pipe(shareReplay(1));
    }
    return this._housingSchemeCatalog$;
  }

  getSourceInformation() {
    if (!this._sourceInformation$) {
      this._sourceInformation$ = this.http.get<any>(environment.api_source_information).pipe(shareReplay(1));
    }
    return this._sourceInformation$;
  }

  getBulkUnits() {
    if (!this._bulkUnits$) {
      this._bulkUnits$ = this.http.get<any>(environment.api_bulk_units).pipe(shareReplay(1));
    }
    return this._bulkUnits$;
  }

  getEnergyUnits() {
    if (!this._energyUnits$) {
      this._energyUnits$ = this.http.get<any>(environment.api_energy_units).pipe(shareReplay(1));
    }
    return this._energyUnits$;
  }

  getVolumeUnits() {
    if (!this._volumeUnits$) {
      this._volumeUnits$ = this.http.get<any>(environment.api_volume_units).pipe(shareReplay(1));
    }
    return this._volumeUnits$;
  }

  getTypeEnergy() {
    if (!this._typeEnergy$) {
      this._typeEnergy$ = this.http.get<any>(environment.api_type_energy).pipe(shareReplay(1));
    }
    return this._typeEnergy$;
  }

  getStates() {
    if (!this._states$) {
      this._states$ = this.http.get<any>(environment.api_states).pipe(shareReplay(1));
    }
    return this._states$;
  }

  getCities() {
    if (!this._cities$) {
      this._cities$ = this.http.get<any>(environment.api_cities).pipe(shareReplay(1));
    }
    return this._cities$;
  }

  getTransports() {
    if (!this._transports$) {
      this._transports$ = this.http.get<any>(environment.api_transports).pipe(shareReplay(1));
    }
    return this._transports$;
  }

  getPotentialTypes() {
    if (!this._potentialTypes$) {
      this._potentialTypes$ = this.http.get<any>(environment.api_potetnial_types).pipe(shareReplay(1));
    }
    return this._potentialTypes$;
  }

  getSections() {
    if (!this._sections$) {
      this._sections$ = this.http.get<any>(environment.api_sections).pipe(shareReplay(1));
    }
    return this._sections$;
  }
}
