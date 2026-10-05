"""Thin wrapper around the repository-level fetch_medium.py script."""
import sys
import os

repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, repo_root)

if __name__ == "__main__":
    import fetch_medium
    fetch_medium.main()
