"""
Pure name-parsing and candidate-scoring helpers. No I/O, so unit-testable.

EVAmed's ecoinvent-sourced materials kept ecoinvent's own SimaPro-style naming,
e.g. ``Clay brick {GLO}| market for | Cut-off, S``, which is what makes
automatic resolution possible at all. The transports, energy types and
machinery sources use Spanish prose instead and need the manual pin table.
"""
import difflib
import re

# 'Clay brick {GLO}| market for | Cut-off, S'
_SIMAPRO_RE = re.compile(
    r'^(?P<activity>.+?)\s*\{(?P<geography>[^}]+)\}\|\s*(?P<qualifier>.*?)\s*'
    r'(?:\|\s*(?P<system_model>[^|]*?)\s*)?$'
)

# 'Panel fotovoltaico, Silicio amorfo (a-Si) (GLO)' — trailing parenthesised code.
_TRAILING_GEO_RE = re.compile(r'^(?P<activity>.+?)\s*\((?P<geography>[A-Za-z]{2,6})\)\s*$')

MARKET_ACTIVITY = 'MARKET_ACTIVITY'
MARKET_GROUP = 'MARKET_GROUP'
TRANSFORMING_ACTIVITY = 'TRANSFORMING_ACTIVITY'

AUTO_ACCEPT_THRESHOLD = 0.82

# Units that mean the same physical quantity on either side of the integration.
_UNIT_ALIASES = {
    'kg': {'kg'},
    'm2': {'m2', 'm²'},
    'm3': {'m3', 'm³'},
    'kwh': {'kwh'},
    'mj': {'mj'},
    'unit': {'unit', 'pz', 'pza'},
    'm': {'m'},
    'ton': {'ton'},
}


class ParsedName(object):
    """Structured view of an EVAmed material name."""

    def __init__(self, activity, geography_code=None, qualifier=None,
                 system_model_hint=None, raw=''):
        self.activity = activity
        self.geography_code = geography_code
        self.qualifier = qualifier
        self.system_model_hint = system_model_hint
        self.raw = raw

    @property
    def activity_type(self):
        """The activity_type filter implied by the name's qualifier."""
        if not self.qualifier:
            return None
        qualifier = self.qualifier.lower()
        # 'market group for' is its own activity type in ecoinvent; treating it
        # as MARKET_ACTIVITY makes the search return nothing at all.
        if qualifier.startswith('market group'):
            return MARKET_GROUP
        if qualifier.startswith('market'):
            return MARKET_ACTIVITY
        return TRANSFORMING_ACTIVITY

    def __repr__(self):
        return 'ParsedName(activity={!r}, geography={!r}, qualifier={!r})'.format(
            self.activity, self.geography_code, self.qualifier)


def parse_simapro_name(name):
    """Parse an EVAmed material name; always returns a ParsedName."""
    raw = (name or '').strip()

    match = _SIMAPRO_RE.match(raw)
    if match:
        system_model = (match.group('system_model') or '').strip() or None
        return ParsedName(
            activity=match.group('activity').strip(),
            geography_code=match.group('geography').strip(),
            qualifier=(match.group('qualifier') or '').strip() or None,
            system_model_hint=system_model,
            raw=raw,
        )

    match = _TRAILING_GEO_RE.match(raw)
    if match:
        return ParsedName(
            activity=match.group('activity').strip(),
            geography_code=match.group('geography').strip(),
            raw=raw,
        )

    return ParsedName(activity=raw, raw=raw)


def normalize(text):
    """Lowercase, strip punctuation, collapse whitespace."""
    text = (text or '').lower()
    text = re.sub(r'[^a-z0-9\s]', ' ', text)
    return re.sub(r'\s+', ' ', text).strip()


def units_compatible(evamed_unit, ecoinvent_unit):
    """
    True when the two units describe the same quantity.

    A per-kg impact score written against a per-piece material is a silent
    error of several orders of magnitude, so this gates every auto-match.
    """
    left = (evamed_unit or '').strip().lower()
    right = (ecoinvent_unit or '').strip().lower()
    if not left or not right:
        return False
    if left == right:
        return True
    for aliases in _UNIT_ALIASES.values():
        if left in aliases and right in aliases:
            return True
    return False


def iter_candidate_datasets(search_results):
    """Flatten the search response into (activity, product, dataset) triples."""
    for result in search_results or []:
        for product in result.get('products', []):
            for dataset in product.get('datasets', []):
                yield {
                    'dataset_id': dataset.get('id'),
                    'activity_name': result.get('name'),
                    'product_name': product.get('name'),
                    'unit': product.get('unit'),
                    'geography': dataset.get('geography'),
                    'activity_type': result.get('activity_type'),
                }


def score_candidate(parsed, candidate):
    """Score a candidate 0.0-1.0 against the parsed EVAmed name."""
    target = normalize(parsed.activity)
    product = normalize(candidate.get('product_name'))
    activity = normalize(candidate.get('activity_name'))

    if product == target:
        score, method = 1.0, 'exact'
    elif activity == target:
        score, method = 0.95, 'exact'
    else:
        # Deliberately NOT treating substring containment as a near-exact
        # match: 'clay brick' is contained in 'light clay brick', and scoring
        # that 0.9 silently maps two different EVAmed materials onto one
        # dataset. Similarity ratio penalises the extra tokens instead.
        best = max(
            difflib.SequenceMatcher(None, target, product).ratio(),
            difflib.SequenceMatcher(None, target, activity).ratio(),
        )
        score, method = best * 0.85, 'fuzzy'

    # 'market for' vs 'market group for' matters: materials 425/426 are groups.
    wanted_type = parsed.activity_type
    if wanted_type and candidate.get('activity_type') == wanted_type:
        score = min(1.0, score + 0.05)

    return score, method


def pick_best(parsed, candidates, evamed_unit=None):
    """
    Choose the best candidate.

    Returns (candidate_or_None, score, method, alternatives) where
    `alternatives` records the runners-up so a wrong auto-pick is visible in
    the audit artifact rather than silent.

    Unit compatibility is reported, not enforced: 27 of the 37 ecoinvent
    materials are stored in 'Pz' while ecoinvent's reference unit is kg/m2/m3,
    and the agreed resolution is to realign the material's unit rather than to
    refuse the match. The caller must act on `unit_compatible`.
    """
    scored = []
    for candidate in candidates:
        score, method = score_candidate(parsed, candidate)
        candidate = dict(candidate)
        candidate['unit_compatible'] = (
            units_compatible(evamed_unit, candidate.get('unit'))
            if evamed_unit else True
        )
        scored.append((score, method, candidate))

    scored.sort(key=lambda row: row[0], reverse=True)
    if not scored:
        return None, 0.0, 'none', []

    alternatives = [
        {
            'dataset_id': c.get('dataset_id'),
            'product_name': c.get('product_name'),
            'geography': c.get('geography'),
            'unit': c.get('unit'),
            'score': round(s, 3),
            'unit_compatible': c.get('unit_compatible'),
        }
        for s, _m, c in scored[:3]
    ]

    top_score, top_method, top_candidate = scored[0]
    if top_score >= AUTO_ACCEPT_THRESHOLD:
        return top_candidate, top_score, top_method, alternatives

    return None, top_score, 'below-threshold', alternatives
