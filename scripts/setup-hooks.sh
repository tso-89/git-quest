#!/usr/bin/env bash
# scripts/setup-hooks.sh
# Installs a pre-commit hook that keeps the published site honest.
# Run once after cloning: bash scripts/setup-hooks.sh

set -euo pipefail

HOOK_DIR="$(git rev-parse --git-dir)/hooks"
PRE_COMMIT="$HOOK_DIR/pre-commit"

echo "Installing pre-commit hook..."

cat > "$PRE_COMMIT" << 'HOOK'
#!/usr/bin/env bash
set -euo pipefail

echo "> AI config validator"
python3 scripts/validate-ai-config.py

if [ -f package.json ]; then
  echo "> Rebuilding index.html"
  npm run --silent build > /dev/null

  # GitHub Pages serves the committed index.html directly. If a src/ change is
  # committed without rebuilding, the published lesson silently goes stale.
  if ! git diff --quiet -- index.html; then
    echo
    echo "index.html is out of date with src/."
    echo "It has just been rebuilt. Stage it and commit again:"
    echo
    echo "    git add index.html"
    echo
    exit 1
  fi

  echo "> Tests"
  npm test
fi

echo "Pre-commit checks passed."
HOOK

chmod +x "$PRE_COMMIT"
echo "Installed at $PRE_COMMIT"
echo
echo "On every commit it will:"
echo "  - validate the AI configuration"
echo "  - rebuild index.html and refuse the commit if it was stale"
echo "  - run the full test suite"
echo
echo "To skip in an emergency: git commit --no-verify"
