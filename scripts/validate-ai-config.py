#!/usr/bin/env python3
"""Validate this project's AI agent configuration.

Runs against a deployed project (not the template repo). Checks that the shared rules file
exists and is filled in, that every agent config parses, and that JSON configs are valid.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)
TOKEN_RE = re.compile(r"\{\{[A-Z_]+\}\}")

errors: list[str] = []
warnings: list[str] = []


def err(msg: str) -> None:
    errors.append(msg); print(f"ERROR    {msg}")


def warn(msg: str) -> None:
    warnings.append(msg); print(f"WARNING  {msg}")


def parse_frontmatter(text: str) -> dict[str, str] | None:
    match = FRONTMATTER_RE.match(text)
    if not match:
        return None
    data, key, buf = {}, None, []
    for line in match.group(1).split("\n"):
        kv = re.match(r"^([A-Za-z0-9_-]+)\s*:\s*(.*)$", line)
        if kv:
            if key:
                data[key] = " ".join(buf).strip()
            key, val = kv.group(1), kv.group(2).strip()
            buf = [] if val in (">", "|") else [val]
        elif key and line.strip():
            buf.append(line.strip())
    if key:
        data[key] = " ".join(buf).strip()
    return data


def check_shared_rules() -> None:
    agents = ROOT / "AGENTS.md"
    if not agents.is_file():
        err("AGENTS.md is missing — it is the shared source of truth for every agent")
        return
    leftover = sorted(set(TOKEN_RE.findall(agents.read_text(encoding="utf-8"))))
    if leftover:
        warn(f"AGENTS.md still has unfilled placeholders: {', '.join(leftover)} "
             f"— run scripts/bootstrap-ai-project.py")


def check_placeholders() -> None:
    for name in ("README.md", "docs/ARCHITECTURE.md"):
        path = ROOT / name
        if not path.is_file():
            continue
        leftover = sorted(set(TOKEN_RE.findall(path.read_text(encoding="utf-8"))))
        if leftover:
            warn(f"{name} still has unfilled placeholders: {', '.join(leftover)}")


def check_json() -> None:
    for name in (".mcp.json", "opencode.json", ".claude/settings.json"):
        path = ROOT / name
        if not path.is_file():
            continue
        try:
            json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            err(f"{name} is not valid JSON: {exc} (comments are not allowed)")


def check_frontmatter_dir(rel: str, pattern: str, label: str) -> None:
    directory = ROOT / rel
    if not directory.is_dir():
        return
    for path in sorted(directory.glob(pattern)):
        if path.name == "README.md":
            continue
        data = parse_frontmatter(path.read_text(encoding="utf-8"))
        shown = path.relative_to(ROOT)
        if data is None:
            err(f"{shown}: {label} has no YAML frontmatter")
            continue
        for field in ("name", "description"):
            if not data.get(field):
                err(f"{shown}: {label} frontmatter is missing '{field}'")


def check_required() -> None:
    required = [
        ("docs/tests/TEST_REGISTRY.md", "test registry"),
        ("docs/rules/coding-style.md", "coding style rules"),
        ("docs/rules/security.md", "security rules"),
    ]
    for rel, label in required:
        if not (ROOT / rel).is_file():
            err(f"{rel} is missing ({label})")


def check_secrets() -> None:
    if (ROOT / ".env").is_file():
        gitignore = ROOT / ".gitignore"
        ignored = gitignore.is_file() and ".env" in gitignore.read_text(encoding="utf-8")
        if not ignored:
            err(".env exists but is not listed in .gitignore — secrets could be committed")


def main() -> int:
    print("Validating AI configuration\n===========================")
    check_shared_rules()
    check_placeholders()
    check_json()
    check_frontmatter_dir("skills", "*/SKILL.md", "skill")
    check_frontmatter_dir(".claude/agents", "*.md", "agent")
    check_frontmatter_dir(".claude/skills", "*/SKILL.md", "skill")
    check_frontmatter_dir(".agents/skills", "*/SKILL.md", "skill")
    check_required()
    check_secrets()
    print(f"\nErrors: {len(errors)}   Warnings: {len(warnings)}")
    if errors:
        print("AI configuration validation FAILED.")
        return 1
    print("AI configuration validation passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
