"""Result set comparator for SQL practice queries."""

from __future__ import annotations
import math
import decimal
from typing import List, Dict, Any, Tuple, Optional


import datetime
import re

def _normalize_val(val: Any) -> Any:
    if val is None or val == "NULL" or val == "None" or val == "":
        return None
    if isinstance(val, decimal.Decimal):
        f = float(val)
        return 0.0 if math.isclose(f, 0.0, abs_tol=1e-9) else f
    if isinstance(val, (int, float)):
        # Normalize -0.0 to 0.0
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
    # Sort keys alphabetically and format values
    sorted_items = sorted(row.items(), key=lambda x: x[0].lower())
    parts = []
    for k, v in sorted_items:
        nv = _normalize_val(v)
        if isinstance(nv, float):
            parts.append(f"{k.lower()}={nv:.4f}")
        else:
            parts.append(f"{k.lower()}={nv}")
    return " | ".join(parts)


def compare(
    expected: List[Dict[str, Any]],
    actual: List[Dict[str, Any]],
    order_sensitive: bool = False,
    numeric_tolerance: float = 0.005
) -> Tuple[bool, str]:
    """
    Compares expected result rows with actual result rows.
    
    Returns:
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
        
    # Check columns match (case-insensitive)
    exp_cols = {k.lower(): k for k in expected[0].keys()}
    act_cols = {k.lower(): k for k in actual[0].keys()}
    
    if set(exp_cols.keys()) != set(act_cols.keys()):
        # If output has a single column (e.g. aggregate count), allow flexible column alias
        if len(exp_cols) == 1 and len(act_cols) == 1:
            exp_k = list(exp_cols.keys())[0]
            act_k = list(act_cols.keys())[0]
            actual = [{exp_cols[exp_k]: r[act_cols[act_k]] for _ in [0]} for r in actual]
            act_cols = exp_cols
        else:
            return False, f"Column mismatch: expected columns {sorted(list(exp_cols.keys()))}, got {sorted(list(act_cols.keys()))}."
        
    norm_exp = []
    for r in expected:
        norm_exp.append({k.lower(): r[k] for k in r})
        
    norm_act = []
    for r in actual:
        norm_act.append({k.lower(): r[k] for k in r})
        
    if not order_sensitive:
        norm_exp = sorted(norm_exp, key=_row_sort_key)
        norm_act = sorted(norm_act, key=_row_sort_key)
        
    for idx, (er, ar) in enumerate(zip(norm_exp, norm_act)):
        for col_lower in exp_cols:
            ev = er.get(col_lower)
            av = ar.get(col_lower)
            if not _vals_equal(ev, av, numeric_tolerance):
                orig_col = exp_cols[col_lower]
                return False, f"Row {idx + 1} mismatch on column '{orig_col}': expected {ev!r}, got {av!r}."
                
    return True, "Passed all row and column checks."
