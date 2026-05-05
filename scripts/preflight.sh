#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
CONDA_ENV_NAME="${CONDA_ENV_NAME:-novel_agent}"

python_cmd=(python)
if command -v conda >/dev/null 2>&1 && conda env list | awk '{print $1}' | grep -qx "$CONDA_ENV_NAME"; then
  python_cmd=(conda run -n "$CONDA_ENV_NAME" python)
fi

echo "==> Python compile check"
(
  cd "$ROOT_DIR"
  "${python_cmd[@]}" -m compileall -q backend tests
)

echo "==> Backend unit tests"
(
  cd "$ROOT_DIR"
  "${python_cmd[@]}" -m unittest discover -s tests -p "test*.py"
)

echo "==> Frontend dependency install"
(
  cd "$FRONTEND_DIR"
  npm ci
)

echo "==> Frontend lint"
(
  cd "$FRONTEND_DIR"
  npm run lint
)

echo "==> Frontend tests"
(
  cd "$FRONTEND_DIR"
  npm run test:run
)

echo "==> Frontend production build"
(
  cd "$FRONTEND_DIR"
  npm run build
)

if [[ "${1:-}" == "--storybook" ]]; then
  echo "==> Storybook build"
  (
    cd "$FRONTEND_DIR"
    npm run build-storybook
  )
fi

echo "==> Preflight checks passed"
