#!/usr/bin/env bash
#
# Sync SigNoz dashboards from local JSON files.
#
# Usage:
#   ./monitoring/sync-dashboards.sh                     # uses SIGNOZ_ENDPOINT env var
#   ./monitoring/sync-dashboards.sh https://signoz.example.com
#
# Environment:
#   SIGNOZ_ENDPOINT  — SigNoz base URL (e.g. https://signoz.example.com)
#   SIGNOZ_TOKEN     — Optional bearer token for authenticated instances
#
# Each dashboard JSON in monitoring/dashboards/ is upserted:
#   - If a dashboard with the same title exists, it is updated.
#   - If not, a new dashboard is created.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DASHBOARDS_DIR="$SCRIPT_DIR/dashboards"
ENDPOINT="${1:-${SIGNOZ_ENDPOINT:-}}"

if [ -z "$ENDPOINT" ]; then
  echo "Error: SIGNOZ_ENDPOINT not set and no argument provided."
  echo "Usage: $0 <signoz-base-url>"
  exit 1
fi

AUTH_HEADER=""
if [ -n "${SIGNOZ_TOKEN:-}" ]; then
  AUTH_HEADER="Authorization: Bearer $SIGNOZ_TOKEN"
fi

curl_opts=(-s -S -H "Content-Type: application/json")
if [ -n "$AUTH_HEADER" ]; then
  curl_opts+=(-H "$AUTH_HEADER")
fi

echo "Syncing dashboards to $ENDPOINT"

# Fetch existing dashboards
existing=$(curl "${curl_opts[@]}" "$ENDPOINT/api/v1/dashboards" 2>/dev/null || echo '[]')

for file in "$DASHBOARDS_DIR"/*.json; do
  [ -f "$file" ] || continue

  title=$(jq -r '.title' "$file")
  echo ""
  echo "Processing: $title ($(basename "$file"))"

  # Check if dashboard with this title already exists
  dashboard_id=$(echo "$existing" | jq -r --arg t "$title" '.[] | select(.data.title == $t) | .uuid // empty' 2>/dev/null | head -1)

  # Wrap the dashboard JSON in SigNoz's expected format
  payload=$(jq '{data: .}' "$file")

  if [ -n "$dashboard_id" ]; then
    echo "  Updating existing dashboard (id: $dashboard_id)"
    response=$(curl "${curl_opts[@]}" -X PUT "$ENDPOINT/api/v1/dashboards/$dashboard_id" -d "$payload" 2>&1)
  else
    echo "  Creating new dashboard"
    response=$(curl "${curl_opts[@]}" -X POST "$ENDPOINT/api/v1/dashboards" -d "$payload" 2>&1)
  fi

  # Check for errors
  if echo "$response" | jq -e '.error' >/dev/null 2>&1; then
    echo "  ERROR: $(echo "$response" | jq -r '.error')"
  else
    new_id=$(echo "$response" | jq -r '.uuid // .data.uuid // "unknown"' 2>/dev/null)
    echo "  OK (id: $new_id)"
  fi
done

echo ""
echo "Dashboard sync complete."
