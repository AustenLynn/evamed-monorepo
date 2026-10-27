"""Pure functions behind the explorer's derived fields (HANDOFF §5.2, §5.4).

The catalogue has no category, source or type columns for most stages, so
they're read from the names. Each rule is pinned by tests_explorer.DeriveTests.
"""
import math
import re
import unicodedata

# A trailing '_MX' marks Mexican EPDs ('… marca DEACERO_MX'), not a category.
_MX_MARKER = re.compile(r'_MX$')
_SOURCE_SUFFIX = re.compile(r'\s*-\s*(Ecoinvent 3|ECOINVENT3|MEXICANIUH)$')
_SOURCES = {'Ecoinvent 3': 'ECOINVENT 3', 'ECOINVENT3': 'ECOINVENT 3', 'MEXICANIUH': 'mexicaniuh'}
# The Unit table spells the same unit twice (K-11).
_UNIT_SPELLINGS = {'Kg': 'kg', 'Pza': 'Pz'}

# Where a name says its region (R-44): ecoinvent's '{GLO}| market for | Cut-off, S'
# tail, a '(GLO)' ending, or '_MX' as a name part ('Grava_Gravel_MX', 'Arena_Sand_MX_concreto').
_ECOINVENT_TAIL = re.compile(r'\s*\{(?P<code>[^}]+)\}\s*\|.*$')
_REGION_SUFFIX = re.compile(r'\s*\((?P<code>GLO|RoW|MX|CH)\)$')
_MX_PART = re.compile(r'_MX(?=_|$)')
_REGIONS = {'GLO': 'Global', 'RoW': 'Resto del mundo', 'CH': 'Suiza', 'MX': 'México'}
# The filter option for items whose name doesn't say (all of EPiC).
NO_REGION = 'Sin región'


def category(name):
    """The name's prefix before the first '_', ignoring a trailing '_MX'."""
    if not name:
        return None
    head, sep, _ = _MX_MARKER.sub('', name).partition('_')
    return head.strip() or None if sep else None


def display_name(name):
    """The name without its category prefix, source suffix or region, underscores as spaces."""
    if not name:
        return name
    rest = _SOURCE_SUFFIX.sub('', name)
    for marker in (_ECOINVENT_TAIL, _REGION_SUFFIX, _MX_PART):
        rest = marker.sub('', rest)
    if category(name):
        rest = rest.split('_', 1)[1]
    return re.sub(r'\s+', ' ', rest.replace('_', ' ')).strip()


def region(name):
    """The region the name says, in Spanish ('Global', 'México'…), or None."""
    rest = _SOURCE_SUFFIX.sub('', name or '')
    match = _ECOINVENT_TAIL.search(rest) or _REGION_SUFFIX.search(rest)
    if match:
        return _REGIONS.get(match.group('code'), match.group('code'))
    return _REGIONS['MX'] if _MX_PART.search(rest) else None


def source_from_name(name):
    """The database named by a '-Ecoinvent 3' / '-ECOINVENT3' / '-MEXICANIUH' suffix."""
    match = _SOURCE_SUFFIX.search(name or '')
    return _SOURCES[match.group(1)] if match else None


def unit(name):
    return _UNIT_SPELLINGS.get(name, name) if name else None


def machinery_type(name):
    lowered = name.lower()
    if lowered.startswith('generador'):
        return 'Generador'
    if 'carga ligera' in lowered:
        return 'Maquinaria ligera'
    if 'carga pesada' in lowered:
        return 'Maquinaria pesada'
    return 'Otros'


def energy_type(name):
    return 'Gas' if 'gas' in fold(name).split() else 'Electricidad'


def fold(text):
    """Lower case without accents, for matching and sorting."""
    decomposed = unicodedata.normalize('NFKD', text or '')
    return ''.join(c for c in decomposed if not unicodedata.combining(c)).casefold()


def matches(text, query):
    """Every word of the query appears in the text, ignoring case and accents."""
    haystack = fold(text)
    return all(word in haystack for word in fold(query).split())


def sort_key(name):
    return fold(name)


def impact_levels(values):
    """{id: gwp} → {id: level} for one comparison group.

    Positive values are split in thirds by rank (ties share the lower level);
    negative values are credits. With fewer than 3 values, nothing is ranked.
    """
    if len(values) < 3:
        return {key: None for key in values}
    positives = sorted(value for value in values.values() if value >= 0)
    levels = {}
    for key, value in values.items():
        if value < 0:
            levels[key] = 'credito'
            continue
        below = sum(1 for other in positives if other < value)
        share = below / len(positives)
        levels[key] = 'bajo' if share < 1 / 3 else 'medio' if share < 2 / 3 else 'alto'
    return levels


def percentile(values, pct):
    """Linear interpolation between closest ranks, as numpy's default."""
    ordered = sorted(values)
    position = (len(ordered) - 1) * pct / 100
    low, high = math.floor(position), math.ceil(position)
    return ordered[low] + (ordered[high] - ordered[low]) * (position - low)
