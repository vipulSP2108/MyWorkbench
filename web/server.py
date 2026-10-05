"""Local web server for the interactive SQL Practice Platform."""

from __future__ import annotations
import os
import sys
import json
import time
import decimal
import datetime
try:
    from http.server import ThreadingHTTPServer as ServerClass
except ImportError:
    from http.server import HTTPServer as ServerClass
from http.server import SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from typing import Any, Dict, List
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
WORKBENCH_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
for _p in (PROJECT_ROOT, WORKBENCH_DIR):
    if _p not in sys.path:
        sys.path.insert(0, _p)

try:
    from MyWorkbench.cli import load_all_questions, load_question
    from MyWorkbench.engine.runner import SQLRunner
    from MyWorkbench.engine.comparator import compare
except ImportError:
    from cli import load_all_questions, load_question
    from engine.runner import SQLRunner
    from engine.comparator import compare

STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")


class DecimalEncoder(json.JSONEncoder):
    def default(self, o: Any) -> Any:
        if isinstance(o, decimal.Decimal):
            return float(o)
        if isinstance(o, (datetime.date, datetime.datetime)):
            return o.isoformat()
        return super().default(o)


class SQLPracticeHandler(SimpleHTTPRequestHandler):
    """Custom HTTP request handler serving static SPA frontend and REST API."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/questions":
            self.handle_get_questions()
        elif path == "/api/questions-all":
            self.handle_get_all_questions_detail()
        elif path.startswith("/api/questions/"):
            slug = path[len("/api/questions/"):]
            self.handle_get_question_detail(slug)
        elif path == "/api/stats":
            self.handle_get_stats()
        elif path == "/" or not os.path.exists(os.path.join(STATIC_DIR, path.lstrip("/"))):
            # Serve index.html for root and SPA routing
            self.path = "/index.html"
            return super().do_GET()
        else:
            return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        content_length = int(self.headers.get("Content-Length", 0))
        post_body = self.rfile.read(content_length).decode("utf-8") if content_length > 0 else "{}"
        try:
            payload = json.loads(post_body)
        except Exception:
            payload = {}

        if path == "/api/run":
            self.handle_post_run(payload)
        elif path == "/api/quick-run":
            self.handle_post_quick_run(payload)
        elif path == "/api/testcase/derive-expected":
            self.handle_post_derive_expected(payload)
        else:
            self.send_response(404)
            self.end_headers()

    def send_json(self, data: Any, status: int = 200):
        body = json.dumps(data, cls=DecimalEncoder).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def handle_get_questions(self):
        questions = load_all_questions()
        summary = []
        for q in questions:
            summary.append({
                "question_id": q.get("question_id"),
                "slug": q.get("slug"),
                "title": q.get("title"),
                "difficulty": q.get("difficulty", "Easy"),
                "company": q.get("company", ""),
                "tags": q.get("tags", []),
                "test_case_count": len(q.get("test_cases", []))
            })
        self.send_json(summary)

    def handle_get_question_detail(self, slug: str):
        q = load_question(slug)
        if not q:
            self.send_json({"error": f"Question '{slug}' not found"}, status=404)
            return

        # Prepare public test cases so user can view Case 1, Case 2 inputs before running
        public_test_cases = []
        for tc in q.get("test_cases", []):
            public_test_cases.append({
                "test_case_id": tc.get("test_case_id"),
                "description": tc.get("description", ""),
                "category": tc.get("category", "normal"),
                "input_data": tc.get("input_data", {}),
                "expected_output": tc.get("expected_output", [])
            })

        # Prepare public detail (include reference solution for learning)
        detail = {
            "question_id": q.get("question_id"),
            "slug": q.get("slug"),
            "title": q.get("title"),
            "difficulty": q.get("difficulty", "Easy"),
            "company": q.get("company", ""),
            "question": q.get("question", ""),
            "notes": q.get("notes", []),
            "tables": q.get("tables", []),
            "sample_data": q.get("sample_data", {}),
            "expected_output": q.get("expected_output") or q.get("sample_output") or [],
            "tags": q.get("tags", []),
            "order_sensitive": q.get("order_sensitive", False),
            "reference_sql": q.get("reference_sql", ""),
            "test_case_count": len(q.get("test_cases", [])),
            "test_cases": public_test_cases
        }
        self.send_json(detail)
    
    def handle_get_all_questions_detail(self):
        questions = load_all_questions()
        all_details = {}
        for q in questions:
            slug = q.get("slug")
            if not slug:
                continue
            public_test_cases = []
            for tc in q.get("test_cases", []):
                public_test_cases.append({
                    "test_case_id": tc.get("test_case_id"),
                    "description": tc.get("description", ""),
                    "category": tc.get("category", "normal"),
                    "input_data": tc.get("input_data", {}),
                    "expected_output": tc.get("expected_output", [])
                })
            all_details[slug] = {
                "question_id": q.get("question_id"),
                "slug": slug,
                "title": q.get("title"),
                "difficulty": q.get("difficulty", "Easy"),
                "company": q.get("company", ""),
                "question": q.get("question", ""),
                "notes": q.get("notes", []),
                "tables": q.get("tables", []),
                "sample_data": q.get("sample_data", {}),
                "expected_output": q.get("expected_output") or q.get("sample_output") or [],
                "tags": q.get("tags", []),
                "order_sensitive": q.get("order_sensitive", False),
                "reference_sql": q.get("reference_sql", ""),
                "test_case_count": len(q.get("test_cases", [])),
                "test_cases": public_test_cases
            }
        self.send_json(all_details)

    def handle_get_stats(self):
        questions = load_all_questions()
        diff_counts = {"Easy": 0, "Medium": 0, "Hard": 0}
        total_tc = sum(len(q.get("test_cases", [])) for q in questions)
        companies = set(q.get("company") for q in questions if q.get("company"))
        all_tags = set()
        for q in questions:
            d = q.get("difficulty", "Easy").capitalize()
            diff_counts[d] = diff_counts.get(d, 0) + 1
            all_tags.update(q.get("tags", []))

        self.send_json({
            "total_questions": len(questions),
            "total_test_cases": total_tc,
            "difficulties": diff_counts,
            "total_companies": len(companies),
            "total_tags": len(all_tags)
        })

    def handle_post_run(self, payload: Dict[str, Any]):
        slug = payload.get("slug")
        sql = payload.get("sql", "").strip()

        if not slug or not sql:
            self.send_json({"error": "Missing slug or sql parameter"}, status=400)
            return

        q = load_question(slug)
        if not q:
            self.send_json({"error": f"Question '{slug}' not found"}, status=404)
            return

        runner = SQLRunner()
        tables = q.get("tables", [])
        ref_sql = q.get("reference_sql", "").strip()
        test_cases = payload.get("test_cases") or q.get("test_cases", [])
        order_sensitive = q.get("order_sensitive", False)

        results = []
        all_passed = True
        start_all = time.perf_counter()

        for idx, tc in enumerate(test_cases):
            tc_id = tc.get("test_case_id", f"case_{idx + 1}")
            desc = tc.get("description", f"Case {idx + 1}")
            input_data = tc.get("input_data", {})
            expected = tc.get("expected_output")

            # If this is a custom or edited testcase, dynamically compute the ground truth expected output
            if (tc.get("category") == "custom" or tc.get("is_edited") or expected is None) and ref_sql:
                ref_res = runner.execute(tables, input_data, ref_sql)
                if ref_res.success:
                    expected = ref_res.rows

            t0 = time.perf_counter()
            exec_res = runner.execute(tables, input_data, sql)
            elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)

            if not exec_res.success:
                all_passed = False
                results.append({
                    "test_case_id": tc_id,
                    "description": desc,
                    "input_data": input_data,
                    "passed": False,
                    "message": "Execution error",
                    "error": exec_res.error,
                    "expected_output": expected if expected is not None else [],
                    "actual_output": [],
                    "elapsed_ms": elapsed_ms
                })
                continue

            passed, msg = compare(expected or [], exec_res.rows, order_sensitive=order_sensitive)
            if not passed:
                all_passed = False

            results.append({
                "test_case_id": tc_id,
                "description": desc,
                "input_data": input_data,
                "passed": passed,
                "message": msg,
                "error": None,
                "expected_output": expected if expected is not None else [],
                "actual_output": exec_res.rows,
                "elapsed_ms": elapsed_ms
            })

        total_ms = round((time.perf_counter() - start_all) * 1000, 2)
        passed_count = sum(1 for r in results if r["passed"])

        self.send_json({
            "slug": slug,
            "all_passed": all_passed,
            "passed_count": passed_count,
            "total_count": len(results),
            "summary": f"{passed_count}/{len(results)} test cases passed",
            "total_ms": total_ms,
            "test_cases": results
        })

    def handle_post_derive_expected(self, payload: Dict[str, Any]):
        slug = payload.get("slug")
        input_data = payload.get("input_data", {})
        if not slug:
            self.send_json({"error": "Missing slug parameter"}, status=400)
            return

        q = load_question(slug)
        if not q:
            self.send_json({"error": f"Question '{slug}' not found"}, status=404)
            return

        ref_sql = q.get("reference_sql", "").strip()
        tables = q.get("tables", [])
        if not ref_sql:
            self.send_json({"error": "No reference solution available for this question"}, status=400)
            return

        runner = SQLRunner()
        t0 = time.perf_counter()
        exec_res = runner.execute(tables, input_data, ref_sql)
        elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)

        if not exec_res.success:
            self.send_json({
                "success": False,
                "error": exec_res.error,
                "elapsed_ms": elapsed_ms
            }, status=400)
            return

        self.send_json({
            "success": True,
            "expected_output": exec_res.rows,
            "columns": exec_res.columns,
            "elapsed_ms": elapsed_ms
        })

    def handle_post_quick_run(self, payload: Dict[str, Any]):
        slug = payload.get("slug")
        sql = payload.get("sql", "").strip()

        if not slug or not sql:
            self.send_json({"error": "Missing slug or sql parameter"}, status=400)
            return

        q = load_question(slug)
        if not q:
            self.send_json({"error": f"Question '{slug}' not found"}, status=404)
            return

        runner = SQLRunner()
        tables = q.get("tables", [])
        sample_data = q.get("sample_data", {})
        expected = q.get("expected_output", [])
        order_sensitive = q.get("order_sensitive", False)

        t0 = time.perf_counter()
        exec_res = runner.execute(tables, sample_data, sql)
        elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)

        if not exec_res.success:
            self.send_json({
                "success": False,
                "error": exec_res.error,
                "elapsed_ms": elapsed_ms
            })
            return

        passed, msg = compare(expected, exec_res.rows, order_sensitive=order_sensitive)
        self.send_json({
            "success": True,
            "passed": passed,
            "message": msg,
            "input_data": sample_data,
            "rows": exec_res.rows,
            "columns": exec_res.columns,
            "expected_output": expected,
            "elapsed_ms": elapsed_ms
        })


def run_server(port: int = 8080, host: str = "127.0.0.1"):
    ServerClass.allow_reuse_address = True
    try:
        server_address = (host, port)
        httpd = ServerClass(server_address, SQLPracticeHandler)
    except OSError as e:
        if e.errno == 48:  # Address already in use
            print(f"⚠️ Port {port} is already in use. Trying port {port + 1}...")
            return run_server(port=port + 1, host=host)
        raise e

    print(f"🚀 SQL Practice Platform server running at: http://{host}:{port}/")
    print(f"Press Ctrl+C to stop.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
    finally:
        httpd.server_close()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    run_server(port=port)
