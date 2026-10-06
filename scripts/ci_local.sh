#!/usr/bin/env bash
set -euo pipefail

# Use the project root even when this script is invoked from another directory.
cd "$(dirname "${BASH_SOURCE[0]}")/.."

pnpm lint
pnpm format:check
pnpm typecheck
pnpm test:run
pnpm build
