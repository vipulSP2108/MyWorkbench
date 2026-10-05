"""Quality gates verification script for SQL practice questions."""

import os
import json
import re
from typing import Dict, Any, List

QUESTIONS_DIR = os.path.join(os.path.dirname(__file__), "..", "sql_practice", "questions")

VALID_MYSQL_TYPES = {
    "INT", "BIGINT", "TINYINT", "SMALLINT", "MEDIUMINT",
    "VARCHAR(255)", "TEXT", "MEDIUMTEXT", "LONGTEXT",
    "DECIMAL(10,2)", "FLOAT", "DOUBLE", "BOOLEAN",
    "DATETIME", "DATE", "TIME", "TIMESTAMP"
}

def check_all_quality_gates():
    files = [f for f in os.listdir(QUESTIONS_DIR) if f.endswith(".json")]
    assert len(files) == 100, f"Expected 100 question files, found {len(files)}"
    print(f"Gate 1 (Coverage): 100/100 files present.")

    all_questions = []
    for f in sorted(files):
        with open(os.path.join(QUESTIONS_DIR, f), "r", encoding="utf-8") as fp:
            all_questions.append(json.load(fp))

    # Gate 2: Schema Integrity
    for q in all_questions:
        slug = q["slug"]
        for tbl in q.get("tables", []):
            for col in tbl.get("columns", []):
                dtype = col["data_type"].upper()
                # Accept parameterized DECIMAL/VARCHAR
                base_type = re.sub(r"\(.*\)", "", dtype).strip()
                assert base_type in {
                    "INT", "BIGINT", "TINYINT", "SMALLINT", "VARCHAR", "TEXT",
                    "DECIMAL", "NUMERIC", "FLOAT", "DOUBLE", "BOOLEAN",
                    "DATETIME", "DATE", "TIME", "TIMESTAMP"
                }, f"[{slug}] Invalid MySQL type: {dtype} in column {col['column_name']}"

    print("Gate 2 (Schema Integrity): All data types valid MySQL 8.0 types.")

    # Gate 3: Test-case Quality
    for q in all_questions:
        slug = q["slug"]
        diff = q.get("difficulty", "Easy").capitalize()
        tcs = q.get("test_cases", [])
        min_cases = 4 if diff == "Easy" else (5 if diff == "Medium" else 6)
        assert len(tcs) >= min_cases, f"[{slug}] Expected >= {min_cases} test cases for {diff}, got {len(tcs)}"
        
        has_empty = any(
            len(tc.get("expected_output", [])) == 0 or
            (len(tc.get("expected_output", [])) == 1 and all(v is None or v == 0 for v in tc["expected_output"][0].values()))
            for tc in tcs
        )
        assert has_empty, f"[{slug}] Missing empty-result test case"

    print("Gate 3 (Test-case Quality): All count and edge-case requirements satisfied.")

    # Gate 4: Forbidden Patterns in SQL
    forbidden = ["TOP ", "GETDATE", "::", "DATE_TRUNC", "PERCENTILE_CONT", "STRING_AGG", "GENERATE_SERIES"]
    for q in all_questions:
        slug = q["slug"]
        sql = q.get("reference_sql", "").upper()
        for pat in forbidden:
            assert pat not in sql, f"[{slug}] Forbidden pattern '{pat}' in reference_sql: {sql}"

    print("Gate 4 (Reference SQL Forbidden Patterns): Zero forbidden patterns found.")

    print("\nALL QUALITY GATES PASSED AUTOMATED CHECKS!")

if __name__ == "__main__":
    check_all_quality_gates()
