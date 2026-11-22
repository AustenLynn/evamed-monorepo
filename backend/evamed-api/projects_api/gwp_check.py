"""
Internal consistency of EN 15804+A2 climate change values (audit A-11, 2026-11-22).

GWP-total is by definition GWP-fossil + GWP-biogenic + GWP-luluc. The ecoinvent
3.12 sandbox breaks that rule for 55 of 58 materials (the API itself returns the
inconsistent numbers), so a refresh warns about it and `check_gwp` lists what
is stored. ECO Platform EPDs pass within rounding.
"""
PARTS = ('GWP-fossil', 'GWP-biogenic', 'GWP-luluc')
TOTAL = 'GWP-total'
# EPDs round each value on its own; 5 % covers that (the worst ECO Platform case is 3.9 %).
TOLERANCE = 0.05


def mismatch(values, tolerance=TOLERANCE):
    """{'total', 'suma', 'diferencia'} when total and the sum of its parts disagree; else None.

    `values` maps short indicator names to numbers. Missing parts mean there is
    nothing to compare.
    """
    if TOTAL not in values or any(part not in values for part in PARTS):
        return None
    total = float(values[TOTAL])
    suma = sum(float(values[part]) for part in PARTS)
    scale = max(abs(total), abs(suma))
    if scale == 0:
        return None
    diferencia = abs(total - suma) / scale
    if diferencia <= tolerance:
        return None
    return {'total': total, 'suma': suma, 'diferencia': diferencia}
