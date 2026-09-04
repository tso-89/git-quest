#!/usr/bin/env python3
"""Fill in this project's template placeholders.

Every templated value is a double-brace marker. This script walks the project and replaces
each one in place, so adding a new templated value means adding the marker to a file — no
change is needed here. Run once after deploying the template.
"""
import argparse
import datetime
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

SKIP_DIRS = {".git", "node_modules", ".venv", "venv", "dist", "build", "__pycache__"}
TEXT_SUFFIXES = {".md", ".json", ".yml", ".yaml", ".toml", ".txt", ".example", ".sh", ".py"}

TOKEN_RE = re.compile(r"\{\{([A-Z_]+)\}\}")

COMMANDS = {
    "pnpm":   ("pnpm install", "pnpm dev", "pnpm test", "pnpm lint", "pnpm format", "pnpm build"),
    "npm":    ("npm install", "npm run dev", "npm test", "npm run lint", "npm run format", "npm run build"),
    "yarn":   ("yarn install", "yarn dev", "yarn test", "yarn lint", "yarn format", "yarn build"),
    "bun":    ("bun install", "bun dev", "bun test", "bun run lint", "bun run format", "bun run build"),
    "uv":     ("uv sync", "uv run python src/main.py", "uv run pytest",
               "uv run ruff check", "uv run ruff format", "# no build step"),
    "poetry": ("poetry install", "poetry run python src/main.py", "poetry run pytest",
               "poetry run ruff check", "poetry run ruff format", "poetry build"),
    "cargo":  ("cargo fetch", "cargo run", "cargo test", "cargo clippy", "cargo fmt", "cargo build --release"),
    "go":     ("go mod download", "go run ./...", "go test ./...", "go vet ./...", "gofmt -w .", "go build ./..."),
}


def ask(prompt: str, default: str) -> str:
    return input(f"{prompt} [{default}]: ").strip() or default


def command_set(package_mgr: str) -> tuple[str, ...]:
    key = package_mgr.lower()
    if key in COMMANDS:
        return COMMANDS[key]
    return (f"{package_mgr} install", f"{package_mgr} dev", f"{package_mgr} test",
            f"{package_mgr} lint", f"{package_mgr} format", f"{package_mgr} build")


def candidate_files() -> list[Path]:
    out = []
    for path in ROOT.rglob("*"):
        if not path.is_file() or any(part in SKIP_DIRS for part in path.parts):
            continue
        if path.suffix in TEXT_SUFFIXES or path.name in {"LICENSE", ".gitignore", ".env.example"}:
            out.append(path)
    return sorted(out)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("-n", "--name", help="Project name")
    parser.add_argument("--desc", help="Short project description")
    parser.add_argument("-l", "--language", help="Language (e.g. TypeScript, Python, Go)")
    parser.add_argument("-f", "--framework", help="Framework (e.g. Next.js, FastAPI)")
    parser.add_argument("-d", "--database", help="Database (e.g. PostgreSQL, SQLite)")
    parser.add_argument("-p", "--package-mgr", help="Package manager (e.g. pnpm, uv, cargo)")
    parser.add_argument("--non-interactive", action="store_true", help="Use defaults, do not prompt")
    parser.add_argument("--dry-run", action="store_true", help="Report what would change, write nothing")
    args = parser.parse_args()

    print("Project bootstrapper\n====================")

    if args.non_interactive:
        name, desc = args.name or "My Project", args.desc or "A new project."
        language, framework = args.language or "TypeScript", args.framework or "Next.js"
        database, package_mgr = args.database or "PostgreSQL", args.package_mgr or "pnpm"
    else:
        name = ask("Project name", args.name or "My Project")
        desc = ask("Description", args.desc or "A new project.")
        language = ask("Language", args.language or "TypeScript")
        framework = ask("Framework", args.framework or "Next.js")
        database = ask("Database", args.database or "PostgreSQL")
        package_mgr = ask("Package manager", args.package_mgr or "pnpm")

    install, dev, test, lint, fmt, build = command_set(package_mgr)
    values = {
        "PROJECT_NAME": name,
        "PROJECT_DESCRIPTION": desc,
        "LANGUAGE": language,
        "FRAMEWORK": framework,
        "DATABASE": database,
        "PACKAGE_MANAGER": package_mgr,
        "CMD_INSTALL": install,
        "CMD_DEV": dev,
        "CMD_TEST": test,
        "CMD_LINT": lint,
        "CMD_FORMAT": fmt,
        "CMD_BUILD": build,
        "DATE": datetime.date.today().isoformat(),
        "YEAR": str(datetime.date.today().year),
    }

    print("\nConfiguration:")
    for key in ("PROJECT_NAME", "LANGUAGE", "FRAMEWORK", "DATABASE", "PACKAGE_MANAGER"):
        print(f"  {key:<18} {values[key]}")

    unknown: set[str] = set()
    changed = 0
    print()
    for path in candidate_files():
        original = path.read_text(encoding="utf-8", errors="replace")
        found = set(TOKEN_RE.findall(original))
        if not found:
            continue
        unknown |= found - values.keys()
        updated = TOKEN_RE.sub(lambda m: values.get(m.group(1), m.group(0)), original)
        if updated == original:
            continue
        if not args.dry_run:
            path.write_text(updated, encoding="utf-8")
        changed += 1
        print(f"  updated  {path.relative_to(ROOT)}")

    verb = "would update" if args.dry_run else "updated"
    print(f"\n{verb} {changed} file(s).")
    if unknown:
        print(f"WARNING: no value for token(s): {', '.join(sorted(unknown))}", file=sys.stderr)
        return 1
    if changed == 0:
        print("Nothing to do — this project has already been bootstrapped.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
