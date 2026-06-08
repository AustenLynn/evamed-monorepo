import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { shareReplay, tap } from 'rxjs/operators';
import { environment } from './../../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AnalisisService {
  proyectos = [];

  private _usefulLife$: Observable<any>;
  private _typeEnergy$: Observable<any>;
  private _sourceInformation$: Observable<any>;
  private _potentialTypes$: Observable<any>;
  private _standards$: Observable<any>;
  private _schemeProject$: Observable<any>;
  private _sections$: Observable<any>;
  private _materials$: Observable<any>;
  private _potentialTransport$: Observable<any>;
  private _conversions$: Observable<any>;
  private _db$: Observable<any>;

  constructor(private http: HttpClient) {}

  // Mutable per-project data — not cached
  getECDP() {
    return this.http.get<any>(environment.api_electricity_consumption_deconstructive_process);
  }

  getTypeEnergyData() {
    return this.http.get<any>(environment.api_type_energy_data);
  }

  getElectricityConsumptionData() {
    return this.http.get<any>(environment.api_electricity_consumption_data);
  }

  getAnnualConsumptionRequired() {
    return this.http.get<any>(environment.api_annual_consumption_required);
  }

  getSourceInformationData() {
    return this.http.get<any>(environment.api_source_information_data);
  }

  getMaterialSchemeData() {
    return this.http.get<any>(environment.api_material_scheme_data).pipe(
      tap(data => { return data; })
    );
  }

  updateMaterialSchemeData(id: string, changes) {
    return this.http
      .put(`${environment.api_material_scheme_data}${id}/`, changes)
      .pipe(tap(data => { return data; }));
  }

  addMaterialSchemeData(data: object) {
    return this.http.post<any>(environment.api_material_scheme_data, data).pipe(
      tap(data => { return data; })
    );
  }

  // Static reference data — cached for the session
  getUsefulLife() {
    if (!this._usefulLife$) {
      this._usefulLife$ = this.http.get<any>(environment.api_useful_life).pipe(shareReplay(1));
    }
    return this._usefulLife$;
  }

  getTypeEnergy() {
    if (!this._typeEnergy$) {
      this._typeEnergy$ = this.http.get<any>(environment.api_type_energy).pipe(shareReplay(1));
    }
    return this._typeEnergy$;
  }

  getSourceInformation() {
    if (!this._sourceInformation$) {
      this._sourceInformation$ = this.http.get<any>(environment.api_source_information).pipe(shareReplay(1));
    }
    return this._sourceInformation$;
  }

  getConstructiveSystemElement() {
    return this.http.get<any>(environment.api_construction_stage).pipe(
      tap(data => { return data; })
    );
  }

  getPotentialTypes() {
    if (!this._potentialTypes$) {
      this._potentialTypes$ = this.http.get<any>(environment.api_potetnial_types).pipe(shareReplay(1));
    }
    return this._potentialTypes$;
  }

  getStandars() {
    if (!this._standards$) {
      this._standards$ = this.http.get<any>(environment.api_standards).pipe(shareReplay(1));
    }
    return this._standards$;
  }

  getMaterialSchemeProyect() {
    if (!this._schemeProject$) {
      this._schemeProject$ = this.http.get<any>(environment.api_scheme_project).pipe(shareReplay(1));
    }
    return this._schemeProject$;
  }

  getSectionsList() {
    if (!this._sections$) {
      this._sections$ = this.http.get<any>(environment.api_sections).pipe(shareReplay(1));
    }
    return this._sections$;
  }

  getMaterials() {
    if (!this._materials$) {
      this._materials$ = this.http.get<any>(environment.api_materials).pipe(shareReplay(1));
    }
    return this._materials$;
  }

  getPotentialTransport() {
    if (!this._potentialTransport$) {
      this._potentialTransport$ = this.http.get<any>(environment.api_potential_transport).pipe(shareReplay(1));
    }
    return this._potentialTransport$;
  }

  getConversion() {
    if (!this._conversions$) {
      this._conversions$ = this.http.get<any>(environment.api_conversions).pipe(shareReplay(1));
    }
    return this._conversions$;
  }

  getDB() {
    if (!this._db$) {
      this._db$ = this.http.get<any>(environment.api_db_material).pipe(shareReplay(1));
    }
    return this._db$;
  }

  getProjectResults(projectId: number, databases?: string) {
    const url = `${environment.api_projects}${projectId}/results/`;
    const params = databases ? { databases } : {};
    return this.http.get<any>(url, { params });
  }
}
