# MyWorkbench — SQL Interview Practice System

An interactive SQL practice platform and test validation suite for 100 MySQL 8.0 interview problems.

## 🚀 Running from the Terminal

### 1. Launch the Interactive Web Platform

```bash
# From workspace root:
python3 MyWorkbench/cli.py serve

# Or directly from inside MyWorkbench/:
python3 cli.py serve

# Or via server script:
python3 web/server.py 8080
```
Open **http://127.0.0.1:8080** in your browser.

---

### 2. CLI Practice & Validation

```bash
# List all questions (with optional filters: --difficulty easy|medium|hard, --tag <tag>)
python3 cli.py list --difficulty easy

# Show details, schema, and sample data for a question
python3 cli.py show matching-skills

# Run and validate custom SQL against edge test cases
python3 cli.py run matching-skills --sql "SELECT candidate_id FROM candidates WHERE skill IN ('Python', 'Tableau', 'PostgreSQL') GROUP BY candidate_id HAVING COUNT(DISTINCT skill) = 3 ORDER BY candidate_id ASC;"

# Validate reference solution for a question
python3 cli.py validate matching-skills

# Validate all 100 questions
python3 cli.py validate-all

# View dataset statistics
python3 cli.py stats
```
