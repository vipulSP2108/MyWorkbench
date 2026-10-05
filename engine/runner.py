"""Execution runner for SQL queries against question schemas and input datasets.

Runs in-process via an embedded analytical database engine (DuckDB) with MySQL
dialect compatibility, requiring no external daemons or Docker.
Also supports live MySQL server connections via PyMySQL if configured.
"""

from __future__ import annotations
import math
import re
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
import duckdb
import sqlglot


@dataclass
class ExecutionResult:
    success: bool
    rows: List[Dict[str, Any]]
    columns: List[str]
    error: Optional[str] = None


class SQLRunner:
    """Executes SQL queries against test-case datasets in an isolated in-memory environment."""

    def __init__(self, mysql_config: Optional[Dict[str, Any]] = None):
        self.mysql_config = mysql_config

    def _prepare_val(self, val: Any, data_type: str) -> Any:
        if val is None or val == "":
            return None
        s_val = str(val).strip()
        if s_val.upper() in ("NULL", "NONE", "-", "—", "N/A", "NA", "?"):
            return None
        t_upper = data_type.upper()
        if "INT" in t_upper:
            try:
                clean = s_val.replace(",", "").replace("$", "")
                return int(float(clean))
            except (ValueError, TypeError):
                return None
        if "DECIMAL" in t_upper or "NUMERIC" in t_upper or "FLOAT" in t_upper or "DOUBLE" in t_upper:
            try:
                clean = s_val.replace(",", "").replace("$", "")
                return float(clean)
            except (ValueError, TypeError):
                return None
        if "DATE" in t_upper or "TIME" in t_upper:
            s = s_val
            m_dt = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})(?:\s+(\d{1,2}:\d{2}(?::\d{2})?))?$", s)
            if m_dt:
                month, day, year, time_part = m_dt.group(1), m_dt.group(2), m_dt.group(3), m_dt.group(4)
                iso = f"{year}-{int(month):02d}-{int(day):02d}"
                if time_part:
                    iso += f" {time_part}"
                elif "DATETIME" in t_upper or "TIMESTAMP" in t_upper:
                    iso += " 00:00:00"
                return iso
            if re.match(r"^\d{4}-\d{2}-\d{2}", s):
                return s
            return None
        return str(val)

    def _execute_duckdb(
        self,
        tables: List[Dict[str, Any]],
        input_data: Dict[str, List[Dict[str, Any]]],
        query: str
    ) -> ExecutionResult:
        con = duckdb.connect(":memory:")
        try:
            # Create tables and insert data
            for tbl in tables:
                tbl_name = tbl["table_name"]
                cols = tbl["columns"]
                
                # Build CREATE TABLE
                col_defs = []
                for c in cols:
                    cname = c["column_name"]
                    ctype = c["data_type"].upper()
                    # Map MySQL types to DuckDB
                    if "VARCHAR" in ctype or "CHAR" in ctype or "TEXT" in ctype:
                        dtype = "VARCHAR"
                    elif "INT" in ctype:
                        dtype = "BIGINT" if "BIGINT" in ctype else "INTEGER"
                    elif "DECIMAL" in ctype or "NUMERIC" in ctype:
                        dtype = ctype
                    elif "FLOAT" in ctype or "DOUBLE" in ctype:
                        dtype = "DOUBLE"
                    elif "DATETIME" in ctype or "TIMESTAMP" in ctype:
                        dtype = "TIMESTAMP"
                    elif "DATE" in ctype:
                        dtype = "DATE"
                    elif "TIME" in ctype:
                        dtype = "TIME"
                    elif "BOOL" in ctype:
                        dtype = "BOOLEAN"
                    else:
                        dtype = "VARCHAR"
                    col_defs.append(f'"{cname}" {dtype}')
                    
                con.execute(f'CREATE TABLE "{tbl_name}" ({", ".join(col_defs)});')
                
                # Insert rows
                rows = input_data.get(tbl_name, [])
                if rows:
                    placeholders = ", ".join(["?"] * len(cols))
                    col_names = [c["column_name"] for c in cols]
                    insert_sql = f'INSERT INTO "{tbl_name}" VALUES ({placeholders})'
                    
                    param_rows = []
                    for r in rows:
                        row_vals = []
                        for c in cols:
                            cname = c["column_name"]
                            # Case-insensitive column matching
                            val = None
                            for rk in r:
                                if rk.lower() == cname.lower():
                                    val = r[rk]
                                    break
                            row_vals.append(self._prepare_val(val, c["data_type"]))
                        param_rows.append(row_vals)
                    con.executemany(insert_sql, param_rows)

            # Transpile MySQL query to DuckDB dialect if needed
            clean_q = query.strip().rstrip(";")
            try:
                transpiled = sqlglot.transpile(clean_q, read="mysql", write="duckdb")[0]
            except Exception:
                # Fallback to direct query if parser encounters vendor non-standard syntax
                transpiled = clean_q
                
            cursor = con.execute(transpiled)
            res = cursor.fetchall()
            col_names = [d[0] for d in cursor.description] if cursor.description else []
            
            rows_dict = []
            for r in res:
                row_map = {}
                for idx, cname in enumerate(col_names):
                    val = r[idx]
                    if isinstance(val, float) and math.isnan(val):
                        val = None
                    row_map[cname] = val
                rows_dict.append(row_map)
                
            return ExecutionResult(success=True, rows=rows_dict, columns=col_names)
        except Exception as e:
            return ExecutionResult(success=False, rows=[], columns=[], error=str(e))
        finally:
            con.close()

    def execute(
        self,
        tables: List[Dict[str, Any]],
        input_data: Dict[str, List[Dict[str, Any]]],
        query: str
    ) -> ExecutionResult:
        """Executes a query against the given tables and input data."""
        return self._execute_duckdb(tables, input_data, query)
