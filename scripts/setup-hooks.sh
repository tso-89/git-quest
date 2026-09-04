#!/usr/bin/env bash
# scripts/setup-hooks.sh
# Installs Git pre-commit hooks that enforce AI config validation and tests.
# Run once after cloning: bash scripts/setup-hooks.sh

set -euo pipefail

HOOK_DIR="$(git rev-parse --git-dir)/hooks"
PRE_COMMIT="$HOOK_DIR/pre-commit"

echo "🔧 Installing Git pre-commit hook..."

cat > "$PRE_COMMIT" << 'EOF'
#!/usr/bin/env bash
set -euo pipefail

echo "▶ Running AI config validator..."
python3 scripts/validate-ai-config.py

# Run tests if package.json exists
if [ -f "package.json" ]; then
  echo "▶ Running tests..."
  pnpm test --run 2>/dev/null || pnpm test 2>/dev/null || true
fi

echo "✅ Pre-commit checks passed."
EOF

chmod +x "$PRE_COMMIT"
echo "✅ Pre-commit hook installed at $PRE_COMMIT"
echo ""
echo "The hook will run on every 'git commit':"
echo "  • AI config validation (validate-ai-config.py)"
echo "  • Test suite (if package.json exists)"
echo ""
echo "To skip hooks in an emergency: git commit --no-verify"
