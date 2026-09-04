#!/usr/bin/env python3
import os
import re

SKIP_DIRS = {".git", "node_modules", ".venv", "venv", "dist", "build", "target", "__pycache__"}


def _shallow_glob(filename, max_depth=2):
    """Find `filename` up to `max_depth` levels down, skipping vendor directories."""
    from pathlib import Path
    root = Path(".")
    for depth in range(1, max_depth + 1):
        for match in root.glob("/".join(["*"] * depth) + "/" + filename):
            if not any(part in SKIP_DIRS for part in match.parts):
                yield match


def detect_tech_stack():
    languages = []
    frameworks = []
    databases = []
    package_managers = []

    # 1. Scan for Package Managers and Language Files
    files_in_root = os.listdir(".") if os.path.exists(".") else []
    
    # Check for cargo/rust
    has_rust = False
    if os.path.exists("Cargo.toml") or any(p.name == "Cargo.toml" for p in _shallow_glob("Cargo.toml")):
        has_rust = True
        languages.append("Rust")
        package_managers.append("cargo")

    # Check for node/js/ts
    has_js = False
    has_ts = False
    if os.path.exists("package.json") or any(p.name == "package.json" for p in _shallow_glob("package.json")):
        has_js = True
        if os.path.exists("tsconfig.json") or any(p.name == "tsconfig.json" for p in _shallow_glob("tsconfig.json")):
            has_ts = True
            languages.append("TypeScript")
        else:
            languages.append("JavaScript")

    # Check for python
    if os.path.exists("pyproject.toml") or os.path.exists("requirements.txt") or any(f.endswith(".py") for f in files_in_root):
        languages.append("Python")

    # Check for go
    if os.path.exists("go.mod"):
        languages.append("Go")

    # 2. Check lockfiles for package managers
    # Check JS package managers
    js_lockfiles = {
        "pnpm-lock.yaml": "pnpm",
        "yarn.lock": "yarn",
        "package-lock.json": "npm"
    }
    
    # Search recursively up to 2 levels for lockfiles
    for root, dirs, files in os.walk(".", topdown=True):
        depth = root.count(os.sep)
        if depth > 2:
            del dirs[:]  # Don't go deeper
            continue
        
        for lf, pm in js_lockfiles.items():
            if lf in files and pm not in package_managers:
                package_managers.append(pm)
        if "uv.lock" in files and "uv" not in package_managers:
            package_managers.append("uv")
        if "poetry.lock" in files and "poetry" not in package_managers:
            package_managers.append("poetry")

    # Fallbacks if no lockfiles found but package.json exists
    if has_js and not any(pm in package_managers for pm in ["pnpm", "yarn", "npm"]):
        package_managers.append("pnpm")  # default

    # 3. Detect Frameworks
    # Tauri check
    has_tauri = False
    for root, dirs, files in os.walk("."):
        if root.count(os.sep) > 3:
            continue
        if "tauri.conf.json" in files or "src-tauri" in dirs:
            has_tauri = True
            break
            
    if has_tauri:
        frameworks.append("Tauri")
    
    # Next.js/Vite checks
    for root, dirs, files in os.walk("."):
        if root.count(os.sep) > 2:
            continue
        if any(f.startswith("next.config") for f in files):
            frameworks.append("Next.js")
        if any(f.startswith("vite.config") for f in files):
            frameworks.append("Vite")

    # 4. Detect Databases
    # Read package.json and Cargo.toml to look for db drivers
    db_keywords = {
        "SQLite": ["sqlite", "sqlite3", "better-sqlite3", "rusqlite", "sqlx-sqlite"],
        "PostgreSQL": ["pg", "postgres", "postgresql", "sqlx-postgres", "diesel"],
        "MongoDB": ["mongodb", "mongoose"],
        "MySQL": ["mysql", "mysql2", "sqlx-mysql"]
    }
    
    detected_dbs = []
    
    # Scan all package.json and Cargo.toml files in the repo (up to 3 levels deep)
    for root, dirs, files in os.walk("."):
        if root.count(os.sep) > 3:
            continue
        for file in files:
            if file in ["package.json", "Cargo.toml"]:
                try:
                    with open(os.path.join(root, file), "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read().lower()
                        for db_name, keywords in db_keywords.items():
                            if any(kw in content for kw in keywords):
                                if db_name not in detected_dbs:
                                    detected_dbs.append(db_name)
                except Exception:
                    pass

    if detected_dbs:
        databases.extend(detected_dbs)
    else:
        # Fallback check for SQLite database files
        for root, dirs, files in os.walk("."):
            if root.count(os.sep) > 2:
                continue
            if any(f.endswith(".db") or f.endswith(".sqlite") or f.endswith(".sqlite3") for f in files):
                databases.append("SQLite")
                break

    # Format the results
    lang_str = " / ".join(languages) if languages else "TypeScript"
    fw_str = " / ".join(frameworks) if frameworks else "(None)"
    db_str = " / ".join(databases) if databases else "(None)"
    pm_str = " / ".join(package_managers) if package_managers else "pnpm"

    return {
        "language": lang_str,
        "framework": fw_str,
        "database": db_str,
        "package_mgr": pm_str
    }

def update_ai_rules(detected):
    files = ["CLAUDE.md", "GEMINI.md", ".agents/AGENTS.md"]
    
    new_table = f"""## Tech Stack
 
| Layer      | Technology                     |
|------------|-------------------------------|
| Language   | {detected['language']:<30} |
| Framework  | {detected['framework']:<30} |
| Database   | {detected['database']:<30} |
| Package Mgr| {detected['package_mgr']:<30} |"""

    for filepath in files:
        if not os.path.exists(filepath):
            continue
            
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()

        # Regular expression to match any "## Tech Stack" table block
        # It matches from "## Tech Stack" down to the next section or empty line
        pattern = r"## Tech Stack\s*\n\s*\|.*?(?=\n\n|\n##|$)"
        
        if re.search(pattern, content, re.DOTALL):
            updated_content = re.sub(pattern, new_table, content, flags=re.DOTALL)
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(updated_content)
            print(f"✅ Dynamically updated tech stack in {filepath}")
        else:
            print(f"⚠️ Could not find Tech Stack table in {filepath}")

def main():
    print("🔍 Auto-detecting project tech stack...")
    detected = detect_tech_stack()
    print(f"  Detected Language(s):    {detected['language']}")
    print(f"  Detected Framework(s):   {detected['framework']}")
    print(f"  Detected Database(s):    {detected['database']}")
    print(f"  Detected Package Mgr(s): {detected['package_mgr']}")
    
    print("\nUpdating AI memory files...")
    update_ai_rules(detected)
    print("Done! 🎉")

if __name__ == "__main__":
    main()
