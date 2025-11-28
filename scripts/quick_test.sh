#!/usr/bin/env bash
set -euo pipefail

BASE_URL=${BASE_URL:-http://localhost:8000}

json_pp(){ python3 -c 'import sys,json; print(json.dumps(json.load(sys.stdin), ensure_ascii=False, indent=2))'; }

echo "=== Health Check ==="
curl -s "$BASE_URL/health" | json_pp

echo -e "\n=== Proctoring Events Test ==="
NOW=$(date +%s%3N)
SESSION_ID="test_session_$(date +%s)"

curl -s -X POST "$BASE_URL/api/proctoring/events" \
  -H 'Content-Type: application/json' \
  -d "{\"sessionId\":\"$SESSION_ID\",\"events\":[{\"type\":\"devtools_detected\",\"timestamp\":$NOW,\"metadata\":{}},{\"type\":\"clipboard_paste\",\"timestamp\":$NOW,\"metadata\":{\"textLength\":600}},{\"type\":\"extension_detected\",\"timestamp\":$NOW,\"metadata\":{\"extensionName\":\"GitHub Copilot\"}}],\"urgent\":false}" | json_pp

echo -e "\n=== Risk Score Check ==="
sleep 1
curl -s "$BASE_URL/api/proctoring/score/$SESSION_ID" | json_pp

echo -e "\n=== Code Snapshot (Originality) ==="

curl -s -X POST "$BASE_URL/api/proctoring/code-snapshot" \
  -H 'Content-Type: application/json' \
  -d "{\"sessionId\":\"$SESSION_ID\",\"taskId\":\"task1\",\"code\":\"def hello():\\n    print('Hello World')\",\"language\":\"python\",\"timestamp\":$NOW}" | json_pp

echo -e "\n✅ Quick test complete. SESSION_ID=$SESSION_ID"
echo "Note: Full interview test with LLM takes 30-60s due to SciBox rate limits (2 RPS)"
