"""Tag Derivation for SQL questions.

Infers conceptual tags and domain tags from the question statement,
tables, schema, and reference SQL query.
"""

from __future__ import annotations
import re
from typing import List, Dict, Any


def derive_tags(
    question_text: str,
    sql_text: str = "",
    difficulty: str = "",
    company: str = "",
    tables: List[Dict[str, Any]] = None
) -> List[str]:
    """Derives a sorted, unique list of tags for a SQL question."""
    tags = set()
    
    q_lower = (question_text or "").lower()
    s_upper = (sql_text or "").upper()
    
    # Difficulty
    if difficulty:
        tags.add(difficulty.lower())
        
    # Company
    if company:
        tags.add(company.lower())
        
    # SQL Concepts from SQL and question text
    if any(k in s_upper for k in ("GROUP BY", "COUNT(", "SUM(", "AVG(", "MAX(", "MIN(")) or any(k in q_lower for k in ("average", "total", "count", "maximum", "minimum", "sum of", "group by")):
        tags.add("aggregation")
        
    if "LEFT JOIN" in s_upper or "unmatched" in q_lower:
        tags.add("left-join")
        tags.add("join")
    elif "JOIN" in s_upper or "join" in q_lower:
        tags.add("join")
        
    if "SELF JOIN" in s_upper or "manager" in q_lower and "employee" in q_lower:
        tags.add("self-join")
        
    if any(k in s_upper for k in ("ROW_NUMBER()", "RANK()", "DENSE_RANK()", "NTILE(")) or any(k in q_lower for k in ("rank", "top 3", "top 2", "dense rank", "row number")):
        tags.add("window-function")
        tags.add("ranking")
        
    if any(k in s_upper for k in ("LEAD(", "LAG(")) or any(k in q_lower for k in ("previous", "next day", "consecutive", "lag", "lead")):
        tags.add("window-function")
        tags.add("lead-lag")
        
    if "OVER (" in s_upper or "OVER(" in s_upper:
        tags.add("window-function")
        
    if "WITH " in s_upper or " cte " in q_lower:
        tags.add("cte")
        
    if any(k in s_upper for k in ("CASE WHEN", "IFNULL(", "COALESCE(")) or "case when" in q_lower:
        tags.add("conditional-logic")
        
    if any(k in s_upper for k in ("DATEDIFF(", "DATE_ADD(", "DATE_SUB(", "DATE_FORMAT(", "YEAR(", "MONTH(", "DAY(")) or any(k in q_lower for k in ("year", "month", "days", "date", "streak", "consecutive")):
        tags.add("date-manipulation")
        
    if "ROUND(" in s_upper or "round" in q_lower or "percentage" in q_lower or "ratio" in q_lower:
        tags.add("math")
        
    if any(k in s_upper for k in ("CONCAT(", "LIKE", "SUBSTRING(")) or "starts with" in q_lower:
        tags.add("string-manipulation")
        
    if "UNION" in s_upper:
        tags.add("set-operations")

    # Domain keywords
    table_names = [t.get("table_name", "").lower() for t in (tables or [])]
    all_context = f"{q_lower} {' '.join(table_names)}"
    
    if any(k in all_context for k in ("tweet", "post", "follower", "linkedin", "facebook", "snapchat", "profile", "creator", "page", "like")):
        tags.add("social-media")
    if any(k in all_context for k in ("order", "product", "cart", "customer", "purchase", "shopping", "ecommerce", "amazon", "alibaba")):
        tags.add("ecommerce")
    if any(k in all_context for k in ("stock", "price", "trade", "balance", "transaction", "payment", "bank", "revenue", "financial", "salary")):
        tags.add("finance")
    if any(k in all_context for k in ("drug", "patient", "call", "pharmacy", "medical", "hospital", "doctor")):
        tags.add("healthcare")
    if any(k in all_context for k in ("employee", "salary", "department", "manager", "hiring", "job", "candidate")):
        tags.add("hr")
    if any(k in all_context for k in ("ride", "driver", "trip", "uber", "flight")):
        tags.add("transportation")
    if any(k in all_context for k in ("song", "listen", "spotify", "music", "streaming")):
        tags.add("entertainment")

    return sorted(list(tags))
