"""Result set comparator for SQL practice queries.

Supports three ordering modes via the `order_sensitive` parameter:

    False / "none"    — Bag/set comparison: rows are sorted canonically before
                        comparison.  The user's ORDER BY (or lack thereof) is
                        completely ignored.

    True  / "full"    — Exact positional comparison: row #1 must match row #1,
                        row #2 must match row #2, etc.  Required when the
                        problem explicitly asks for a specific output ordering
                        AND there are no acceptable ties.

    "partial:<cols>"  — Hybrid mode for questions like "output num_products DESC,
                        break ties by spend" where the *primary* sort key(s)
                        matter but the tiebreak column(s) do not.

                        Format:  "partial:col1,col2"
                        Example: "partial:num_products"

                        The comparator groups consecutive rows that have
                        identical values for the *partial* key columns into
                        tie-groups, then checks that each tie-group contains
                        exactly the same set of rows (order inside the group
                        doesn't matter).  The sequence of tie-groups must still
                        match.
"""

from __future__ import annotations
import math
import decimal
from typing import List, Dict, Any, Tuple, Optional, Union


import datetime
import re


# ---------------------------------------------------------------------------
# Value normalisation helpers
# ---------------------------------------------------------------------------

def _normalize_val(val: Any) -> Any:
    if val is None or val == "NULL" or val == "None" or val == "":
        return None
    if isinstance(val, decimal.Decimal):
        f = float(val)
        return 0.0 if math.isclose(f, 0.0, abs_tol=1e-9) else f
    if isinstance(val, (int, float)):
        if math.isclose(val, 0.0, abs_tol=1e-9):
            return 0.0
        return val
    if isinstance(val, (datetime.date, datetime.datetime)):
        if isinstance(val, datetime.datetime) and (val.hour != 0 or val.minute != 0 or val.second != 0):
            return val.strftime("%Y-%m-%d %H:%M:%S")
        return val.strftime("%Y-%m-%d")
    # Try parsing int or float if string
    if isinstance(val, str):
        v = val.strip()
        try:
            return int(v)
        except ValueError:
            try:
                f = float(v)
                return 0.0 if math.isclose(f, 0.0, abs_tol=1e-9) else f
            except ValueError:
                pass
        m_dt = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})(?:\s+(\d{1,2}:\d{2}(?::\d{2})?))?$", v)
        if m_dt:
            month, day, year, time_part = m_dt.group(1), m_dt.group(2), m_dt.group(3), m_dt.group(4)
            if time_part and time_part != "00:00:00":
                return f"{year}-{int(month):02d}-{int(day):02d} {time_part}"
            return f"{year}-{int(month):02d}-{int(day):02d}"
        if re.match(r"^\d{4}-\d{2}-\d{2}\s+00:00:00$", v):
            return v[:10]
        return v
    return val


def _vals_equal(v1: Any, v2: Any, tol: float = 0.005) -> bool:
    n1 = _normalize_val(v1)
    n2 = _normalize_val(v2)

    if n1 is None and n2 is None:
        return True
    if n1 is None or n2 is None:
        return False

    if isinstance(n1, (int, float)) and isinstance(n2, (int, float)):
        return math.isclose(float(n1), float(n2), abs_tol=tol, rel_tol=tol)

    s1 = str(n1).strip().replace("T", " ")
    s2 = str(n2).strip().replace("T", " ")
    if s1 == s2:
        return True
    c1 = re.sub(r"(\s+00:00(?::00)?)$", "", s1)
    c2 = re.sub(r"(\s+00:00(?::00)?)$", "", s2)
    return c1 == c2


def _row_sort_key(row: Dict[str, Any]) -> str:
    """Canonical sort key for a row — used in unordered (bag) comparisons."""
    sorted_items = sorted(row.items(), key=lambda x: x[0].lower())
    parts = []
    for k, v in sorted_items:
        nv = _normalize_val(v)
        if isinstance(nv, float):
            parts.append(f"{k.lower()}={nv:.4f}")
        else:
            parts.append(f"{k.lower()}={nv}")
    return " | ".join(parts)


def _rows_equal(er: Dict[str, Any], ar: Dict[str, Any],
                exp_cols: Dict[str, str], tol: float) -> Tuple[bool, str]:
    """Check that two (already lowercased) rows are equal column-by-column."""
    for col_lower in exp_cols:
        ev = er.get(col_lower)
        av = ar.get(col_lower)
        if not _vals_equal(ev, av, tol):
            orig_col = exp_cols[col_lower]
            return False, f"column '{orig_col}': expected {ev!r}, got {av!r}"
    return True, ""


# ---------------------------------------------------------------------------
# Partial-order helpers
# ---------------------------------------------------------------------------

def _partial_key(row: Dict[str, Any], key_cols: List[str], tol: float) -> str:
    """Build a stable string key from only the partial-order columns."""
    parts = []
    for col in key_cols:
        nv = _normalize_val(row.get(col))
        if isinstance(nv, float):
            parts.append(f"{col}={nv:.4f}")
        else:
            parts.append(f"{col}={nv}")
    return " | ".join(parts)


def _group_into_tie_groups(
    rows: List[Dict[str, Any]],
    key_cols: List[str],
    tol: float
) -> List[List[Dict[str, Any]]]:
    """
    Partition a list of rows into consecutive groups where all rows in a group
    share the same values for key_cols.
    """
    if not rows:
        return []
    groups: List[List[Dict[str, Any]]] = []
    current_key = _partial_key(rows[0], key_cols, tol)
    current_group = [rows[0]]
    for row in rows[1:]:
        k = _partial_key(row, key_cols, tol)
        if k == current_key:
            current_group.append(row)
        else:
            groups.append(current_group)
            current_group = [row]
            current_key = k
    groups.append(current_group)
    return groups


def _sets_equal(
    group_a: List[Dict[str, Any]],
    group_b: List[Dict[str, Any]],
    exp_cols: Dict[str, str],
    tol: float
) -> Tuple[bool, str]:
    """
    Check that two groups of rows contain exactly the same multiset of rows
    (order-independent within each group).
    """
    if len(group_a) != len(group_b):
        return False, f"tie-group size mismatch: expected {len(group_a)} rows, got {len(group_b)}"

    # Sort both by canonical key and compare positionally
    sa = sorted(group_a, key=_row_sort_key)
    sb = sorted(group_b, key=_row_sort_key)
    for i, (er, ar) in enumerate(zip(sa, sb)):
        ok, detail = _rows_equal(er, ar, exp_cols, tol)
        if not ok:
            return False, f"tie-group row {i + 1} mismatch on {detail}"
    return True, ""


# ---------------------------------------------------------------------------
# Public compare() function
# ---------------------------------------------------------------------------

def compare(
    expected: List[Dict[str, Any]],
    actual: List[Dict[str, Any]],
    order_sensitive: Union[bool, str] = False,
    numeric_tolerance: float = 0.005
) -> Tuple[bool, str]:
    """
    Compares expected result rows with actual result rows.

    Parameters
    ----------
    expected : list of dicts
    actual   : list of dicts
    order_sensitive :
        False / "none"
            Unordered bag comparison — row order in both expected and actual
            is ignored.  A user who omits ORDER BY is not penalised when the
            question does not require ordering.

        True / "full"
            Strict positional match — row N of actual must match row N of
            expected.  Required for questions that explicitly demand a specific
            output ordering with no acceptable ties.

        "partial:<col1>,<col2>,..."
            Hybrid.  The sequence of *tie-groups* (buckets of rows that share
            the same values for the listed columns) must match, but within each
            tie-group the row order is ignored.

            Example: "partial:num_products"
            Correct for "Output users ordered by num_products DESC; break ties
            by user with more spend" — the primary key (num_products) sequence
            must be correct, but within the same num_products bucket the user_id
            order is irrelevant.

    numeric_tolerance : float
        Absolute and relative tolerance for floating-point comparisons.

    Returns
    -------
    (passed: bool, message: str)
    """
    if expected is None:
        expected = []
    if actual is None:
        actual = []

    if len(expected) != len(actual):
        return False, f"Row count mismatch: expected {len(expected)} rows, got {len(actual)} rows."

    if len(expected) == 0:
        return True, "Passed (both empty results)."

    # ------------------------------------------------------------------
    # Normalise column names to lowercase and remap single-column aliases
    # ------------------------------------------------------------------
    exp_cols = {k.lower(): k for k in expected[0].keys()}
    act_cols = {k.lower(): k for k in actual[0].keys()}

    if set(exp_cols.keys()) != set(act_cols.keys()):
        # If output has a single column, allow flexible column alias
        if len(exp_cols) == 1 and len(act_cols) == 1:
            exp_k = list(exp_cols.keys())[0]
            act_k = list(act_cols.keys())[0]
            actual = [{exp_cols[exp_k]: r[act_cols[act_k]]} for r in actual]
            act_cols = exp_cols
        else:
            return False, (
                f"Column mismatch: expected columns {sorted(list(exp_cols.keys()))}, "
                f"got {sorted(list(act_cols.keys()))}."
            )

    # Lowercase all keys once
    norm_exp = [{k.lower(): r[k] for k in r} for r in expected]
    norm_act = [{k.lower(): r[k] for k in r} for r in actual]

    # ------------------------------------------------------------------
    # Parse the order_sensitive parameter
    # ------------------------------------------------------------------
    partial_cols: Optional[List[str]] = None
    mode: str = "none"  # "none" | "full" | "partial"

    if isinstance(order_sensitive, bool):
        mode = "full" if order_sensitive else "none"
    elif isinstance(order_sensitive, str):
        low = order_sensitive.strip().lower()
        if low in ("false", "none", "0", ""):
            mode = "none"
        elif low in ("true", "full", "1"):
            mode = "full"
        elif low.startswith("partial"):
            mode = "partial"
            # Parse columns after the colon, e.g. "partial:num_products,spend"
            rest = low[len("partial"):].lstrip(":").strip()
            if rest:
                partial_cols = [c.strip() for c in rest.split(",") if c.strip()]
            else:
                # No columns specified → fall back to full unordered (same as none)
                mode = "none"
        else:
            mode = "none"

    # ------------------------------------------------------------------
    # MODE: none — unordered bag comparison
    # ------------------------------------------------------------------
    if mode == "none":
        sorted_exp = sorted(norm_exp, key=_row_sort_key)
        sorted_act = sorted(norm_act, key=_row_sort_key)
        for idx, (er, ar) in enumerate(zip(sorted_exp, sorted_act)):
            ok, detail = _rows_equal(er, ar, exp_cols, numeric_tolerance)
            if not ok:
                return False, f"Row {idx + 1} mismatch on {detail}."
        return True, "Passed all row and column checks."

    # ------------------------------------------------------------------
    # MODE: full — exact positional comparison
    # ------------------------------------------------------------------
    if mode == "full":
        for idx, (er, ar) in enumerate(zip(norm_exp, norm_act)):
            ok, detail = _rows_equal(er, ar, exp_cols, numeric_tolerance)
            if not ok:
                return False, f"Row {idx + 1} mismatch on {detail}."
        return True, "Passed all row and column checks."

    # ------------------------------------------------------------------
    # MODE: partial — tie-group aware comparison
    # ------------------------------------------------------------------
    # Validate that partial_cols exist in expected columns
    invalid = [c for c in (partial_cols or []) if c not in exp_cols]
    if invalid:
        # Gracefully fall back to full unordered if column names are wrong
        sorted_exp = sorted(norm_exp, key=_row_sort_key)
        sorted_act = sorted(norm_act, key=_row_sort_key)
        for idx, (er, ar) in enumerate(zip(sorted_exp, sorted_act)):
            ok, detail = _rows_equal(er, ar, exp_cols, numeric_tolerance)
            if not ok:
                return False, f"Row {idx + 1} mismatch on {detail}."
        return True, "Passed all row and column checks (partial columns not found, fell back to unordered)."

    exp_groups = _group_into_tie_groups(norm_exp, partial_cols, numeric_tolerance)
    act_groups = _group_into_tie_groups(norm_act, partial_cols, numeric_tolerance)

    if len(exp_groups) != len(act_groups):
        return False, (
            f"Ordering mismatch: expected {len(exp_groups)} distinct value-groups "
            f"for column(s) {partial_cols}, got {len(act_groups)}."
        )

    for g_idx, (eg, ag) in enumerate(zip(exp_groups, act_groups)):
        ok, detail = _sets_equal(eg, ag, exp_cols, numeric_tolerance)
        if not ok:
            return False, f"Value-group {g_idx + 1} mismatch: {detail}."

    return True, "Passed all row and column checks."
