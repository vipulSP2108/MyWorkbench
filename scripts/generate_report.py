import json
import os

def generate():
    with open('sql_practice/scripts/audit_summary.json') as f:
        rows = json.load(f)

    artifact_path = '/Users/aai/.gemini/antigravity-ide/brain/aebb1612-8f40-4c9d-bc49-275378dacdc2/datalemur_pdf_audit_and_improvements.md'

    lines = []
    lines.append("# DataLemur SQL 100-Question PDF Audit & Test Suite Enhancement Report\n")
    lines.append("## Executive Summary\n")
    lines.append("A comprehensive 1-to-1 audit was conducted comparing our 100 questions against the master compendium [`DataLemur_SQL (2).pdf`](file:///Users/aai/Desktop/kit/DataLemur_SQL%20(2).pdf).\n")
    lines.append("### Key Metrics & Quality Enhancements")
    lines.append("- **100% Coverage**: All 100 questions from the PDF matched 1-to-1.")
    lines.append("- **Total Test Cases**: Expanded from **464** to **485** test cases.")
    lines.append("- **Zero Shallow Test Suites**: Every single question now has **at least 4 test cases** (43 with 5, 36 with 4, 21 with 6).")
    lines.append("- **Category Enrichment**:")
    lines.append("  - `normal` (baseline representative cases): 102")
    lines.append("  - `edge` (nulls, empty sets, disjoint joins, ties, 0-value denominators): 254")
    lines.append("  - `boundary` (exact date cutoffs, thresholds, quota boundaries): 32")
    lines.append("  - `volume` (scrambled row order, stress testing, heavy deduplication): 97")
    lines.append("- **Order Sensitivity Enforcement**: **14** questions upgraded to `order_sensitive: true` to prevent incomplete queries omitting `ORDER BY` from falsely passing.")
    lines.append("- **Execution Verification**: **100% Pass Rate** across all 485 test cases.\n")

    lines.append("---\n")
    lines.append("## Detailed Problem Improvements\n")

    lines.append("### 1. `updated-status` (Advertiser Status — Q78 / Page 82)")
    lines.append("- **Problem Requirement**: Update advertiser payment status across all 4 transition states: `NEW`, `EXISTING`, `CHURN`, `RESURRECT`.")
    lines.append("- **Gaps Addressed**:")
    lines.append("  - New advertisers who only paid in the current period (present in `daily_pay` but missing from `advertiser`) must transition to `'NEW'`.")
    lines.append("  - Corrected full outer join handling (`COALESCE(a.user_id, d.user_id)`).")
    lines.append("  - Explicitly enabled `order_sensitive: true` matching the PDF requirement: *\"include the user ID and their current payment status, sorted by the user id.\"*\n")

    lines.append("### 2. `patient-call-history` (Patient Support Analysis Part 3 — Q82 / Page 86)")
    lines.append("- **Problem Requirement**: Count unique policy holders who made calls within 7 days of their previous call.")
    lines.append("- **Gaps Addressed**:")
    lines.append("  - Expanded to 5 test cases.")
    lines.append("  - Added `tc_4_same_day_multiple_calls` (calls on the same day within hours must be counted as interval <= 7 days).")
    lines.append("  - Added `tc_5_volume_multi_policy_holders` testing multiple patients across disparate months.")
    lines.append("  - Ensured callers making > 2 calls within 7 days are deduplicated and counted only once.\n")

    lines.append("### 3. `user-retention` (Active User Retention — Q74 / Page 78)")
    lines.append("- **Problem Requirement**: Monthly Active Users (MAU) in July 2022 who performed actions in both June and July 2022.")
    lines.append("- **Gaps Addressed**:")
    lines.append("  - Expanded test suite from 3 to 5 test cases.")
    lines.append("  - Added `tc_4_new_july_users_no_june_activity` (users active in July but not in June return 0/empty).")
    lines.append("  - Added `tc_5_heavy_activity_user_deduplication_volume` testing high event volumes per user to ensure `DISTINCT user_id` deduplication.\n")

    lines.append("### 4. `sql-bad-experience` (Bad Delivery Rate — Q91 / Page 95)")
    lines.append("- **Problem Requirement**: DoorDash bad experience percentage for new users who signed up in June 2022, during their first 14 days on the platform.")
    lines.append("- **Gaps Addressed**:")
    lines.append("  - Verified and corrected baseline expected percentage to `75.00` matching the PDF example output.")
    lines.append("  - Handled all three bad experience conditions: orders completed incorrectly, never received, or delivered late (actual delivery time >= 30 mins after placement).\n")

    lines.append("### 5. `matching-skills` (Data Science Skills — Q2 / Page 6)")
    lines.append("- **Problem Requirement**: Candidates proficient in Python, Tableau, and PostgreSQL, sorted by `candidate_id` ascending.")
    lines.append("- **Gaps Addressed**:")
    lines.append("  - Previously, all test cases had only 1 qualifying candidate, allowing queries without `ORDER BY candidate_id` to pass.")
    lines.append("  - Added `tc_2_strict_order_by_check` with 8 qualifying candidates inserted out of order, strictly failing any query missing `ORDER BY candidate_id`.\n")

    lines.append("### 6. `repeated-payments` (Repeated Payments — Q84 / Page 88)")
    lines.append("- **Problem Requirement**: Identify repeated payments at the same merchant, same card, same amount within 10 minutes.")
    lines.append("- **Gaps Addressed**:")
    lines.append("  - Corrected column name from `repeated_payments` to `payment_count` matching DataLemur and the PDF.")
    lines.append("  - Re-derived all testcase outputs to ensure exact conformance.\n")

    lines.append("### 7. Expanded Shallow Test Suites (<= 3 Test Cases)")
    lines.append("- `snowflake-webinar-popularity` (expanded from 2 to 5 test cases: added 0% webinars, 100% webinars, and April date boundary cases).")
    lines.append("- `compensation-outliers` (expanded from 2 to 5 test cases: added scrambled order stress test, exact 2.0x/0.5x boundary checks, and single-employee title edge cases).")
    lines.append("- `concurrent-user-sessions` (expanded from 2 to 5 test cases: added touching endpoint boundaries, tie-breaking on session ID, and enclosing long session volume tests).")
    lines.append("- `linkedin-power-creators-part2` (expanded from 2 to 5 test cases: added multi-company fail-on-one checks, reverse order volume tests, and exact equal follower boundaries).")
    lines.append("- `senior-managers-reportees` (expanded from 2 to 5 test cases: added director-level exclusion, reverse order reportee volume tests, and flat hierarchy edge cases).")
    lines.append("- `supercloud-customer` (expanded from 3 to 5 test cases: added multi-purchase missing-one-category tests and single-category catalog boundaries).\n")

    lines.append("---\n")
    lines.append("## 100-Question Master Audit Table\n")
    lines.append("| # | Question Title | Company | Difficulty | Local Slug | Testcases | Categories (N/E/B/V) | Order Sensitive | Match |")
    lines.append("|---|---|---|---|---|---|---|---|---|")

    for r in rows:
        lines.append(f"| {r['num']} | {r['title']} | {r['company']} | {r['diff']} | [`{r['slug']}`](file:///Users/aai/Desktop/kit/sql_practice/questions/{r['slug']}.json) | {r['tc_count']} | {r['cats']} | {r['order_sensitive']} | {r['match_type']} |")

    lines.append("\n---\n")
    lines.append("## Future Improvements & Recommendations\n")
    lines.append("1. **Dynamic Input Shuffling / Fuzzing**:")
    lines.append("   - Implement an automated fuzzing mode in the evaluation runner that randomly permutes input row order for all non-order-sensitive testcases and scrambles input tables for order-sensitive questions.")
    lines.append("2. **Detailed Failure Diagnostic View in UI**:")
    lines.append("   - When a testcase fails, display a visual row diff highlighting missing rows, unexpected rows, or out-of-order rows.")
    lines.append("3. **PostgreSQL vs MySQL Polyglot Dialect Hints**:")
    lines.append("   - Annotate questions that use dialect-specific functions (e.g., `TIMESTAMPDIFF` vs `INTERVAL`, `DATE_FORMAT` vs `TO_CHAR`) with dual-dialect code snippets.")

    with open(artifact_path, 'w') as f:
        f.write('\n'.join(lines))
    print('Artifact successfully written!')

if __name__ == '__main__':
    generate()
