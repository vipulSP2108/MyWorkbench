"""Parser for data/content/*.json files.

Extracts questions, schemas, sample inputs, example outputs, notes, and references.
"""

from __future__ import annotations
import os
import json
import re
from typing import Dict, Any, List, Optional
from .type_normaliser import normalise_type


def clean_table_name(raw: str) -> str:
    """Extract clean table name from headers like 'tweets Table:' or 'Table 1 (used below as staffing)'."""
    text = raw.strip()
    m_used = re.search(r"used[\s_]+below[\s_]+as[\s_]+([a-zA-Z0-9_]+)", text, re.IGNORECASE)
    if m_used:
        return m_used.group(1).lower()
    m_sub = re.search(r"table[\s_]*\d*[\s_]+([a-zA-Z0-9_]+)", text, re.IGNORECASE)
    if m_sub and m_sub.group(1).lower() not in ("table", "schema", "input", "output"):
        return m_sub.group(1).lower()
    m_dbl = re.search(r"^([a-zA-Z0-9_]+)__", text)
    if m_dbl:
        return m_dbl.group(1).lower()
    text = re.sub(r"^(?:Table:\s*|GENERATED table:\s*|Table\s+\d+\s*\((?:used below as\s+)?|\s*)", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*(?:Table|Schema|Example Input|Input|\)):?$", "", text, flags=re.IGNORECASE)
    cleaned = re.sub(r"[^a-zA-Z0-9_]", "_", text).strip("_").lower()
    return cleaned or "main_table"


def parse_content_json(filepath: str, meta: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Parses a content JSON file into standard question components."""
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    slug = os.path.splitext(os.path.basename(filepath))[0]
    
    question_statement = ""
    notes: List[str] = []
    tables: List[Dict[str, Any]] = []
    sample_data: Dict[str, List[Dict[str, Any]]] = {}
    sample_output: List[Dict[str, Any]] = []
    reference_sql = ""
    approach = ""
    sources = data.get("sources", [])
    
    # CASE 1: Structured schema & inputs format (48+ files)
    if "schema" in data and data["schema"]:
        # Question text
        q_raw = data.get("question", "")
        if isinstance(q_raw, list):
            question_statement = "\n\n".join(str(p) for p in q_raw)
        else:
            question_statement = str(q_raw)
            
        # SQL
        sql_raw = data.get("sql", "")
        if isinstance(sql_raw, list):
            reference_sql = "\n".join(sql_raw)
        elif isinstance(sql_raw, str):
            reference_sql = sql_raw
            
        # Approach
        app_raw = data.get("approach", "")
        if isinstance(app_raw, list):
            approach = "\n\n".join(app_raw)
        elif isinstance(app_raw, str):
            approach = app_raw
            
        # Tables schema
        for tbl_info in data.get("schema", []):
            tbl_name = clean_table_name(tbl_info.get("name", "main_table"))
            raw_cols = tbl_info.get("cols", [])
            cols_def = []
            for col_item in raw_cols:
                if isinstance(col_item, (list, tuple)) and len(col_item) >= 2:
                    cname = str(col_item[0]).strip()
                    ctype, _ = normalise_type(str(col_item[1]).strip(), cname)
                    cols_def.append({"column_name": cname, "data_type": ctype})
            tables.append({
                "table_name": tbl_name,
                "columns": cols_def
            })
            
        # Inputs data
        for inp_item in data.get("inputs", []):
            tbl_name = clean_table_name(inp_item.get("name", "main_table"))
            cols = inp_item.get("cols", [])
            rows = inp_item.get("rows", [])
            row_dicts = []
            if cols and rows:
                for r in rows:
                    if len(r) == len(cols):
                        row_dicts.append(dict(zip(cols, r)))
            sample_data[tbl_name] = row_dicts
            
        # Output
        out_info = data.get("output", {})
        if isinstance(out_info, dict):
            out_cols = out_info.get("cols", [])
            out_rows = out_info.get("rows", [])
            if out_cols and out_rows:
                for r in out_rows:
                    if len(r) == len(out_cols):
                        sample_output.append(dict(zip(out_cols, r)))

    # CASE 2: Blocks format (52+ files)
    elif "blocks" in data and data["blocks"]:
        blocks = data["blocks"]
        q_paragraphs = []
        current_section = "intro"
        current_table = "main_table"
        
        for idx, block in enumerate(blocks):
            btype = block.get("type")
            text = block.get("text", "")
            
            if btype == "h":
                t_lower = text.lower()
                if "output" in t_lower:
                    current_section = "output"
                elif "example input" in t_lower or "input" in t_lower:
                    current_section = "input"
                    current_table = clean_table_name(text)
                elif "schema" in t_lower or "table" in t_lower:
                    current_section = "schema"
                    current_table = clean_table_name(text)
                else:
                    current_section = "other"
            elif btype == "p":
                if current_section == "intro":
                    q_paragraphs.append(text)
                elif current_section == "output" and not sample_output:
                    notes.append(text)
                else:
                    notes.append(text)
            elif btype == "ul":
                items = block.get("items", [])
                notes.extend(items)
            elif btype == "table":
                cols = block.get("cols", [])
                rows = block.get("rows", [])
                
                # Check if this table represents a schema definition
                cols_norm = [c.lower().replace("_", " ").strip() for c in cols]
                is_schema = cols_norm in (
                    ["column name", "type"],
                    ["column", "type"],
                    ["column name", "data type"],
                    ["column name", "type", "description"]
                )
                
                if is_schema:
                    cols_def = []
                    for r in rows:
                        if len(r) >= 2:
                            cname = str(r[0]).strip()
                            ctype, _ = normalise_type(str(r[1]).strip(), cname)
                            cols_def.append({"column_name": cname, "data_type": ctype})
                    # Check if table already added
                    existing = next((t for t in tables if t["table_name"] == current_table), None)
                    if existing:
                        existing["columns"] = cols_def
                    else:
                        tables.append({"table_name": current_table, "columns": cols_def})
                elif current_section == "output" or "output" in current_table:
                    # Output table
                    if cols and rows:
                        for r in rows:
                            if len(r) == len(cols):
                                sample_output.append(dict(zip(cols, r)))
                else:
                    # Sample input table
                    if cols and rows:
                        row_dicts = []
                        for r in rows:
                            if len(r) == len(cols):
                                row_dicts.append(dict(zip(cols, r)))
                        sample_data[current_table] = row_dicts
                        
        question_statement = "\n\n".join(q_paragraphs)

    return {
        "slug": slug,
        "question_statement": question_statement.strip(),
        "notes": notes,
        "tables": tables,
        "sample_data": sample_data,
        "sample_output": sample_output,
        "reference_sql": reference_sql.strip(),
        "approach": approach.strip(),
        "sources": sources
    }
