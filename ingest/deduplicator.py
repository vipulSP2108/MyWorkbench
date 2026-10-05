"""Merge and deduplicate questions from content JSONs, PDF, and master index."""

from __future__ import annotations
import os
import json
import re
from typing import Dict, Any, List
from .json_parser import parse_content_json
from .pdf_parser import parse_pdf
from .tagger import derive_tags


MULTI_PART_SERIES = {
    "pharmacy-analytics": [
        "top-profitable-drugs",
        "non-profitable-drugs",
        "total-drugs-sales",
        "top-drugs-sold"
    ],
    "patient-support": [
        "frequent-callers",
        "uncategorized-calls-percentage",
        "patient-call-history",
        "long-calls-growth"
    ],
    "faang-stock": [
        "sql-bloomberg-stock-min-max-1",
        "sql-bloomberg-stock-monthly-change",
        "sql-bloomberg-underperforming-stocks"
    ],
    "linkedin-creators": [
        "linkedin-power-creators",
        "linkedin-power-creators-part2"
    ],
    "compressed-series": [
        "alibaba-compressed-mean",
        "alibaba-compressed-mode",
        "alibaba-compressed-median"
    ]
}


def build_unified_questions(
    master_path: str = "data/sql_master.json",
    pdf_path: str = "DataLemur_SQL (2).pdf",
    content_dir: str = "data/content"
) -> List[Dict[str, Any]]:
    """Merges all sources into canonical question dictionaries for all 100 questions."""
    with open(master_path, "r", encoding="utf-8") as f:
        master_list = json.load(f)
        
    pdf_list = parse_pdf(pdf_path) if os.path.exists(pdf_path) else []
    
    # Map series lookups
    slug_to_related: Dict[str, List[str]] = {}
    for series_name, slugs in MULTI_PART_SERIES.items():
        for s in slugs:
            slug_to_related[s] = [other for other in slugs if other != s]
            
    unified = []
    
    for idx, m in enumerate(master_list, start=1):
        slug = m["slug"]
        title = m["title"]
        company = m.get("company", "")
        difficulty = m.get("difficulty", "Easy")
        premium = m.get("premium", False)
        
        # Load content json
        content_file = os.path.join(content_dir, f"{slug}.json")
        c_data = parse_content_json(content_file) if os.path.exists(content_file) else {}
        
        # Load PDF item (1-to-1 match by index or title)
        pdf_item = pdf_list[idx - 1] if idx - 1 < len(pdf_list) else None
        
        # Merge question text: prefer rich JSON if available, otherwise PDF
        question_text = c_data.get("question_statement") or (pdf_item.get("question_statement") if pdf_item else "") or title
        
        # Merge tables: prefer JSON tables if present, else PDF
        tables = c_data.get("tables")
        if not tables and pdf_item:
            tables = pdf_item.get("tables", [])
            
        # Clean generic table names to domain names
        slug_table_overrides = {
            "apple-pay-volume": "payments",
            "sql-highest-products": "user_transactions",
            "snowflake-webinar-popularity": "webinar_attendance",
            "linkedin-power-creators-part2": "personal_profiles",
            "money-transfer-relationships": "payments",
            "sql-first-transaction": "user_transactions",
            "sql-monthly-merchant-balance": "transactions",
            "matching-rental-amenities": "rental_amenities",
        }
        
        # Merge sample data
        sample_data = c_data.get("sample_data")
        if not sample_data and pdf_item:
            sample_data = pdf_item.get("sample_data", {})
            
        slug_table_overrides = {
            "apple-pay-volume": "payments",
            "sql-highest-products": "user_transactions",
            "snowflake-webinar-popularity": "webinar_attendance",
            "linkedin-power-creators-part2": "personal_profiles",
            "money-transfer-relationships": "payments",
            "sql-first-transaction": "user_transactions",
            "sql-monthly-merchant-balance": "transactions",
            "matching-rental-amenities": "rental_amenities",
        }
        for t in (tables or []):
            if t["table_name"] in ("forecasted_demand__column_names_only",):
                t["table_name"] = "forecasted_demand"
            if t["table_name"] in ("stock_prices__from_part_1",):
                t["table_name"] = "stock_prices"
            if t["table_name"] in ("items_per_order__from_the_free_sibling_questions",):
                t["table_name"] = "items_per_order"
            if slug == "linkedin-power-creators":
                if t["table_name"] in ("1", "table_1"):
                    t["table_name"] = "personal_profiles"
                elif t["table_name"] in ("2", "table_2"):
                    t["table_name"] = "company_pages"
            if slug == "2nd-ride-delay":
                if t["table_name"] in ("1", "table_1"):
                    t["table_name"] = "users"
                elif t["table_name"] in ("2", "table_2"):
                    t["table_name"] = "rides"
            if slug == "sql-bad-experience":
                if t["table_name"] in ("1", "table_1"):
                    t["table_name"] = "orders"
                elif t["table_name"] in ("2", "table_2"):
                    t["table_name"] = "trips"
                elif t["table_name"] in ("3", "table_3"):
                    t["table_name"] = "customers"
            if slug == "page-recommendation":
                if t["table_name"] in ("1", "table_1"):
                    t["table_name"] = "friendship"
                elif t["table_name"] in ("2", "table_2"):
                    t["table_name"] = "page_likes"
            if slug == "average-vacant-days":
                if t["table_name"] in ("1", "table_1"):
                    t["table_name"] = "bookings"
                elif t["table_name"] in ("2", "table_2"):
                    t["table_name"] = "listings"
            if slug == "same-week-purchases":
                if t["table_name"] in ("1", "table_1"):
                    t["table_name"] = "signups"
                elif t["table_name"] in ("2", "table_2"):
                    t["table_name"] = "purchases"
            if slug in slug_table_overrides:
                override_name = slug_table_overrides[slug]
                if t["table_name"] in ("main_table", "table__name_and_columns_from_a_public_solution", "part_1_profiles_table__part_2_tables_not_found"):
                    old_t_name = t["table_name"]
                    t["table_name"] = override_name
                    if sample_data and old_t_name in sample_data:
                        sample_data[override_name] = sample_data.pop(old_t_name)
                        
        # Clean up sample data keys (strip prefixes like sample_data__, example_input__)
        clean_sample_data = {}
        if sample_data:
            for k, v in sample_data.items():
                ck = re.sub(r"^(?:sample_data__|example_input__|generated_example_input__|example_input_)", "", k, flags=re.IGNORECASE)
                clean_sample_data[ck.lower()] = v

        # Align sample data keys to actual table names by column overlap
        aligned_sample_data = {}
        if tables:
            tbl_names = {t["table_name"] for t in tables}
            # 1. Exact matches
            for t in tables:
                tname = t["table_name"]
                if tname in clean_sample_data:
                    aligned_sample_data[tname] = clean_sample_data[tname]

            # 2. Overlap matches for remaining keys
            remaining_keys = [k for k in clean_sample_data if k not in aligned_sample_data]
            remaining_tables = [t for t in tables if t["table_name"] not in aligned_sample_data]

            for k in remaining_keys:
                rows = clean_sample_data[k]
                sample_cols = list(rows[0].keys()) if rows else []
                best_t = None
                best_overlap = -1
                for t in remaining_tables:
                    t_cols = {c["column_name"].lower() for c in t["columns"]}
                    overlap = len(set(c.lower() for c in sample_cols) & t_cols)
                    if overlap > best_overlap:
                        best_overlap = overlap
                        best_t = t
                if best_t and best_overlap > 0:
                    aligned_sample_data[best_t["table_name"]] = rows
                    remaining_tables.remove(best_t)
                elif len(remaining_tables) == 1 and not sample_cols:
                    aligned_sample_data[remaining_tables[0]["table_name"]] = rows
                    remaining_tables.clear()

            # Specific overrides for questions with missing tables
            if slug == "sql-spare-server-capacity" and "forecasted_demand" not in aligned_sample_data:
                aligned_sample_data["forecasted_demand"] = [
                    {"customer_id": 1, "datacenter_id": 1, "monthly_demand": 60},
                    {"customer_id": 2, "datacenter_id": 1, "monthly_demand": 25},
                    {"customer_id": 3, "datacenter_id": 2, "monthly_demand": 40},
                    {"customer_id": 4, "datacenter_id": 3, "monthly_demand": 10},
                ]
            if slug == "page-recommendation" and "page_likes" not in aligned_sample_data:
                aligned_sample_data["page_likes"] = [
                    {"user_id": 2, "page_id": 10},
                    {"user_id": 3, "page_id": 20},
                    {"user_id": 1, "page_id": 10},
                    {"user_id": 4, "page_id": 30},
                ]

            # 3. If any table is still missing or has 0 rows, generate default rows matching schema
            for t in tables:
                tname = t["table_name"]
                if tname not in aligned_sample_data or not aligned_sample_data[tname]:
                    row1 = {}
                    row2 = {}
                    for col in t["columns"]:
                        cname = col["column_name"]
                        ctype = col["data_type"].upper()
                        if "INT" in ctype:
                            row1[cname] = 101
                            row2[cname] = 102
                        elif "DECIMAL" in ctype or "NUMERIC" in ctype or "FLOAT" in ctype or "DOUBLE" in ctype:
                            row1[cname] = 50.0
                            row2[cname] = 75.0
                        elif "DATE" in ctype or "TIME" in ctype:
                            row1[cname] = "2022-01-01"
                            row2[cname] = "2022-01-02"
                        elif "BOOL" in ctype:
                            row1[cname] = True
                            row2[cname] = False
                        else:
                            row1[cname] = f"Sample_{cname}_A"
                            row2[cname] = f"Sample_{cname}_B"
                    aligned_sample_data[tname] = [row1, row2]

            sample_data = aligned_sample_data
            
        # Merge sample output
        sample_output = c_data.get("sample_output")
        if not sample_output and pdf_item:
            sample_output = pdf_item.get("sample_output", [])
            
        # Reference SQL
        reference_sql = c_data.get("reference_sql") or (pdf_item.get("reference_sql") if pdf_item else "")
        
        # Sources
        sources = []
        if c_data.get("sources"):
            sources.extend(c_data["sources"])
        if pdf_item and pdf_item.get("sources"):
            for s in pdf_item["sources"]:
                if s not in sources:
                    sources.append(s)
        if not sources:
            sources.append(["DataLemur", f"https://datalemur.com/questions/{slug}"])
            
        tags = derive_tags(
            question_text=question_text,
            sql_text=reference_sql,
            difficulty=difficulty,
            company=company,
            tables=tables
        )
        
        item = {
            "question_id": f"q_{idx:03d}_{slug.replace('-', '_')}",
            "slug": slug,
            "title": title,
            "difficulty": difficulty,
            "company": company,
            "premium": premium,
            "question": question_text,
            "notes": c_data.get("notes", []),
            "tables": tables or [],
            "sample_data": sample_data or {},
            "sample_output": sample_output or [],
            "reference_sql": reference_sql or "",
            "tags": tags,
            "related_questions": slug_to_related.get(slug, []),
            "sources": sources,
            "test_cases": []
        }
        unified.append(item)
        
    return unified
