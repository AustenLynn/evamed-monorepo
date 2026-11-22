"""
Lifecycle results of one project (Python port of the frontend OperacionesDeFase).

`compute` is the single place results are calculated; ProjectResultsView only
resolves the project and the databases (A-32 plan, 2026-11-22).
"""
from projects_api import methods, models


_PRODUCTION_STAGES = [2, 3, 4]  # standard_id: A1, A2, A3
_AGGREGATE_STANDARD = 1         # standard_id: A1-A3 (cradle-to-gate, not decomposable)


def _aggregate_material_ids(msd_rows):
    """
    Material ids whose impact data only exists as a single A1-A3 aggregate.

    Some source databases publish a per-module A1/A2/A3 split (EPDs, mexicaniuh);
    others publish only a combined cradle-to-gate value (EPiC, ECOINVENT 3 —
    ecoinvent 'Cut-off, S' system processes structurally cannot be decomposed).
    Deciding per material from the data it actually has, rather than from a
    hardcoded database name, keeps this correct when a new source is added.
    """
    stages_by_material = {}
    for row in msd_rows:
        stages_by_material.setdefault(row.material_id_id, set()).add(row.standard_id_id)
    return {
        material_id
        for material_id, stages in stages_by_material.items()
        if _AGGREGATE_STANDARD in stages and not stages.intersection(_PRODUCTION_STAGES)
    }


_BIOGENIC_RELEASE_TYPES = frozenset(['GWP-biogenic', 'GWP-total'])
# Tonnes per unit for units whose mass is the unit itself (A4 transport weight).
_UNIT_TONNES = {'Kg': 0.001, 'kg': 0.001, 'Ton': 1.0}


def _material_value(msd_lookup, aggregate_materials, material_id, type_id):
    """A1-A3 for one material and indicator, read as the production stage reads it."""
    if material_id in aggregate_materials:
        return msd_lookup.get((material_id, _AGGREGATE_STANDARD, type_id), 0)
    return sum(msd_lookup.get((material_id, stage, type_id), 0) for stage in _PRODUCTION_STAGES)


def _apply_a2_exclusions(scheme_project, conv_lookup, msd_lookup, aggregate_materials, potential_types, excluded,
                         active_databases):
    """Under EN 15804+A2: drop rows whose material lacks any A2 indicator, flag rows with no mass
    (their transport is left out instead of assuming 1 t), and total the biogenic release."""
    missing_by_material = methods.missing_by_material({ps.material_id_id for ps in scheme_project})
    biogenic = next((p.id for p in potential_types if p.name_potential_type == 'GWP-biogenic'), None)
    kept, no_mass, release = [], set(), 0.0
    for ps in scheme_project:
        mat = ps.material_id
        missing = missing_by_material.get(ps.material_id_id, [])
        if missing:
            excluded['materials'].append({
                'row_id': ps.id, 'material_id': ps.material_id_id,
                'name': mat.name_material if mat else None,
                'database': mat.database_from if mat else None,
                'section': ps.section_id.name_section if ps.section_id else None,
                'reason': 'old_method' if len(missing) >= len(potential_types) else 'missing:' + ','.join(missing),
            })
            continue
        kept.append(ps)
        if ps.material_id_id not in conv_lookup:
            unit = mat.unit_id.name_unit if mat.unit_id else None
            if unit in _UNIT_TONNES:
                conv_lookup[ps.material_id_id] = _UNIT_TONNES[unit]
            else:
                no_mass.add(ps.id)
                # Imported rows store 0 for no distance, so only a positive one is transport.
                if (ps.distance_init or 0) > 0 or (ps.distance_end or 0) > 0:
                    excluded['no_mass'].append(
                        {'row_id': ps.id, 'material_id': ps.material_id_id, 'name': mat.name_material})
        if biogenic is not None and (mat.database_from or '') in active_databases:
            # The original and every replacement (B4) are released at end of life (-1/+1 balance).
            uptake = (_material_value(msd_lookup, aggregate_materials, ps.material_id_id, biogenic)
                      * float(ps.quantity or 0) * (1 + (ps.replaces or 0)))
            if uptake < 0:
                release -= uptake
    return kept, no_mass, release


def _list_noncurrent_factors(scheme_project, ecd_list, source_ids, excluded):
    """Transport, energy and construction entries the project uses that have no A2 values."""
    used_transport = set()
    for ps in scheme_project:
        if ps.distance_init is not None:
            used_transport.add(ps.transport_id_origin_id or 1)
        if ps.distance_end is not None:
            used_transport.add(ps.transport_id_end_id or 4)
    for key, model, name_field, used, current in (
            ('transport', models.Transport, 'name_transport', used_transport, methods.current_transport_ids),
            ('energy', models.TypeEnergy, 'name_type_energy', {e.type_id for e in ecd_list if e.type_id}, methods.current_energy_ids),
            ('sources', models.SourceInformation, 'name_source_information', set(source_ids), methods.current_source_ids)):
        missing = used - current() if used else set()
        excluded[key] = [{'id': row.id, 'name': getattr(row, name_field)}
                         for row in model.objects.filter(id__in=missing).order_by('id')]




def compute(project, active_databases, detalle=False):
    """The /results/ payload: datos per indicator, stage and substage, plus excluded and carbono."""
    project_id = project.id
    # --- project-scoped data ---
    # Systems switched off on the Materiales page don't count, as on Resultados.
    switched_off = set(
        models.MaterialStageSystemSelection.objects.filter(project_id=project_id, is_selected=False)
        .values_list('section_id_id', 'origin_id_id', 'construction_system')
    )
    scheme_project = [
        ps for ps in models.MaterialSchemeProject.objects.filter(project_id=project_id)
        .select_related('material_id__unit_id', 'section_id')
        if (ps.section_id_id, ps.origin_id_id, ps.construction_system) not in switched_off
    ]
    material_ids = [ps.material_id_id for ps in scheme_project]

    # MaterialSchemeData: (material_id, standard_id, potential_type_id) → summed value
    msd_rows = list(models.MaterialSchemeData.objects.filter(material_id__in=material_ids))
    msd_lookup = {}
    for msd in msd_rows:
        key = (msd.material_id_id, msd.standard_id_id, msd.potential_type_id_id)
        msd_lookup[key] = msd_lookup.get(key, 0) + float(msd.value or 0)

    # Materials carrying only a combined A1-A3 value (no extra query).
    aggregate_materials = _aggregate_material_ids(msd_rows)

    # Conversions: material_id → weight factor
    conv_lookup = {
        c.material_id_id: float(c.value or 0)
        for c in models.Conversions.objects.filter(material_id__in=material_ids)
    }

    cse_list = list(models.ConstructiveSystemElement.objects.filter(project_id=project_id))
    ecdp_list = list(
        models.ElectricityConsumptionDeconstructiveProcess.objects.filter(project_id=project_id)
    )

    # SourceInformationData filtered to sources used by CSE + ECDP
    source_ids = list({
        cse.source_information_id_id for cse in cse_list if cse.source_information_id_id
    } | {
        ecdp.source_information_id_id for ecdp in ecdp_list if ecdp.source_information_id_id
    })
    sid_lookup = {}
    if source_ids:
        for sid in models.SourceInformationData.objects.filter(sourceInformarion_id__in=source_ids):
            sid_lookup[(sid.sourceInformarion_id_id, sid.potential_type_id_id)] = float(sid.value or 0)

    acr_list = list(models.AnnualConsumptionRequired.objects.filter(project_id=project_id))
    ecd_list = list(
        models.ElectricityConsumptionData.objects.filter(
            annual_consumption_required_id=acr_list[0].id
        )
    ) if acr_list else []

    # TypeEnergyData: (type_energy_id, potential_type_id) → value
    ecd_type_ids = [ecd.type_id for ecd in ecd_list if ecd.type_id]
    ted_lookup = {}
    if ecd_type_ids:
        for ted in models.TypeEnergyData.objects.filter(type_energy_id__in=ecd_type_ids):
            ted_lookup[(ted.type_energy_id_id, ted.potential_type_id_id)] = float(ted.value or 0)

    # PotentialTransport: (potential_type_id, transport_id) → value
    pt_lookup = {
        (pt.potential_type_id_id, pt.transport_id_id): float(pt.value or 0)
        for pt in models.PotentialTransport.objects.all()
    }

    # Standards: id → name
    standards = {s.id: s.name_standard for s in models.Standard.objects.all()}

    # Useful life
    useful_life = 1.0
    if project.useful_life_id:
        try:
            useful_life = float(project.useful_life_id.name_useful_life)
        except (ValueError, TypeError):
            pass

    potential_types = list(methods.active_potential_types())
    a2 = methods.active_method() == methods.A2
    excluded = {'materials': [], 'no_mass': [], 'transport': [], 'energy': [], 'sources': []}
    no_mass_rows, biogenic_release = set(), 0.0
    if a2:
        scheme_project, no_mass_rows, biogenic_release = _apply_a2_exclusions(
            scheme_project, conv_lookup, msd_lookup, aggregate_materials, potential_types, excluded,
            active_databases)
        _list_noncurrent_factors(scheme_project, ecd_list, source_ids, excluded)

    datos = {}
    error_calculos = False

    for impacto in potential_types:
        name = impacto.name_complete_potential_type
        datos[name] = {}

        # ---- Producción ----
        produccion = {}
        row_transport = {}  # row id → that row's transport, which its replacements bring again (B4)

        for subetapa in _PRODUCTION_STAGES:
            subproceso = standards.get(subetapa, str(subetapa))
            total = 0
            for ps in scheme_project:
                mat = ps.material_id
                db = mat.database_from or ''
                if db not in active_databases or mat.id in aggregate_materials:
                    continue
                total += msd_lookup.get((mat.id, subetapa, impacto.id), 0) * float(ps.quantity or 0)
            produccion[subproceso] = produccion.get(subproceso, 0) + total

        aggregate_key = standards.get(_AGGREGATE_STANDARD, 'A1-A3')
        aggregate_total = 0
        for ps in scheme_project:
            mat = ps.material_id
            if (mat.database_from or '') not in active_databases:
                continue
            if mat.id in aggregate_materials:
                aggregate_total += (
                    msd_lookup.get((mat.id, _AGGREGATE_STANDARD, impacto.id), 0)
                    * float(ps.quantity or 0)
                )
        if aggregate_total:
            produccion[aggregate_key] = produccion.get(aggregate_key, 0) + aggregate_total

        datos[name]['Producción'] = produccion

        # ---- Construcción ----
        a4_total = 0
        for ps in scheme_project:
            mat = ps.material_id
            db = mat.database_from or ''
            if db not in active_databases:
                continue

            intl = (
                pt_lookup.get((impacto.id, ps.transport_id_origin_id or 1), 0)
                * float(ps.distance_init)
            ) if ps.distance_init is not None else 0

            natl = (
                pt_lookup.get((impacto.id, ps.transport_id_end_id or 4), 0)
                * float(ps.distance_end)
            ) if ps.distance_end is not None else 0

            peso = conv_lookup.get(mat.id, 1)
            tv = 0 if ps.id in no_mass_rows else peso * float(ps.quantity or 0) * (intl + natl)
            a4_total += tv
            row_transport[ps.id] = tv

        a5_total = sum(
            sid_lookup.get((cse.source_information_id_id, impacto.id), 0) * float(cse.quantity or 0)
            for cse in cse_list
        )
        datos[name]['Construccion'] = {'A4': a4_total, 'A5': a5_total}

        # ---- Uso ----
        b4_total = 0
        for ps in scheme_project:
            mat = ps.material_id
            db = mat.database_from or ''
            if db not in active_databases:
                continue
            replaces = ps.replaces or 0
            # Only this row's transport: the material's other rows have their own replacements.
            b4_total += row_transport.get(ps.id, 0) * replaces
            if mat.id not in aggregate_materials:
                for subetapa in _PRODUCTION_STAGES:
                    b4_total += (
                        msd_lookup.get((mat.id, subetapa, impacto.id), 0)
                        * float(ps.quantity or 0) * replaces
                    )
            else:
                b4_total += (
                    msd_lookup.get((mat.id, _AGGREGATE_STANDARD, impacto.id), 0)
                    * float(ps.quantity or 0) * replaces
                )

        b6_total = sum(
            useful_life * ted_lookup.get((ecd.type_id, impacto.id), 0) * float(ecd.quantity or 0)
            for ecd in ecd_list
        )
        datos[name]['Uso'] = {'B4': b4_total, 'B6': b6_total}

        # ---- Fin de vida ----
        c1_total = 0
        for ecdp in ecdp_list:
            ev = sid_lookup.get((ecdp.source_information_id_id, impacto.id))
            if ev is not None:
                c1_total += float(ecdp.quantity or 0) * ev
            else:
                error_calculos = True
        # EN 15804+A2: biogenic CO2 taken up in A1-A3 is released at end of life (design 2026-11-20).
        c3_total = biogenic_release if impacto.name_potential_type in _BIOGENIC_RELEASE_TYPES else 0
        datos[name]['FinDeVida'] = {'C1': c1_total, 'C2': 0, 'C3': c3_total, 'C4': 0}

    # The climate-change indicator (GWP-total under A2, PCG 100 under CML) for the stage pages' carbon bar.
    gwp = methods.gwp_total_type()
    carbono = {'name': gwp.name_complete_potential_type, 'unit': gwp.unit_potential_type} if gwp else None
    return {
        'project_id': project_id, 'datos': datos, 'error': error_calculos, 'excluded': excluded,
        'carbono': carbono,
    }
