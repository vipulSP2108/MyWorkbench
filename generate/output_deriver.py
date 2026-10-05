"""Expected output deriver for SQL test cases.

Executes reference MySQL 8.0 queries on generated test cases to derive
the true, mathematically consistent expected output.
"""

from __future__ import annotations
from typing import Dict, Any, List
from ..engine.runner import SQLRunner


def derive_outputs_for_question(
    question: Dict[str, Any],
    reference_sql: str,
    runner: SQLRunner
) -> List[Dict[str, Any]]:
    """Derives expected_output for all test cases of a question."""
    tables = question.get("tables", [])
    test_cases = question.get("test_cases", [])
    slug = question["slug"]
    
    derived_cases = []
    for tc in test_cases:
        tc_copy = dict(tc)
        input_data = tc.get("input_data", {})
        
        res = runner.execute(tables, input_data, reference_sql)
        if not res.success:
            raise RuntimeError(
                f"Failed to derive expected output for '{slug}' on test case '{tc['test_case_id']}': {res.error}"
            )
            
        tc_copy["expected_output"] = res.rows
        derived_cases.append(tc_copy)
        
    return derived_cases
