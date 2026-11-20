"""Read ECO Portal EPDs (ILCD+EPD JSON from GET /v1/ilcd/{regAuth}/{uuid}).

Pure functions: no database. See the EN 15804+A2 design (2026-11-20).
"""
import re
from dataclasses import dataclass, field
from typing import Optional

# LCIA method UUID -> EVAmed A2 short name (EF 3.0 and EF 3.1 UUIDs). The climate change
# sub-indicators are read from their label instead: some publishers attach the EF 3.1
# fossil/biogenic UUIDs the other way round, and the values follow the label.
LCIA_METHODS = {
    'b5c629d6-def3-11e6-bf01-fe55135034f3': 'ODP',
    'b5c611c6-def3-11e6-bf01-fe55135034f3': 'AP',
    'b53ec18f-7377-4ad3-86eb-cc3f4f276b2b': 'EP-freshwater',
    'b5c619fa-def3-11e6-bf01-fe55135034f3': 'EP-marine',
    'b5c614d2-def3-11e6-bf01-fe55135034f3': 'EP-terrestrial',
    'b5c610fe-def3-11e6-bf01-fe55135034f3': 'POCP',
    'b2ad6494-c78d-11e6-9d9d-cec0c932ce01': 'ADPE',
    'b2ad6110-c78d-11e6-9d9d-cec0c932ce01': 'ADPF',
    'b2ad66ce-c78d-11e6-9d9d-cec0c932ce01': 'WDP',
}
GWP_METHODS = {
    # EF 3.1
    'a7ea142a-9749-11ed-a8fc-0242ac120002', 'a7ea19c0-9749-11ed-a8fc-0242ac120002',
    'a7ea186c-9749-11ed-a8fc-0242ac120002', 'a7ea1ae2-9749-11ed-a8fc-0242ac120002',
    # EF 3.0
    '6a37f984-a4b3-458a-a20a-64418c145fa2', '5f635281-343e-44fb-83df-1971b155e6b6',
    '2356e1ab-0185-4db5-86e5-16de51c7485c', '4331bbdb-978a-490d-8707-eeb047f01a55',
}
_GWP_LABELS = [  # order matters: 'land use' before the others, 'total' last
    ('GWP-luluc', re.compile(r'luluc|land use', re.I)),
    ('GWP-biogenic', re.compile(r'biogenic', re.I)),
    ('GWP-fossil', re.compile(r'fossil', re.I)),
    ('GWP-total', re.compile(r'total', re.I)),
]
MODULES = ('A1-A3', 'A1', 'A2', 'A3')

# Products the owner excluded (2026-11-19): slag and adhesives.
EXCLUDED_NAMES = {'steel slang', 'bekron cementitious adhesives', 'pegamento medio pvc transparente'}

# ILCD reference unit -> (EVAmed Unit name, amount of the ILCD unit in one EVAmed unit)
_UNITS = {'kg': ('Kg', 1.0), 'm2': ('m²', 1.0), 'm3': ('m³', 1.0), 'm': ('m', 1.0),
          'pcs.': ('Pz', 1.0), 'pcs': ('Pz', 1.0), 'piece': ('Pz', 1.0), 't': ('Ton', 1.0)}
_PROPERTY_UNITS = {'mass': 'kg', 'area': 'm2', 'volume': 'm3', 'length': 'm', 'number of pieces': 'pcs.',
                   'number': 'pcs.'}


@dataclass
class EpdRecord:
    uuid: str
    version: Optional[str]
    reg_authority: Optional[str]
    name: str
    owner: str
    geo: str
    description: str
    compliance: list
    declared_amount: float
    unit: Optional[str]
    unit_inferred: bool
    scale: float  # multiply EPD values by this to get values per one EVAmed unit
    mass_tonnes: Optional[float]  # tonnes per one EVAmed unit, for A4 transport
    values: dict = field(default_factory=dict)  # (short name, module) -> float, per EVAmed unit


def _text(items):
    for item in items or []:
        if item.get('value'):
            return item['value']
    return ''


def _short_name(reference):
    method = reference.get('refObjectId')
    if method in GWP_METHODS:
        label = _text(reference.get('shortDescription'))
        if 'GHG' in label:
            return None
        return next((short for short, pattern in _GWP_LABELS if pattern.search(label)), None)
    return LCIA_METHODS.get(method)


def _number(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _reference_unit(exchange):
    """(ILCD unit, declared amount, inferred?) for the reference flow."""
    props = exchange.get('flowProperties') or []
    flagged = next((p for p in props if p.get('referenceFlowProperty') and p.get('referenceUnit')), None)
    amount = _number(exchange.get('resultingflowAmount')) or _number(exchange.get('meanAmount')) or 1.0
    if flagged:
        return flagged['referenceUnit'], amount, False
    named = {_text(p.get('name')).lower(): _number(p.get('meanValue')) for p in props}
    if named.get('area') == 1:
        return 'm2', 1.0, True
    if named.get('volume') == 1:
        return 'm3', 1.0, True
    if any(name == '' and value == 1000 for name, value in named.items()):
        return 'kg', 1000.0, True
    if named.get('mass') in (1, 1000):
        # The exchange's declared amount wins: some EPDs carry Mass = 1 on a 1000 kg flow.
        declared = _number(exchange.get('resultingflowAmount'))
        return 'kg', declared if declared in (1, 1000) else named['mass'], True
    return None, amount, True


def _mass_kg(exchange, ilcd_unit):
    """Mass per declared unit in kg, when the EPD states it."""
    props = exchange.get('flowProperties') or []
    for prop in props:
        if _text(prop.get('name')).lower() == 'mass' and ilcd_unit != 'kg':
            mass = _number(prop.get('meanValue'))
            # 1 kg per m², m³ or piece is a template placeholder, not a mass.
            if mass and mass != 1:
                return mass
    if ilcd_unit == 'm3':
        for prop in exchange.get('materialProperties') or []:
            if prop.get('name') == 'gross density':
                return _number(prop.get('value'))
    return None


def parse(doc):
    info = doc['processInformation']['dataSetInformation']
    publication = (doc.get('administrativeInformation') or {}).get('publicationAndOwnership') or {}
    exchanges = (doc.get('exchanges') or {}).get('exchange') or []
    reference = next((e for e in exchanges if e.get('referenceFlow')), exchanges[0] if exchanges else {})

    ilcd_unit, amount, inferred = _reference_unit(reference)
    if ilcd_unit == 'kg' and amount == 1000:
        unit, per_unit = 'Ton', 1000.0
    elif ilcd_unit in _UNITS:
        unit, per_unit = _UNITS[ilcd_unit][0], 1.0
    else:
        unit, per_unit = None, 1.0
    scale = per_unit / amount if amount else 1.0

    if unit == 'Ton':
        mass = 1.0
    elif unit == 'Kg':
        mass = 0.001
    else:
        mass_kg = _mass_kg(reference, ilcd_unit)
        mass = (mass_kg / 1000.0) * scale if mass_kg else None

    values = {}
    for result in (doc.get('LCIAResults') or {}).get('LCIAResult') or []:
        short = _short_name(result.get('referenceToLCIAMethodDataSet') or {})
        if not short:
            continue
        for any_ in (result.get('other') or {}).get('anies') or []:
            module, value = any_.get('module'), _number(any_.get('value'))
            if module in MODULES and value is not None:
                values[(short, module)] = value * scale

    compliance = [_text((c.get('referenceToComplianceSystem') or {}).get('shortDescription'))
                  for c in ((doc.get('modellingAndValidation') or {}).get('complianceDeclarations') or {})
                  .get('compliance') or []]
    technology = (doc['processInformation'].get('technology') or {}).get('technologyDescriptionAndIncludedProcesses')
    return EpdRecord(
        uuid=info['UUID'],
        version=publication.get('dataSetVersion'),
        reg_authority=(publication.get('referenceToRegistrationAuthority') or {}).get('refObjectId'),
        name=_text(info.get('name', {}).get('baseName')).strip(),
        owner=_text((publication.get('referenceToOwnershipOfDataSet') or {}).get('shortDescription')).strip(),
        geo=((doc['processInformation'].get('geography') or {})
             .get('locationOfOperationSupplyOrProduction') or {}).get('location') or '',
        description=_text(technology).strip(),
        compliance=compliance,
        declared_amount=amount,
        unit=unit,
        unit_inferred=inferred,
        scale=scale,
        mass_tonnes=mass,
        values=values,
    )


def skip_reason(record):
    if record.name.lower() in EXCLUDED_NAMES:
        return 'excluded by owner'
    if not any('+A2' in c for c in record.compliance):
        return 'not EN 15804+A2'
    if record.unit is None:
        return 'unknown declared unit'
    return None


def portal_url(record):
    return 'https://portal.eco-platform.org/epds/{}/{}'.format(record.reg_authority, record.uuid)
