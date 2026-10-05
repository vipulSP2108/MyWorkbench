"""Parser for DataLemur_SQL (2).pdf.

Extracts all 100 questions, metadata, schemas, example inputs, example outputs,
approaches, and reference SQL solutions from the PDF.
"""

from __future__ import annotations
import os
import re
from typing import Dict, Any, List, Optional
import pdfplumber
from .type_normaliser import normalise_type
from .json_parser import clean_table_name


def parse_schema_text(text: str) -> List[Dict[str, Any]]:
    """Parse table schema definitions from PDF text."""
    tables = []
    current_table = None
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    
    for line in lines:
        m_tbl = re.search(r"(?:GENERATED table:|Table:\s*|Table\s+\d+\s*\((?:used below as\s+)?)([a-zA-Z0-9_]+)", line, re.IGNORECASE)
        if m_tbl:
            tbl_name = clean_table_name(m_tbl.group(1))
            current_table = {"table_name": tbl_name, "columns": []}
            tables.append(current_table)
            continue
            
        if "Column Name" in line or "column_name" in line:
            continue
            
        parts = line.split()
        if len(parts) >= 2 and current_table is not None:
            cname = parts[0].strip()
            # If line is header or separator, skip
            if cname.lower() in ("column", "type", "description"):
                continue
            raw_type = parts[1].strip()
            ctype, _ = normalise_type(raw_type, cname)
            current_table["columns"].append({
                "column_name": cname,
                "data_type": ctype
            })
            
    return tables


def parse_example_input_text(text: str, schemas: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    """Parse example input rows from PDF text."""
    sample_data: Dict[str, List[Dict[str, Any]]] = {}
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    
    current_table = None
    cols: List[str] = []
    
    for line in lines:
        m_tbl = re.search(r"(?:GENERATED example input:|example input:\s*)([a-zA-Z0-9_]+)", line, re.IGNORECASE)
        if m_tbl:
            current_table = clean_table_name(m_tbl.group(1))
            sample_data[current_table] = []
            cols = []
            continue
            
        if current_table and not cols:
            # Check if this line looks like column headers
            tokens = line.split()
            # If we have a schema for current_table, verify tokens
            matched_schema = next((s for s in schemas if s["table_name"] == current_table), None)
            if matched_schema:
                known_cols = [c["column_name"].lower() for c in matched_schema["columns"]]
                if any(t.lower() in known_cols for t in tokens):
                    cols = tokens
                    continue
            cols = tokens
            continue
            
        if current_table and cols:
            tokens = line.split()
            # Don't parse footers or notes as rows
            if line.startswith("DataLemur") or "Back to index" in line or line.startswith("Ran on"):
                continue
            if len(tokens) == len(cols):
                sample_data[current_table].append(dict(zip(cols, tokens)))
                
    return sample_data


def parse_example_output_text(text: str) -> List[Dict[str, Any]]:
    """Parse example output rows from PDF text."""
    output_rows = []
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    cols: List[str] = []
    
    for line in lines:
        if line.startswith("GENERATED example output") or line.startswith("Example Output") or "computed by" in line:
            continue
        if line.startswith("The output shows") or line.startswith("Ran on") or "DataLemur" in line:
            break
            
        tokens = line.split()
        if not cols:
            cols = tokens
            continue
            
        if len(tokens) == len(cols):
            output_rows.append(dict(zip(cols, tokens)))
            
    return output_rows


def parse_pdf(pdf_path: str = "DataLemur_SQL (2).pdf") -> List[Dict[str, Any]]:
    """Parses all question pages from the PDF."""
    results = []
    if not os.path.exists(pdf_path):
        return results
        
    sec_names = [
        "QUESTION",
        "INPUT SCHEMA",
        "EXAMPLE INPUT",
        "EXAMPLE OUTPUT",
        "APPROACH",
        "SQL SOLUTION",
        "SOURCES"
    ]
    
    with pdfplumber.open(pdf_path) as pdf:
        # Questions are on pages 5 to 104 (0-indexed indices 4 to 103)
        for page_idx in range(4, min(104, len(pdf.pages))):
            page = pdf.pages[page_idx]
            text = page.extract_text() or ""
            lines = [l.strip() for l in text.split("\n") if l.strip()]
            if not lines:
                continue
                
            # Line 0: "<N>. <Title>"
            m_title = re.match(r"^(\d+)\.\s*(.*)", lines[0])
            q_num = int(m_title.group(1)) if m_title else (page_idx - 3)
            title = m_title.group(2).strip() if m_title else lines[0]
            
            # Line 1: "SQL | <Company> | <Difficulty> | <Access> | Match: <tag>"
            company = ""
            difficulty = ""
            access = ""
            if len(lines) > 1 and "SQL |" in lines[1]:
                parts = [p.strip() for p in lines[1].split("|")]
                if len(parts) >= 2:
                    company = parts[1]
                if len(parts) >= 3:
                    difficulty = parts[2]
                if len(parts) >= 4:
                    access = parts[3]
                    
            # Parse sections
            sections: Dict[str, List[str]] = {}
            cur_sec = "header"
            sections[cur_sec] = []
            
            for line in lines[2:]:
                matched = None
                for s in sec_names:
                    if re.match(rf"^{s}\b", line, re.IGNORECASE):
                        matched = s
                        break
                if matched:
                    cur_sec = matched
                    sections[cur_sec] = []
                else:
                    sections[cur_sec].append(line)
                    
            q_text = "\n".join(sections.get("QUESTION", [])).strip()
            # Remove leading "(reworded)" or "(exact text from the page)"
            q_text = re.sub(r"^\((?:reworded|exact text from the page)\)\s*", "", q_text, flags=re.IGNORECASE)
            
            schema_text = "\n".join(sections.get("INPUT SCHEMA", [])).strip()
            input_text = "\n".join(sections.get("EXAMPLE INPUT", [])).strip()
            output_text = "\n".join(sections.get("EXAMPLE OUTPUT", [])).strip()
            sql_text = "\n".join(sections.get("SQL SOLUTION", [])).strip()
            # Clean SQL text
            sql_lines = []
            for sl in sql_text.split("\n"):
                if sl.startswith("Ran on the GENERATED") or sl.startswith("DataLemur SQL") or "Back to index" in sl:
                    break
                sql_lines.append(sl)
            cleaned_sql = "\n".join(sql_lines).strip()
            
            schemas = parse_schema_text(schema_text)
            sample_data = parse_example_input_text(input_text, schemas)
            sample_output = parse_example_output_text(output_text)
            
            results.append({
                "question_num": q_num,
                "title": title,
                "company": company,
                "difficulty": difficulty,
                "access": access,
                "question_statement": q_text,
                "tables": schemas,
                "sample_data": sample_data,
                "sample_output": sample_output,
                "reference_sql": cleaned_sql,
                "sources": [["DataLemur PDF", f"Page {page_idx + 1}"]]
            })
            
    return results
