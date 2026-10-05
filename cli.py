"""Command Line Interface for the SQL Practice System.

Provides commands to browse questions, inspect schemas, submit SQL solutions,
and validate test cases against MySQL 8.0 standards.
"""

from __future__ import annotations
import os
import sys
import json
import argparse
from typing import List, Dict, Any, Optional
from tabulate import tabulate
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
WORKBENCH_DIR = os.path.dirname(os.path.abspath(__file__))
for _p in (PROJECT_ROOT, WORKBENCH_DIR):
    if _p not in sys.path:
        sys.path.insert(0, _p)

try:
    from MyWorkbench.engine.runner import SQLRunner
    from MyWorkbench.engine.comparator import compare
    from MyWorkbench.engine.reporter import (
        format_table,
        format_test_case_result,
        format_validation_summary
    )
    from MyWorkbench.build_questions import build_all_questions
except ImportError:
    from engine.runner import SQLRunner
    from engine.comparator import compare
    from engine.reporter import (
        format_table,
        format_test_case_result,
        format_validation_summary
    )
    from build_questions import build_all_questions


QUESTIONS_DIR = os.path.join(os.path.dirname(__file__), "questions")


def load_question(slug_or_id: str) -> Optional[Dict[str, Any]]:
    """Loads a question JSON file by slug or question_id."""
    filepath = os.path.join(QUESTIONS_DIR, f"{slug_or_id}.json")
    if os.path.exists(filepath):
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    for q in load_all_questions():
        if q.get("question_id") == slug_or_id or q.get("slug") == slug_or_id:
            return q
    return None


def load_all_questions() -> List[Dict[str, Any]]:
    """Loads all 100 question JSON files."""
    questions = []
    if not os.path.exists(QUESTIONS_DIR):
        return questions
    for fname in sorted(os.listdir(QUESTIONS_DIR)):
        if fname.endswith(".json"):
            with open(os.path.join(QUESTIONS_DIR, fname), "r", encoding="utf-8") as f:
                questions.append(json.load(f))
    return questions


def cmd_list(args: argparse.Namespace) -> int:
    """Lists available SQL questions."""
    questions = load_all_questions()
    if not questions:
        print("No questions found. Run 'python -m sql_practice.cli rebuild' first.")
        return 1
        
    filtered = []
    for q in questions:
        if args.difficulty and q.get("difficulty", "").lower() != args.difficulty.lower():
            continue
        if args.tag and args.tag.lower() not in [t.lower() for t in q.get("tags", [])]:
            continue
        filtered.append(q)
        
    table_data = []
    for idx, q in enumerate(filtered, start=1):
        tags_str = ", ".join(q.get("tags", [])[:3])
        tc_count = len(q.get("test_cases", []))
        table_data.append([
            idx,
            q.get("slug"),
            q.get("title")[:30],
            q.get("company", "-"),
            q.get("difficulty", "Easy"),
            tc_count,
            tags_str
        ])
        
    print(tabulate(
        table_data,
        headers=["#", "Slug", "Title", "Company", "Difficulty", "Tests", "Top Tags"],
        tablefmt="github"
    ))
    print(f"\nShowing {len(filtered)} of {len(questions)} total questions.")
    return 0


def cmd_show(args: argparse.Namespace) -> int:
    """Shows details for a single question."""
    q = load_question(args.slug)
    if not q:
        print(f"Error: Question '{args.slug}' not found.")
        return 1
        
    print("=" * 70)
    print(f"[{q.get('difficulty', '').upper()}] {q.get('title')} ({q.get('company', '')})")
    print(f"Slug: {q.get('slug')}")
    print(f"Tags: {', '.join(q.get('tags', []))}")
    print("=" * 70)
    print("\n[PROBLEM STATEMENT]:")
    print(q.get("question", ""))
    
    if q.get("notes"):
        print("\n[NOTES]:")
        for n in q["notes"]:
            print(f" - {n}")
            
    print("\n[REQUIRED SCHEMAS]:")
    for tbl in q.get("tables", []):
        tname = tbl["table_name"]
        print(f"\nTable: {tname}")
        col_rows = [[c["column_name"], c["data_type"]] for c in tbl.get("columns", [])]
        print(tabulate(col_rows, headers=["Column Name", "MySQL Data Type"], tablefmt="github"))
        
    print("\n[SAMPLE INPUT DATA]:")
    for tname, rows in q.get("sample_data", {}).items():
        print(f"\nTable: {tname}")
        print(format_table(rows, max_rows=5))
        
    print("[EXPECTED OUTPUT (Baseline)]:")
    print(format_table(q.get("expected_output", []), max_rows=5))
    
    print(f"Total Test Cases Available: {len(q.get('test_cases', []))}")
    return 0


def cmd_run(args: argparse.Namespace) -> int:
    """Executes a SQL query against test cases for a question."""
    q = load_question(args.slug)
    if not q:
        print(f"Error: Question '{args.slug}' not found.")
        return 1
        
    sql = args.sql
    if args.file:
        if not os.path.exists(args.file):
            print(f"Error: File '{args.file}' not found.")
            return 1
        with open(args.file, "r", encoding="utf-8") as f:
            sql = f.read()
            
    if not sql or not sql.strip():
        print("Error: No SQL query provided. Use --sql or --file.")
        return 1
        
    runner = SQLRunner()
    tables = q.get("tables", [])
    test_cases = q.get("test_cases", [])
    order_sensitive = q.get("order_sensitive", False)
    
    print(f"Validating query for '{q['slug']}' against {len(test_cases)} test cases...\n")
    
    results = []
    all_passed = True
    
    for tc in test_cases:
        tc_id = tc["test_case_id"]
        desc = tc["description"]
        input_data = tc["input_data"]
        expected = tc["expected_output"]
        
        exec_res = runner.execute(tables, input_data, sql)
        if not exec_res.success:
            all_passed = False
            results.append({
                "test_case_id": tc_id,
                "description": desc,
                "passed": False,
                "message": "Execution error",
                "error": exec_res.error
            })
            print(format_test_case_result(tc_id, desc, False, "SQL execution failed", expected, [], exec_res.error))
            continue
            
        passed, msg = compare(expected, exec_res.rows, order_sensitive=order_sensitive)
        if not passed:
            all_passed = False
            
        results.append({
            "test_case_id": tc_id,
            "description": desc,
            "passed": passed,
            "message": msg,
            "error": None
        })
        print(format_test_case_result(tc_id, desc, passed, msg, expected, exec_res.rows))
        
    passed_count = sum(1 for r in results if r["passed"])
    print("\n" + format_validation_summary(q["slug"], q["title"], len(test_cases), passed_count, results))
    return 0 if all_passed else 1


def cmd_validate(args: argparse.Namespace) -> int:
    """Validates the reference SQL solution for a question."""
    q = load_question(args.slug)
    if not q:
        print(f"Error: Question '{args.slug}' not found.")
        return 1
    args.sql = q.get("reference_sql", "")
    args.file = None
    return cmd_run(args)


def cmd_validate_all(args: argparse.Namespace) -> int:
    """Validates all 100 questions against all test cases."""
    questions = load_all_questions()
    if not questions:
        print("No questions found.")
        return 1
        
    runner = SQLRunner()
    total_q = len(questions)
    passed_q = 0
    failed_slugs = []
    
    print(f"Running validation across all {total_q} questions in MySQL 8.0 engine...\n")
    
    for idx, q in enumerate(questions, start=1):
        slug = q["slug"]
        sql = q.get("reference_sql", "")
        tables = q.get("tables", [])
        test_cases = q.get("test_cases", [])
        order_sensitive = q.get("order_sensitive", False)
        
        q_passed = True
        for tc in test_cases:
            res = runner.execute(tables, tc["input_data"], sql)
            if not res.success:
                q_passed = False
                break
            matched, _ = compare(tc["expected_output"], res.rows, order_sensitive=order_sensitive)
            if not matched:
                q_passed = False
                break
                
        if q_passed:
            passed_q += 1
            print(f"  [{idx:03d}/{total_q}] ✅ PASS: {slug}")
        else:
            failed_slugs.append(slug)
            print(f"  [{idx:03d}/{total_q}] ❌ FAIL: {slug}")
            
    print("\n" + "=" * 60)
    print(f"Validation Finished: {passed_q}/{total_q} questions passed ({(passed_q/total_q)*100:.1f}%)")
    print("=" * 60)
    
    if failed_slugs:
        print("Failed questions:", failed_slugs)
        return 1
    return 0


def cmd_stats(args: argparse.Namespace) -> int:
    """Prints question bank statistics."""
    questions = load_all_questions()
    total = len(questions)
    if total == 0:
        print("No questions found.")
        return 1
        
    diff_counts = {"Easy": 0, "Medium": 0, "Hard": 0}
    total_tc = 0
    all_tags = set()
    companies = set()
    
    for q in questions:
        d = q.get("difficulty", "Easy").capitalize()
        diff_counts[d] = diff_counts.get(d, 0) + 1
        total_tc += len(q.get("test_cases", []))
        all_tags.update(q.get("tags", []))
        if q.get("company"):
            companies.add(q["company"])
            
    print("==================================================")
    print(" SQL Practice Question System — Dataset Statistics")
    print("==================================================")
    print(f"Total Questions:         {total}")
    print(f"Total Test Cases:        {total_tc} (avg {total_tc/total:.1f} per question)")
    print(f"Difficulty Distribution:")
    for d, cnt in diff_counts.items():
        print(f"  - {d:8}: {cnt:3d} ({cnt/total*100:.1f}%)")
    print(f"Unique Companies:        {len(companies)}")
    print(f"Unique Tags:             {len(all_tags)}")
    print(f"Target SQL Dialect:      MySQL 8.0")
    print("==================================================")
    return 0


def cmd_rebuild(args: argparse.Namespace) -> int:
    """Rebuilds all question artifacts from raw data sources."""
    count = build_all_questions(QUESTIONS_DIR)
    print(f"Rebuild completed: {count} questions written to {QUESTIONS_DIR}.")
    return 0


def cmd_serve(args: argparse.Namespace) -> int:
    """Launches the interactive local web practice platform."""
    try:
        from MyWorkbench.web.server import run_server
    except ImportError:
        from web.server import run_server
    run_server(port=args.port, host=args.host)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="SQL Practice Question System — MySQL 8.0 Interview Question Bank",
        prog="MyWorkbench"
    )
    subparsers = parser.add_subparsers(dest="command", help="Available commands")
    
    # list
    p_list = subparsers.add_parser("list", help="List SQL questions")
    p_list.add_argument("--difficulty", "-d", choices=["easy", "medium", "hard"], help="Filter by difficulty")
    p_list.add_argument("--tag", "-t", help="Filter by tag")
    
    # show
    p_show = subparsers.add_parser("show", help="Show question details, schema, and sample data")
    p_show.add_argument("slug", help="Question slug")
    
    # run
    p_run = subparsers.add_parser("run", help="Run and validate a SQL query against test cases")
    p_run.add_argument("slug", help="Question slug")
    p_run.add_argument("--sql", "-s", help="SQL query string to validate")
    p_run.add_argument("--file", "-f", help="Path to SQL file")
    
    # validate
    p_val = subparsers.add_parser("validate", help="Validate a question's reference solution")
    p_val.add_argument("slug", help="Question slug")
    
    # validate-all
    subparsers.add_parser("validate-all", help="Validate all 100 questions against all test cases")
    
    # stats
    subparsers.add_parser("stats", help="Display dataset statistics")
    
    # rebuild
    subparsers.add_parser("rebuild", help="Rebuild questions from raw data")

    # serve / web
    p_serve = subparsers.add_parser("serve", help="Launch interactive web practice platform")
    p_serve.add_argument("--port", "-p", type=int, default=8080, help="Port to listen on (default 8080)")
    p_serve.add_argument("--host", default="127.0.0.1", help="Host address (default 127.0.0.1)")

    p_web = subparsers.add_parser("web", help="Alias for serve")
    p_web.add_argument("--port", "-p", type=int, default=8080, help="Port to listen on (default 8080)")
    p_web.add_argument("--host", default="127.0.0.1", help="Host address (default 127.0.0.1)")
    
    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        return 0
        
    cmds = {
        "list": cmd_list,
        "show": cmd_show,
        "run": cmd_run,
        "validate": cmd_validate,
        "validate-all": cmd_validate_all,
        "stats": cmd_stats,
        "rebuild": cmd_rebuild,
        "serve": cmd_serve,
        "web": cmd_serve
    }
    
    handler = cmds.get(args.command)
    if handler:
        return handler(args)
    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
