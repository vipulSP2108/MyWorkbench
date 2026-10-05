#!/usr/bin/env python3
"""Centralized Pipeline for SQLMaster / MyWorkbench Questions.

Single source of truth pipeline:
- Central master file: `data/questions_master.json` (or root `questions_master.json`)
- Modify, add, or delete any question in the centralized JSON.
- Run `python3 pipeline.py` (or `python3 MyWorkbench/scripts/sync_pipeline.py`)
- Automatically bifurcates and synchronizes all changes across:
  1. `MyWorkbench/questions/{slug}.json` (active runtime JSON files)
  2. `data/sql_master.json` (question catalog & metadata)
  3. `MyWorkbench/generate/sql_writer.py` (REFERENCE_QUERIES dictionary)
  4. `MyWorkbench/scripts/audit_summary.json` (audit matrix & order sensitivity)
  5. `data/content/{slug}.json` (ingestion content blocks)
- Auto-derives test case expected outputs via `--derive-outputs` using DuckDB runner.
- Validates queries against test cases with detailed diagnostics.
"""

from __future__ import annotations
import os
import sys
import json
import decimal
import datetime
import re
import argparse
from typing import Dict, Any, List, Optional, Tuple, Set

# Ensure project root is in sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from MyWorkbench.engine.runner import SQLRunner
from MyWorkbench.engine.comparator import compare


MASTER_JSON_DATA_PATH = os.path.join(PROJECT_ROOT, "data", "questions_master.json")
MASTER_JSON_ROOT_PATH = os.path.join(PROJECT_ROOT, "questions_master.json")
QUESTIONS_DIR = os.path.join(PROJECT_ROOT, "MyWorkbench", "questions")
SQL_MASTER_PATH = os.path.join(PROJECT_ROOT, "data", "sql_master.json")
SQL_WRITER_PATH = os.path.join(PROJECT_ROOT, "MyWorkbench", "generate", "sql_writer.py")
AUDIT_SUMMARY_PATH = os.path.join(PROJECT_ROOT, "MyWorkbench", "scripts", "audit_summary.json")
CONTENT_DIR = os.path.join(PROJECT_ROOT, "data", "content")


class DecimalEncoder(json.JSONEncoder):
    """Encodes Decimals, dates, and datetimes cleanly."""
    def default(self, o: Any) -> Any:
        if isinstance(o, decimal.Decimal):
            if o % 1 == 0:
                return int(o)
            return float(o)
        if isinstance(o, (datetime.date, datetime.datetime)):
            return o.isoformat()
        return super().default(o)


def get_master_json_path() -> str:
    """Finds the master JSON path, favoring data/questions_master.json."""
    if os.path.exists(MASTER_JSON_DATA_PATH):
        return MASTER_JSON_DATA_PATH
    if os.path.exists(MASTER_JSON_ROOT_PATH):
        return MASTER_JSON_ROOT_PATH
    return MASTER_JSON_DATA_PATH


def is_query_order_sensitive(query: str, question_statement: str) -> bool:
    """Detects if query requires ordered output."""
    q_upper = (query or "").upper().strip()
    s_lower = (question_statement or "").lower()
    lines = [line.strip().upper() for line in q_upper.splitlines() if line.strip()]
    has_final_order = any("ORDER BY" in line for line in lines[-4:])
    if not has_final_order:
        return False
    order_phrases = (
        "order the results", "sort the results", "sorted in", "ordered by",
        "order by", "descending order", "ascending order", "descending",
        "ascending", "chronological", "earliest to latest", "latest to earliest",
        "highest to lowest", "lowest to highest", "top 3", "top 2", "top 1"
    )
    if any(p in s_lower for p in order_phrases):
        return True
    if "LIMIT " in q_upper:
        return True
    return False


def load_master_questions(filepath: Optional[str] = None) -> List[Dict[str, Any]]:
    """Loads questions from the centralized master JSON file."""
    path = filepath or get_master_json_path()
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"Centralized master JSON not found at {path}. Run with `--export` first to initialize."
        )
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, list):
        return data
    if isinstance(data, dict) and "questions" in data:
        return data["questions"]
    raise ValueError(f"Invalid format in {path}: expected a JSON array or object with 'questions' list.")


def save_master_questions(questions: List[Dict[str, Any]], filepath: Optional[str] = None) -> None:
    """Saves questions array into centralized master JSON file."""
    path = filepath or MASTER_JSON_DATA_PATH
    os.makedirs(os.path.dirname(path), exist_ok=True)
    payload = {
        "version": 1,
        "description": "Centralized single source of truth for SQLMaster / MyWorkbench practice questions. Modify, add, or delete questions here and run `python3 pipeline.py` to synchronize everywhere.",
        "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "total_questions": len(questions),
        "questions": questions
    }
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, cls=DecimalEncoder)

    # Maintain root symlink or copy for convenience
    root_path = MASTER_JSON_ROOT_PATH
    if root_path != path:
        try:
            if os.path.islink(root_path) or os.path.exists(root_path):
                os.remove(root_path)
            # Create relative symlink
            rel_target = os.path.relpath(path, os.path.dirname(root_path))
            os.symlink(rel_target, root_path)
        except Exception:
            # Fallback to file copy if symlink fails (e.g. windows/permissions)
            with open(root_path, "w", encoding="utf-8") as f:
                json.dump(payload, f, indent=2, cls=DecimalEncoder)


def export_from_existing_questions() -> int:
    """Compiles all existing 100 questions from MyWorkbench/questions into data/questions_master.json."""
    if not os.path.exists(QUESTIONS_DIR):
        print(f"Error: {QUESTIONS_DIR} does not exist.")
        return 0

    # Read canonical order from sql_master.json if available
    order_slugs = []
    if os.path.exists(SQL_MASTER_PATH):
        with open(SQL_MASTER_PATH, "r", encoding="utf-8") as f:
            meta = json.load(f)
            order_slugs = [item["slug"] for item in meta if "slug" in item]

    questions_by_slug = {}
    for fname in os.listdir(QUESTIONS_DIR):
        if fname.endswith(".json"):
            fpath = os.path.join(QUESTIONS_DIR, fname)
            with open(fpath, "r", encoding="utf-8") as f:
                q = json.load(f)
                slug = q.get("slug") or os.path.splitext(fname)[0]
                questions_by_slug[slug] = q

    ordered_questions = []
    seen = set()
    for slug in order_slugs:
        if slug in questions_by_slug:
            ordered_questions.append(questions_by_slug[slug])
            seen.add(slug)

    for slug, q in sorted(questions_by_slug.items()):
        if slug not in seen:
            ordered_questions.append(q)

    save_master_questions(ordered_questions)
    print(f"✅ Exported {len(ordered_questions)} questions into {MASTER_JSON_DATA_PATH}")
    return len(ordered_questions)


def compute_audit_summary(questions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Builds audit summary metadata matching scripts/audit_summary.json."""
    audit_list = []
    for idx, q in enumerate(questions, start=1):
        slug = q.get("slug", "")
        tcs = q.get("test_cases", [])
        n_c = sum(1 for tc in tcs if any(k in tc.get("category", "").lower() for k in ("norm", "base")))
        e_c = sum(1 for tc in tcs if any(k in tc.get("category", "").lower() for k in ("edge", "disqual", "empty")))
        b_c = sum(1 for tc in tcs if any(k in tc.get("category", "").lower() for k in ("bound", "tie", "null")))
        v_c = sum(1 for tc in tcs if any(k in tc.get("category", "").lower() for k in ("vol", "scale", "high")))
        assigned = n_c + e_c + b_c + v_c
        if assigned < len(tcs):
            n_c += len(tcs) - assigned

        order_sens = "✓ True" if q.get("order_sensitive") else "False"
        audit_list.append({
            "num": idx,
            "title": q.get("title", slug),
            "company": q.get("company", "General"),
            "diff": q.get("difficulty", "Medium"),
            "slug": slug,
            "tc_count": len(tcs),
            "cats": f"{n_c}N, {e_c}E, {b_c}B, {v_c}V",
            "order_sensitive": order_sens,
            "match_type": q.get("match_type", "EXACT")
        })
    return audit_list


def generate_sql_writer_code(questions: List[Dict[str, Any]]) -> str:
    """Generates clean Python code for MyWorkbench/generate/sql_writer.py."""
    lines = [
        '"""MySQL 8.0 Reference SQL queries for all practice questions.',
        '',
        'Every query strictly adheres to MySQL 8.0 syntax rules:',
        '- No PostgreSQL cast operators (::type)',
        '- No DATE_TRUNC, STRING_AGG, or PERCENTILE_CONT',
        '- Standard MySQL date, math, string, and window functions',
        '"""',
        '',
        'from __future__ import annotations',
        'from typing import Dict',
        '',
        '',
        'REFERENCE_QUERIES: Dict[str, str] = {'
    ]

    for idx, q in enumerate(questions, start=1):
        slug = q.get("slug", "")
        title = q.get("title", slug)
        comp = q.get("company", "General")
        diff = q.get("difficulty", "Medium")
        sql = (q.get("reference_sql") or "-- Solution pending.").strip()
        safe_sql = sql.replace('"""', '\\"\\"\\"')
        lines.append(f'    # {idx}. {title} ({comp}, {diff})')
        lines.append(f'    "{slug}": """\n{safe_sql}\n""",\n')

    lines.append('}\n')
    return "\n".join(lines)


def derive_question_outputs(q: Dict[str, Any], runner: SQLRunner) -> bool:
    """Executes reference_sql on testcase inputs to compute exact expected_outputs."""
    sql = q.get("reference_sql", "").strip()
    if not sql:
        return False
    tables = q.get("tables", [])
    test_cases = q.get("test_cases", [])
    if not test_cases:
        return False

    slug = q.get("slug", "unknown")
    modified = False
    for tc in test_cases:
        input_data = tc.get("input_data", {})
        res = runner.execute(tables, input_data, sql)
        if not res.success:
            print(f"❌ Error deriving output for '{slug}' [{tc.get('test_case_id')}]: {res.error}")
            return False
        tc["expected_output"] = res.rows
        modified = True

    # Primary expected_output from first baseline test case
    if test_cases and "expected_output" in test_cases[0]:
        q["expected_output"] = test_cases[0]["expected_output"]

    return modified


def validate_question(q: Dict[str, Any], runner: SQLRunner) -> Tuple[bool, str]:
    """Validates question reference_sql against its test cases."""
    slug = q.get("slug", "unknown")
    sql = q.get("reference_sql", "").strip()
    if not sql:
        return False, "Missing reference_sql"

    tables = q.get("tables", [])
    test_cases = q.get("test_cases", [])
    if not test_cases:
        return False, "No test cases defined"

    order_sensitive = q.get("order_sensitive", False)

    for tc in test_cases:
        tcid = tc.get("test_case_id", "unnamed")
        input_data = tc.get("input_data", {})
        expected = tc.get("expected_output", [])

        res = runner.execute(tables, input_data, sql)
        if not res.success:
            return False, f"Execution failed on '{tcid}': {res.error}"

        passed, detail = compare(res.rows, expected, order_sensitive=order_sensitive)
        if not passed:
            return False, f"Mismatch on '{tcid}': {detail}"

    return True, f"All {len(test_cases)} test cases passed"


def sync_pipeline(
    derive_outputs: bool = False,
    target_slug: Optional[str] = None,
    validate_all: bool = False,
    dry_run: bool = False
) -> bool:
    """Main synchronization pipeline: bifurcates master JSON to all files."""
    master_path = get_master_json_path()
    if not os.path.exists(master_path):
        print(f"Master JSON not found at {master_path}. Initializing with --export...")
        export_from_existing_questions()

    master_questions = load_master_questions(master_path)
    total_master = len(master_questions)
    print(f"\n🚀 Running SQLMaster Centralized Pipeline (Source: {os.path.relpath(master_path, PROJECT_ROOT)})")
    print(f"Loaded {total_master} questions from master JSON.")

    runner = SQLRunner()
    os.makedirs(QUESTIONS_DIR, exist_ok=True)
    os.makedirs(CONTENT_DIR, exist_ok=True)

    # Read current existing questions in MyWorkbench/questions
    existing_files = {f: os.path.join(QUESTIONS_DIR, f) for f in os.listdir(QUESTIONS_DIR) if f.endswith(".json")}
    existing_slugs = {os.path.splitext(f)[0] for f in existing_files.keys()}

    master_slugs = {q.get("slug") for q in master_questions if q.get("slug")}

    added_slugs = master_slugs - existing_slugs
    deleted_slugs = existing_slugs - master_slugs
    kept_slugs = master_slugs & existing_slugs

    modified_slugs = set()
    # Detect modifications
    for q in master_questions:
        slug = q.get("slug")
        if not slug or slug not in kept_slugs:
            continue
        existing_path = os.path.join(QUESTIONS_DIR, f"{slug}.json")
        try:
            with open(existing_path, "r", encoding="utf-8") as f:
                old_q = json.load(f)
            # Compare key attributes
            keys_to_compare = ("title", "difficulty", "company", "question", "notes", "tables", "reference_sql", "order_sensitive", "test_cases")
            for k in keys_to_compare:
                if q.get(k) != old_q.get(k):
                    modified_slugs.add(slug)
                    break
        except Exception:
            modified_slugs.add(slug)

    print("\n📊 Change Detection Analysis:")
    print(f"  • Unchanged: {len(kept_slugs - modified_slugs)}")
    print(f"  • Modified:  {len(modified_slugs)} ({', '.join(sorted(list(modified_slugs))[:5])}{'...' if len(modified_slugs) > 5 else ''})")
    print(f"  • Added:     {len(added_slugs)} ({', '.join(sorted(list(added_slugs))) or 'None'})")
    print(f"  • Deleted:   {len(deleted_slugs)} ({', '.join(sorted(list(deleted_slugs))) or 'None'})")

    if dry_run:
        print("\n🔍 Dry run mode: No files modified.")
        return True

    # 1. Handle Deletions
    if deleted_slugs:
        print(f"\n🗑️  Removing {len(deleted_slugs)} deleted question artifacts...")
        for dslug in deleted_slugs:
            dpath = os.path.join(QUESTIONS_DIR, f"{dslug}.json")
            if os.path.exists(dpath):
                os.remove(dpath)
                print(f"  Deleted: {os.path.relpath(dpath, PROJECT_ROOT)}")
            cpath = os.path.join(CONTENT_DIR, f"{dslug}.json")
            if os.path.exists(cpath):
                os.remove(cpath)

    # 2. Derive Outputs if requested or for new questions
    questions_to_sync = master_questions
    if target_slug:
        questions_to_sync = [q for q in master_questions if q.get("slug") == target_slug]
        if not questions_to_sync:
            print(f"❌ Error: Slug '{target_slug}' not found in master JSON.")
            return False

    synced_count = 0
    validation_failures = []
    validation_successes = []

    print("\n⚡ Bifurcating to question files & validating...")
    for idx, q in enumerate(master_questions, start=1):
        slug = q.get("slug")
        if not slug:
            continue

        if target_slug and slug != target_slug:
            continue

        # Ensure question_id
        if not q.get("question_id"):
            q["question_id"] = f"q_{idx:03d}_{slug.replace('-', '_')}"

        # Ensure order_sensitive auto-detection if not specified
        if "order_sensitive" not in q:
            q["order_sensitive"] = is_query_order_sensitive(q.get("reference_sql", ""), q.get("question", ""))

        # Derive outputs if requested or if new
        should_derive = derive_outputs or (slug in added_slugs)
        if should_derive:
            derived = derive_question_outputs(q, runner)
            if derived:
                print(f"  ✨ Auto-derived expected outputs for '{slug}'")

        # Write question file
        q_path = os.path.join(QUESTIONS_DIR, f"{slug}.json")
        with open(q_path, "w", encoding="utf-8") as f:
            json.dump(q, f, indent=2, cls=DecimalEncoder)

        # Write content JSON
        c_path = os.path.join(CONTENT_DIR, f"{slug}.json")
        if not os.path.exists(c_path):
            content_payload = {
                "question": q.get("question", ""),
                "tables": q.get("tables", []),
                "sample_data": q.get("sample_data", {}),
                "notes": q.get("notes", [])
            }
            with open(c_path, "w", encoding="utf-8") as f:
                json.dump(content_payload, f, indent=2, cls=DecimalEncoder)

        # Validation (for modified, added, or if validate_all is true)
        should_validate = validate_all or (slug in modified_slugs) or (slug in added_slugs) or (target_slug == slug)
        if should_validate:
            passed, msg = validate_question(q, runner)
            if passed:
                validation_successes.append((slug, msg))
            else:
                validation_failures.append((slug, msg))

        synced_count += 1

    # Save updated master questions back (in case auto-derived outputs or order_sensitive changed)
    if derive_outputs:
        save_master_questions(master_questions, master_path)

    # 3. Synchronize data/sql_master.json
    sql_master_data = []
    for q in master_questions:
        sql_master_data.append({
            "slug": q.get("slug"),
            "title": q.get("title"),
            "company": q.get("company", "General"),
            "difficulty": q.get("difficulty", "Medium"),
            "premium": q.get("premium", False),
            "category": q.get("category", "SQL")
        })
    with open(SQL_MASTER_PATH, "w", encoding="utf-8") as f:
        json.dump(sql_master_data, f, indent=4)
    print(f"✓ Synchronized {SQL_MASTER_PATH} ({len(sql_master_data)} questions)")

    # 4. Synchronize MyWorkbench/generate/sql_writer.py
    sql_writer_code = generate_sql_writer_code(master_questions)
    with open(SQL_WRITER_PATH, "w", encoding="utf-8") as f:
        f.write(sql_writer_code)
    print(f"✓ Synchronized {SQL_WRITER_PATH} ({len(master_questions)} reference queries)")

    # 5. Synchronize MyWorkbench/scripts/audit_summary.json
    audit_summary_data = compute_audit_summary(master_questions)
    with open(AUDIT_SUMMARY_PATH, "w", encoding="utf-8") as f:
        json.dump(audit_summary_data, f, indent=2)
    print(f"✓ Synchronized {AUDIT_SUMMARY_PATH} ({len(audit_summary_data)} entries)")

    # Summary
    print("\n" + "=" * 65)
    print("🎉 SQLMaster Centralized Pipeline Complete!")
    print("=" * 65)
    print(f"Questions Processed: {synced_count}")
    print(f"Total in Master:     {len(master_questions)}")

    if validation_successes:
        print(f"\n✅ Validation Succeeded ({len(validation_successes)} questions):")
        for s, msg in validation_successes[:10]:
            print(f"   ✓ {s}: {msg}")
        if len(validation_successes) > 10:
            print(f"   ... and {len(validation_successes) - 10} more.")

    if validation_failures:
        print(f"\n⚠️  Validation Failures ({len(validation_failures)} questions):")
        for s, err in validation_failures:
            print(f"   ❌ {s}: {err}")
        print("\nTip: If query was changed, run `python3 pipeline.py --derive-outputs` to recompute expected test results.")
        return False

    print("\nAll target files are in 100% lockstep with the centralized master JSON.")
    return True


def main():
    parser = argparse.ArgumentParser(
        description="Centralized pipeline for adding, deleting, and modifying SQLMaster questions."
    )
    parser.add_argument(
        "--sync", action="store_true", default=True,
        help="Synchronize changes from centralized master JSON to all other files (default action)."
    )
    parser.add_argument(
        "--derive-outputs", "-d", action="store_true",
        help="Recompute test case expected outputs using reference_sql on input datasets."
    )
    parser.add_argument(
        "--slug", type=str, default=None,
        help="Target a single question slug for sync and validation."
    )
    parser.add_argument(
        "--validate-all", "-v", action="store_true",
        help="Validate all questions against their test cases."
    )
    parser.add_argument(
        "--export", action="store_true",
        help="Export all existing questions from MyWorkbench/questions/ into questions_master.json."
    )
    parser.add_argument(
        "--status", action="store_true",
        help="Show diffs between master JSON and questions files without modifying files."
    )

    args = parser.parse_args()

    if args.export:
        export_from_existing_questions()
        sys.exit(0)

    if args.status:
        sync_pipeline(dry_run=True)
        sys.exit(0)

    success = sync_pipeline(
        derive_outputs=args.derive_outputs,
        target_slug=args.slug,
        validate_all=args.validate_all
    )
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
