"""CLI Reporter for formatting validation results, diffs, and summary tables."""

from __future__ import annotations
from typing import List, Dict, Any, Optional
from tabulate import tabulate


def format_table(rows: List[Dict[str, Any]], max_rows: int = 15) -> str:
    """Formats a list of row dicts into a clean ASCII table."""
    if not rows:
        return "(empty result set)\n"
    headers = list(rows[0].keys())
    data = [[r.get(h) for h in headers] for r in rows[:max_rows]]
    table_str = tabulate(data, headers=headers, tablefmt="github")
    if len(rows) > max_rows:
        table_str += f"\n... ({len(rows) - max_rows} more rows)"
    return table_str + "\n"


def format_test_case_result(
    test_case_id: str,
    description: str,
    passed: bool,
    message: str,
    expected: List[Dict[str, Any]],
    actual: List[Dict[str, Any]],
    error: Optional[str] = None
) -> str:
    """Formats a single test case execution report."""
    status_icon = "✅ PASS" if passed else "❌ FAIL"
    output = [
        f"----------------------------------------------------------------",
        f"Test Case: [{test_case_id}] {description}",
        f"Status:    {status_icon}",
        f"Detail:    {message}"
    ]
    if error:
        output.append(f"Error:     {error}")
        
    if not passed and not error:
        output.append("\n[Expected Output]:")
        output.append(format_table(expected))
        output.append("[Actual Output]:")
        output.append(format_table(actual))
        
    return "\n".join(output)


def format_validation_summary(
    slug: str,
    title: str,
    total_cases: int,
    passed_cases: int,
    results: List[Dict[str, Any]]
) -> str:
    """Formats overall validation summary for a question."""
    status = "ALL PASSED ✅" if passed_cases == total_cases else f"FAILED ❌ ({passed_cases}/{total_cases})"
    lines = [
        f"================================================================",
        f"Question: {title} ({slug})",
        f"Summary:  {status} ({passed_cases}/{total_cases} test cases)",
        f"================================================================"
    ]
    for r in results:
        lines.append(
            f"  [{'PASS' if r['passed'] else 'FAIL'}] {r['test_case_id']}: {r['description']}"
        )
    return "\n".join(lines)
