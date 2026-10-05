"""MySQL 8.0 Type Normaliser.

Normalises arbitrary source type strings into canonical MySQL 8.0 data types,
applying domain heuristics based on column names.
"""

from __future__ import annotations
import re
from typing import Optional, Tuple, List


def normalise_type(
    raw_type: str,
    column_name: Optional[str] = None
) -> Tuple[str, Optional[List[str]]]:
    """
    Normalise a raw type string to a standard MySQL 8.0 type.
    
    Returns:
        (canonical_type_string, optional_check_constraints)
    """
    if not raw_type:
        raw_type = "VARCHAR(255)"
    
    cleaned = raw_type.strip().lower()
    col = (column_name or "").lower()
    
    # Handle string ('Option1', 'Option2') enum-style definitions
    enum_match = re.search(r"(?:string|varchar|enum)\s*\((['\"].*?['\"])\)", cleaned, re.IGNORECASE)
    if enum_match:
        items = re.findall(r"['\"]([^'\"]+)['\"]", enum_match.group(1))
        return "VARCHAR(50)", items
    
    # Clean whitespace inside parentheses, e.g., decimal (10, 2) -> decimal(10,2)
    cleaned = re.sub(r"\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)", r"(\1,\2)", cleaned)
    cleaned = re.sub(r"\s*\(\s*(\d+)\s*\)", r"(\1)", cleaned)
    
    # Decimal / Numeric with precision and scale
    dec_match = re.match(r"^(?:decimal|numeric)\((\d+),(\d+)\)$", cleaned)
    if dec_match:
        return f"DECIMAL({dec_match.group(1)},{dec_match.group(2)})", None
    
    # Bare decimal / numeric
    if cleaned in ("decimal", "numeric"):
        return "DECIMAL(10,2)", None
    
    # Monetary / financial column name heuristics
    monetary_keywords = ("price", "amount", "revenue", "cost", "salary", "profit", "balance", "spend", "paid", "rate", "pct", "percentage")
    if any(k in col for k in monetary_keywords) and cleaned in ("decimal", "numeric", "float", "number"):
        return "DECIMAL(10,2)", None
    
    # Date / Time column overrides if mistakenly typed as string
    if cleaned in ("string", "text", "varchar"):
        if col.endswith("_date") or col == "date":
            return "DATE", None
    # Rating / Stars column override
    if col in ("stars", "rating", "score", "review_stars"):
        return "INT", None
        
    if cleaned in ("integer", "int", "int4"):
        return "INT", None
    if cleaned in ("bigint", "int8"):
        return "BIGINT", None
    if cleaned in ("smallint", "int2"):
        return "SMALLINT", None
    if cleaned in ("tinyint", "boolean", "bool"):
        return "BOOLEAN", None
    if cleaned in ("float", "real"):
        return "FLOAT", None
    if cleaned in ("double", "double precision"):
        return "DOUBLE", None
    if cleaned in ("date",):
        return "DATE", None
    if cleaned in ("time",):
        return "TIME", None
    if cleaned in ("datetime", "timestamp", "timestamptz"):
        return "DATETIME", None
    if cleaned in ("text", "longtext", "mediumtext"):
        return "TEXT", None
        
    varchar_match = re.match(r"^varchar\((\d+)\)$", cleaned)
    if varchar_match:
        return f"VARCHAR({varchar_match.group(1)})", None
        
    char_match = re.match(r"^char\((\d+)\)$", cleaned)
    if char_match:
        return f"CHAR({char_match.group(1)})", None
        
    if "varchar" in cleaned or "string" in cleaned:
        return "VARCHAR(255)", None
        
    return "VARCHAR(255)", None
