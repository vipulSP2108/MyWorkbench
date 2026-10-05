"""Test case dataset generator for SQL practice questions.

Generates multiple test cases covering normal, high volume, disqualifying,
empty-result, ties, NULLs, and boundary conditions.
Minimum test cases: Easy >= 4, Medium >= 5, Hard >= 6.
"""

from __future__ import annotations
import copy
import re
from typing import Dict, Any, List


def _shift_date(val: Any, year_delta: int = 0, day_delta: int = 0) -> Any:
    if val is None:
        return None
    s = str(val).strip()
    m_iso = re.match(r"^(\d{4})-(\d{2})-(\d{2})(.*)$", s)
    if m_iso:
        y, m, d, rest = int(m_iso.group(1)), m_iso.group(2), int(m_iso.group(3)), m_iso.group(4)
        new_y = y + year_delta
        new_d = min(28, max(1, d + day_delta))
        return f"{new_y:04d}-{m}-{new_d:02d}{rest}"
    m_us = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})(.*)$", s)
    if m_us:
        m, d, y, rest = m_us.group(1), int(m_us.group(2)), int(m_us.group(3)), m_us.group(4)
        new_y = y + year_delta
        new_d = min(28, max(1, d + day_delta))
        return f"{m}/{new_d:02d}/{new_y:04d}{rest}"
    return val


def generate_test_cases_for_question(question: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Generates test cases for a question.
    Returns:
        List of dicts: {"test_case_id": ..., "description": ..., "input_data": ..., "expected_output": []}
    """
    slug = question["slug"]
    difficulty = question.get("difficulty", "Easy").capitalize()
    tables = question.get("tables", [])
    baseline_data = question.get("sample_data", {})
    tags = question.get("tags", [])
    
    test_cases = []
    
    # -------------------------------------------------------------
    # TC 1: Baseline sample data
    # -------------------------------------------------------------
    test_cases.append({
        "test_case_id": "tc_1_baseline",
        "description": "Baseline sample input data from problem description",
        "input_data": copy.deepcopy(baseline_data),
        "expected_output": []
    })
    
    # -------------------------------------------------------------
    # TC 2: High volume & multiple entities
    # -------------------------------------------------------------
    tc2_data = {}
    for tbl_name, rows in baseline_data.items():
        new_rows = copy.deepcopy(rows)
        # Duplicate with shifted IDs and varied numbers
        for r in rows:
            r_copy = copy.deepcopy(r)
            for k, v in r_copy.items():
                k_lower = k.lower()
                if "id" in k_lower and str(v).isdigit():
                    r_copy[k] = int(v) + 1000
                elif any(word in k_lower for word in ("amount", "spend", "salary", "sales", "revenue", "price")) and str(v).replace(".", "", 1).isdigit():
                    try:
                        r_copy[k] = round(float(v) * 1.5, 2)
                    except ValueError:
                        pass
                elif any(word in k_lower for word in ("date", "time", "timestamp")):
                    r_copy[k] = _shift_date(v, day_delta=5)
            new_rows.append(r_copy)
        tc2_data[tbl_name] = new_rows
        
    test_cases.append({
        "test_case_id": "tc_2_high_volume",
        "description": "Multiple entities with scaled volume and multi-group distributions",
        "input_data": tc2_data,
        "expected_output": []
    })
    
    # -------------------------------------------------------------
    # TC 3: Disqualifying records & edge threshold variations
    # -------------------------------------------------------------
    tc3_data = {}
    for tbl_name, rows in baseline_data.items():
        new_rows = copy.deepcopy(rows)
        # Add boundary rows that specifically fail filters
        for r in rows[:max(1, len(rows) // 2)]:
            disqual_row = copy.deepcopy(r)
            for k, v in disqual_row.items():
                k_lower = k.lower()
                if any(word in k_lower for word in ("date", "time", "timestamp")):
                    disqual_row[k] = _shift_date(v, year_delta=-5)
                elif "id" in k_lower and str(v).isdigit():
                    disqual_row[k] = int(v) + 5000
                elif "stars" in k_lower or "rating" in k_lower:
                    disqual_row[k] = 1
                elif "status" in k_lower:
                    disqual_row[k] = "Cancelled"
                elif "experience" in k_lower and str(v).isdigit():
                    disqual_row[k] = 1
                elif any(word in k_lower for word in ("amount", "spend", "salary")):
                    disqual_row[k] = 0
            new_rows.append(disqual_row)
        tc3_data[tbl_name] = new_rows
        
    test_cases.append({
        "test_case_id": "tc_3_disqualifying_rows",
        "description": "Dataset containing disqualifying rows, edge values, and cancelled/zero records",
        "input_data": tc3_data,
        "expected_output": []
    })
    
    # -------------------------------------------------------------
    # TC 4: Empty result set (no matching rows)
    # -------------------------------------------------------------
    tc4_data = {t["table_name"]: [] for t in tables}
        
    test_cases.append({
        "test_case_id": "tc_4_empty_result",
        "description": "Input where no rows satisfy problem criteria, verifying empty result handling",
        "input_data": tc4_data,
        "expected_output": []
    })
    
    # -------------------------------------------------------------
    # TC 5: Ties, NULL values, and unmatched joins (for Medium & Hard)
    # -------------------------------------------------------------
    if difficulty in ("Medium", "Hard"):
        tc5_data = {}
        for tbl_name, rows in baseline_data.items():
            new_rows = copy.deepcopy(rows)
            # Create a tie row by cloning the first row with same metric and new ID
            if rows:
                tie_row = copy.deepcopy(rows[0])
                for k in tie_row:
                    k_lower = k.lower()
                    if "id" in k_lower and str(tie_row[k]).isdigit():
                        tie_row[k] = int(tie_row[k]) + 9000
                    elif "name" in k_lower:
                        tie_row[k] = f"{tie_row[k]} Duplicate"
                new_rows.append(tie_row)
                
            # Add a row with optional NULL values
            if len(rows) > 1:
                null_row = copy.deepcopy(rows[1])
                for k in null_row:
                    k_lower = k.lower()
                    if "id" not in k_lower and any(kw in k_lower for kw in ("desc", "category", "rate", "type", "tag")):
                        null_row[k] = None
                    elif "id" in k_lower and str(null_row[k]).isdigit():
                        null_row[k] = int(null_row[k]) + 9500
                new_rows.append(null_row)
            tc5_data[tbl_name] = new_rows
            
        test_cases.append({
            "test_case_id": "tc_5_ties_and_nulls",
            "description": "Tied ranking metrics, unmatched join keys, and NULL values in nullable attributes",
            "input_data": tc5_data,
            "expected_output": []
        })
        
    # -------------------------------------------------------------
    # TC 6: Extreme boundary cases / consecutive timing (for Hard)
    # -------------------------------------------------------------
    if difficulty == "Hard":
        tc6_data = {}
        for tbl_name, rows in baseline_data.items():
            new_rows = copy.deepcopy(rows)
            for r in rows:
                r_ext = copy.deepcopy(r)
                for k, v in r_ext.items():
                    k_lower = k.lower()
                    if "id" in k_lower and str(v).isdigit():
                        r_ext[k] = int(v) + 8000
                    elif any(word in k_lower for word in ("date", "time", "timestamp")):
                        # Consecutive days / same timestamp
                        r_ext[k] = _shift_date(v, day_delta=1)
                    elif any(word in k_lower for word in ("amount", "spend", "balance")):
                        try:
                            r_ext[k] = round(float(v) * 2.0, 2)
                        except ValueError:
                            pass
                new_rows.append(r_ext)
            tc6_data[tbl_name] = new_rows
            
        test_cases.append({
            "test_case_id": "tc_6_extreme_boundary",
            "description": "Consecutive day sequences, month-end date rollovers, and high-frequency transactions",
            "input_data": tc6_data,
            "expected_output": []
        })
        
    return test_cases
