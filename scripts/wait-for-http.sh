#!/usr/bin/env bash
#
# Poll a URL until it answers 2xx, or fail after the timeout.
#   ./scripts/wait-for-http.sh http://localhost:8000/health 60
#
set -euo pipefail

URL="${1:?usage: wait-for-http.sh <url> [timeout-seconds]}"
TIMEOUT="${2:-60}"
DEADLINE=$((SECONDS + TIMEOUT))

while ((SECONDS < DEADLINE)); do
  if curl -fsS --max-time 3 -o /dev/null "$URL"; then
    echo "Ready: $URL"
    exit 0
  fi
  sleep 1
done

echo "Timed out after ${TIMEOUT}s waiting for $URL" >&2
exit 1
