#!/bin/sh
# QuickSlot container: build the site if needed, then run the server (API and website on one port).
#
# The image ships a site built with no SITE_URL and every tool. When SITE_URL, HIDE_TOOLS or SHOW_TOOLS are set
# to something else, the site is built again here first (about half a minute), and only again when they change.
set -eu

cd /app
want="SITE_URL=${SITE_URL:-}
HIDE_TOOLS=${HIDE_TOOLS:-}
SHOW_TOOLS=${SHOW_TOOLS:-}"
stamp=/app/.build-config
have=$(cat "$stamp" 2>/dev/null || true)

if [ "$want" != "$have" ]; then
  echo "[quickslot] building the site for:" $want
  rm -f "$stamp"
  NODE_ENV=production npm run build -w apps/web --silent
  printf '%s' "$want" > "$stamp"
  echo "[quickslot] site built"
fi

exec node apps/api/src/index.ts
