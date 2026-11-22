"""Atomic, optimistic Usage edits. Legacy CRUD remains compatible.

Only new aggregate writers share the project lock. Legacy changes made before
an aggregate request are detected by its revision; this does not serialize
concurrent legacy CRUD writers.
"""
import hashlib
import json
from decimal import Decimal

from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import permissions, serializers
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from projects_api import methods, models
from projects_api.access import visible_projects
from projects_api.explorer import derive

# Verified names in fixtures/initial_data.json. Never infer an unknown family.
FAMILIES = {
    **{f'Energía eléctrica, {voltage} voltaje (MX)-{database}': 'electric'
       for voltage in ('Bajo', 'Medio', 'Alto')
       for database in ('ECOINVENT3', 'MEXICANIUH')},
    'Calefacción doméstica con gas natural (GLO)': 'fuel',
}


class Conflict(APIException):
    status_code = 409
    default_detail = 'El uso cambió. Recarga y revisa tus cambios antes de guardar.'


class StrictSerializer(serializers.Serializer):
    def to_internal_value(self, data):
        if not isinstance(data, dict) or set(data) - set(self.fields):
            raise ValidationError('Campos no admitidos.')
        return super().to_internal_value(data)


class WholeNumber(serializers.IntegerField):
    def to_internal_value(self, data):
        if isinstance(data, bool) or not (isinstance(data, int) or
                isinstance(data, str) and data.isascii() and data.isdigit()):
            self.fail('invalid')
        return super().to_internal_value(data)


class AnnualEdit(StrictSerializer):
    quantity = WholeNumber(min_value=0, max_value=2147483647)
    repair_unit = serializers.BooleanField(default=False)


class SourceFields(StrictSerializer):
    type = WholeNumber(min_value=1, allow_null=True, required=False)
    source = serializers.ChoiceField(choices=('electric', 'fuel', 'panels'), required=False)


class SourceEdit(SourceFields):
    id = WholeNumber(min_value=1)
    percentage = WholeNumber(min_value=0, max_value=100, required=False)
    repair_unit = serializers.BooleanField(default=False)


class Addition(SourceFields):
    client_id = serializers.UUIDField()
    type = WholeNumber(min_value=1, allow_null=True)
    source = serializers.ChoiceField(choices=('electric', 'fuel', 'panels'))


class Change(StrictSerializer):
    operation_id = serializers.UUIDField()
    revision = serializers.CharField(max_length=64)
    annual = AnnualEdit(required=False)
    edits = SourceEdit(many=True, default=list)
    removals = serializers.ListField(child=WholeNumber(min_value=1), default=list)
    additions = Addition(many=True, default=list, max_length=200)


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'),
                                     default=str).encode()).hexdigest()


def catalogue():
    # Every type stays in the catalogue so saved rows remain readable and editable;
    # `offerable` marks the ones with data for the active method, the only ones
    # that may be added (audit A-13, 2026-11-22).
    rows = models.TypeEnergy.objects.order_by('id')
    offered = set(methods.offerable(rows, methods.current_energy_ids).values_list('id', flat=True))
    return [dict(id=row.id, name=row.name_type_energy,
                 display_name=derive.display_name(row.name_type_energy),
                 family=FAMILIES.get(row.name_type_energy),
                 database=derive.source_from_name(row.name_type_energy),
                 region=derive.region(row.name_type_energy),
                 offerable=row.id in offered)
            for row in rows]


def row_issues(row, annual, canonical, types):
    issues = []
    share = row['percentage']
    if share is None or not 0 <= share <= 100:
        issues.append('percentage')
    if canonical is None or row['unit_id'] != canonical:
        issues.append('unit')
    if row['source'] == 'panels':
        valid_type = row['type'] is None
    else:
        valid_type = (row['source'] in ('electric', 'fuel') and
                      row['type'] in types and types[row['type']]['family'] == row['source'])
    if not valid_type:
        issues.append('type')
    if share is not None and 0 <= share <= 100 and annual and annual['quantity'] >= 0:
        expected = Decimal(annual['quantity']) * Decimal(share) / 100
        if row['quantity'] is None or Decimal(row['quantity']) != expected:
            issues.append('quantity')
    else:
        issues.append('quantity')
    return issues


def read_state(project, lock=False):
    annual_qs = models.AnnualConsumptionRequired.objects.filter(project_id=project).order_by('id')
    source_qs = models.ElectricityConsumptionData.objects.filter(
        annual_consumption_required_id__project_id=project).order_by('id')
    if lock:
        annual_qs = annual_qs.select_for_update()
        source_qs = source_qs.select_for_update()
    annuals = list(annual_qs.values('id', 'quantity', 'unit_id'))
    sources = list(source_qs.values('id', 'annual_consumption_required_id',
                                  'percentage', 'quantity', 'unit_id', 'type', 'source'))
    for row in sources:
        if row['quantity'] is not None:
            row['quantity'] = format(row['quantity'], '.10f')
    units = list(models.Unit.objects.order_by('id').values('id', 'name_unit'))
    matches = [unit['id'] for unit in units if unit['name_unit'].strip().casefold() == 'kwh']
    canonical = matches[0] if len(matches) == 1 else None
    types = catalogue()
    revision = digest(dict(annuals=annuals, sources=sources, units=units, catalogue=types))
    annual = annuals[0] if len(annuals) == 1 else None
    issues = []
    if len(annuals) > 1:
        issues.append('multiple_annuals')
    if canonical is None:
        issues.append('canonical_unit')
    if annual and annual['unit_id'] != canonical:
        issues.append('annual_unit')
    if annual and annual['quantity'] < 0:
        issues.append('annual_quantity')
    by_type = {item['id']: item for item in types}
    for row in sources:
        row['issues'] = row_issues(row, annual, canonical, by_type)
    return dict(project_id=project.id, project_name=project.name_project,
                annual=annual, annuals=annuals, sources=sources, catalogue=types,
                units=units, canonical_unit_id=canonical, revision=revision, issues=issues)


def ensure_family(row, types):
    if row['source'] == 'panels' and row['type'] is None:
        return
    if row['source'] not in ('electric', 'fuel') or row['type'] not in types or \
            types[row['type']]['family'] != row['source']:
        raise ValidationError('Selecciona una fuente de una familia reconocida.')


def option_key(row):
    # A known catalogue type identifies an option even if its legacy family
    # label is wrong. Correcting that label must not create a new identity.
    return ('type', row['type']) if row['type'] is not None else ('source', row['source'])


def apply_change(project, state, change):
    if 'multiple_annuals' in state['issues']:
        raise ValidationError('Hay varios consumos anuales. Se requiere revisión de los registros antes de guardar.')
    annual = dict(state['annual']) if state['annual'] else None
    annual_change = change.get('annual')
    canonical = state['canonical_unit_id']
    types = {row['id']: row for row in state['catalogue']}
    original = {row['id']: row for row in state['sources']}
    rows = {key: dict(row) for key, row in original.items()}
    edits = change['edits']; removals = change['removals']; additions = change['additions']
    edit_ids = [edit['id'] for edit in edits]
    if len(edit_ids) != len(set(edit_ids)) or len(removals) != len(set(removals)) or \
            set(edit_ids) & set(removals) or not (set(edit_ids) | set(removals)) <= rows.keys():
        raise ValidationError('Identificadores ajenos, repetidos o incompatibles.')
    if len({row['client_id'] for row in additions}) != len(additions):
        raise ValidationError('Identificadores de adición repetidos.')
    for key in removals:
        del rows[key]
    if not annual and not annual_change:
        if edits or additions:
            raise ValidationError('Guarda primero el consumo anual.')
    annual_changed = annual_change is not None
    # A negative legacy annual can be repaired with explicit edits for its
    # sources. Otherwise validate against the saved annual, never silently
    # reinterpret inconsistent quantities when an ordinary total changes.
    edit_basis = annual
    if annual and annual['quantity'] < 0 and annual_change:
        edit_basis = {**annual, 'quantity': annual_change['quantity']}
    for edit in edits:
        row = rows[edit['id']]
        if 'type' in edit and edit['type'] != row['type'] and edit['type'] in types and \
                not types[edit['type']]['offerable']:
            raise ValidationError('Esta fuente no tiene datos del método de cálculo actual.')
        row.update({key: value for key, value in edit.items() if key in ('percentage', 'source', 'type')})
        if edit['repair_unit']:
            if canonical is None:
                raise ValidationError('No existe una única unidad kWh en Unit. Solicita revisión del catálogo.')
            row['unit_id'] = canonical
        ensure_family(row, types)
        if canonical is None or row['unit_id'] != canonical:
            raise ValidationError('Confirma explícitamente la reparación de unidad de esta fuente.')
        if row['percentage'] is None or not 0 <= row['percentage'] <= 100:
            raise ValidationError('Indica un porcentaje entero entre 0 y 100.')
        if edit_basis is None:
            raise ValidationError('Repara primero el consumo anual.')
        if edit_basis['quantity'] >= 0:
            row['quantity'] = str(Decimal(edit_basis['quantity']) * row['percentage'] / 100)
        # While a legacy annual is negative, an explicit metadata repair keeps
        # its saved quantity unchanged until coordinated annual repair.

    if annual_changed:
        if canonical is None:
            raise ValidationError('No existe una única unidad kWh en Unit. Solicita revisión del catálogo.')
        if annual and annual['unit_id'] != canonical and not annual_change['repair_unit']:
            raise ValidationError('Confirma explícitamente la reparación de unidad del consumo anual.')
        # A negative legacy annual may be repaired together with all its rows.
        for row in rows.values():
            if row_issues(row, edit_basis, canonical, types):
                raise ValidationError('Repara o elimina las fuentes inconsistentes antes de cambiar el consumo anual.')
        annual = {**(annual or {}), 'quantity': annual_change['quantity'], 'unit_id': canonical}
        for row in rows.values():
            row['quantity'] = str(Decimal(annual['quantity']) * row['percentage'] / 100)
    # Historic duplicate options remain editable; a replacement must not
    # introduce a duplicate among the final surviving rows.
    for key in edit_ids:
        row = rows[key]
        option = option_key(row)
        old = original[key]
        if option != option_key(old) and any(
                other_id != key and option_key(other) == option
                for other_id, other in rows.items()):
            raise ValidationError('Esta fuente ya está agregada.')
    existing_types = {option_key(row) for row in rows.values()}
    new_rows = []
    for addition in additions:
        if canonical is None or not annual or annual['unit_id'] != canonical or annual['quantity'] < 0:
            raise ValidationError('Revisa el consumo anual y la unidad kWh antes de agregar fuentes.')
        ensure_family(addition, types)
        if addition['type'] is not None and not types[addition['type']]['offerable']:
            raise ValidationError('Esta fuente no tiene datos del método de cálculo actual.')
        if option_key(addition) in existing_types:
            raise ValidationError('Esta fuente ya está agregada.')
        existing_types.add(option_key(addition))
        new_rows.append(dict(type=addition['type'], source=addition['source'],
                             percentage=0, quantity=Decimal(0), unit_id=canonical))
    allocated = sum(max(0, row['percentage'] or 0) for row in rows.values())
    previous_allocated = sum(max(0, row['percentage'] or 0) for row in original.values())
    # Retained legacy rows may already exceed 100%. Independent repairs must
    # be able to make progress without deleting IDs or committing other drafts.
    # Only a source-only strict reduction can temporarily remain overallocated.
    reducing_legacy = (previous_allocated > 100 and allocated < previous_allocated
                       and not annual_changed and not additions)
    if allocated > 100 and not reducing_legacy:
        raise ValidationError('La asignación total no puede superar 100 %.')
    # Everything above is validation; write only after the whole request is valid.
    acr = None
    if annual_changed:
        if state['annual']:
            acr = models.AnnualConsumptionRequired.objects.get(pk=annual['id'])
            acr.quantity = annual['quantity']; acr.unit_id_id = annual['unit_id']
            acr.save(update_fields=['quantity', 'unit_id'])
        else:
            acr = models.AnnualConsumptionRequired.objects.create(
                project_id=project, quantity=annual['quantity'], unit_id_id=annual['unit_id'])
    elif annual:
        acr = models.AnnualConsumptionRequired.objects.get(pk=annual['id'])
    models.ElectricityConsumptionData.objects.filter(pk__in=removals).delete()
    changed_ids = set(rows) if annual_changed else set(edit_ids)
    for key in sorted(changed_ids):
        row = rows[key]
        models.ElectricityConsumptionData.objects.filter(pk=key).update(
            **{field: row[field] for field in ('quantity', 'percentage', 'source')},
            type_id=row['type'], unit_id_id=row['unit_id'])
    for row in new_rows:
        models.ElectricityConsumptionData.objects.create(
            annual_consumption_required_id=acr, quantity=row['quantity'],
            percentage=0, source=row['source'], type_id=row['type'], unit_id_id=row['unit_id'])


class UsageView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, project_id):
        with transaction.atomic():
            project = get_object_or_404(visible_projects(request.user).select_for_update(), pk=project_id)
            state = read_state(project, lock=True)
            operation_id = request.query_params.get('operation_id')
            if operation_id:
                field = serializers.UUIDField()
                operation_id = field.run_validation(operation_id)
                state['operation_applied'] = models.UsageSaveReceipt.objects.filter(
                    project=project, operation_id=operation_id).exists()
            return Response(state)

    def put(self, request, project_id):
        serializer = Change(data=request.data)
        serializer.is_valid(raise_exception=True)
        change = serializer.validated_data
        request_hash = digest(request.data)
        with transaction.atomic():
            project = get_object_or_404(visible_projects(request.user).select_for_update(), pk=project_id)
            receipt = models.UsageSaveReceipt.objects.filter(
                project=project, operation_id=change['operation_id']).first()
            state = read_state(project, lock=True)
            if receipt:
                if receipt.request_hash != request_hash:
                    raise Conflict('Este identificador ya corresponde a otra operación. Recarga para revisar.')
                return Response({**state, 'replayed': True})
            if state['revision'] != change['revision']:
                raise Conflict()
            apply_change(project, state, change)
            models.UsageSaveReceipt.objects.create(project=project, operation_id=change['operation_id'],
                                                   request_hash=request_hash)
            return Response({**read_state(project), 'replayed': False})
