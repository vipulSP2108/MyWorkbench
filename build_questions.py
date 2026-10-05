"""Builds all 100 question JSON artifacts with schema, sample data, reference SQL, and test cases."""

from __future__ import annotations
import os
import sys
import json
import decimal
from typing import Any

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
WORKBENCH_DIR = os.path.dirname(os.path.abspath(__file__))
for _p in (PROJECT_ROOT, WORKBENCH_DIR):
    if _p not in sys.path:
        sys.path.insert(0, _p)

try:
    from MyWorkbench.ingest.deduplicator import build_unified_questions
    from MyWorkbench.generate.sql_writer import REFERENCE_QUERIES
    from MyWorkbench.generate.data_generator import generate_test_cases_for_question
    from MyWorkbench.generate.output_deriver import derive_outputs_for_question
    from MyWorkbench.engine.runner import SQLRunner
except ImportError:
    from ingest.deduplicator import build_unified_questions
    from generate.sql_writer import REFERENCE_QUERIES
    from generate.data_generator import generate_test_cases_for_question
    from generate.output_deriver import derive_outputs_for_question
    from engine.runner import SQLRunner


import datetime


class DecimalEncoder(json.JSONEncoder):
    """Handles Decimal, date, and datetime serialization for JSON."""
    def default(self, o: Any) -> Any:
        if isinstance(o, decimal.Decimal):
            return float(o)
        if isinstance(o, (datetime.date, datetime.datetime)):
            return o.isoformat()
        return super().default(o)


def is_query_order_sensitive(query: str, question_statement: str) -> bool:
    """Detects whether query or problem strictly requires ordering of final result rows."""
    q_upper = (query or "").upper().strip()
    s_lower = (question_statement or "").lower()
    
    # Must have an outer/final ORDER BY in the query
    lines = [line.strip().upper() for line in q_upper.splitlines() if line.strip()]
    has_final_order = any("ORDER BY" in line for line in lines[-4:])
    if not has_final_order:
        return False
        
    order_phrases = (
        "order the results",
        "sort the results",
        "sorted in",
        "ordered by",
        "order by",
        "descending order",
        "ascending order",
        "descending",
        "ascending",
        "chronological",
        "earliest to latest",
        "latest to earliest",
        "highest to lowest",
        "lowest to highest",
        "top 3",
        "top 2",
        "top 1"
    )
    if any(p in s_lower for p in order_phrases):
        return True
    if "LIMIT " in q_upper:
        return True
    return False


def build_all_questions(output_dir: str = "MyWorkbench/questions") -> int:
    """Builds and writes all 100 question JSONs."""
    os.makedirs(output_dir, exist_ok=True)
    runner = SQLRunner()
    
    questions = build_unified_questions()
    total = len(questions)
    print(f"Building {total} questions into {output_dir}...")
    
    success_count = 0
    for idx, q in enumerate(questions, start=1):
        slug = q["slug"]
        sql = REFERENCE_QUERIES.get(slug, "")
        if not sql:
            print(f"Warning: Missing reference SQL for {slug}")
            continue
            
        q["reference_sql"] = sql.strip()
        q["order_sensitive"] = is_query_order_sensitive(sql, q["question"])
        
        # Generate test cases
        raw_test_cases = generate_test_cases_for_question(q)
        q["test_cases"] = raw_test_cases
        
        # Derive expected output for each test case
        try:
            derived_cases = derive_outputs_for_question(q, sql, runner)
            q["test_cases"] = derived_cases
            # Derive primary expected_output from baseline test case
            q["expected_output"] = derived_cases[0]["expected_output"]
        except Exception as e:
            print(f"Error on {slug}: {e}")
            raise e
            
        out_file = os.path.join(output_dir, f"{slug}.json")
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(q, f, indent=2, cls=DecimalEncoder)
            
        success_count += 1
        if idx % 20 == 0 or idx == total:
            print(f"  Processed {idx}/{total} questions...")
            
    print(f"Successfully generated {success_count}/{total} questions!")
    return success_count


if __name__ == "__main__":
    build_all_questions()
