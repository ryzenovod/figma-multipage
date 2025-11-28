#!/usr/bin/env bash
set -euo pipefail

BASE_URL=${BASE_URL:-http://localhost:8000}

json_pp(){ python3 -c 'import sys,json; print(json.dumps(json.load(sys.stdin), ensure_ascii=False, indent=2))'; }

step(){ echo -e "\n==== $1 ===="; }

# 1) Health
step "Health"
curl -s "$BASE_URL/" | json_pp || true

# 2) Start interview
step "Start Interview"
START_PAYLOAD='{"resumeText":"Python backend dev, 3y exp, FastAPI, PostgreSQL","jobPosition":"Backend Developer","numTasks":2}'
START_RESP=$(curl -s -X POST "$BASE_URL/api/interview/start" -H 'Content-Type: application/json' -d "$START_PAYLOAD")
echo "$START_RESP" | json_pp || true
SESSION_ID=$(echo "$START_RESP" | python3 -c 'import sys,json; print(json.load(sys.stdin)["session_id"])')
echo "SESSION_ID=$SESSION_ID"

# 3) Submit solution
step "Submit Solution"
SUBMIT_PAYLOAD=$(cat <<JSON
{
  "sessionId": "$SESSION_ID",
  "solutionCode": "def solve():\n    return 42",
  "testResults": {"visible_passed": 2, "hidden_passed": 3},
  "timeSpent": 600
}
JSON
)

curl -s -X POST "$BASE_URL/api/interview/submit-solution" \
  -H 'Content-Type: application/json' \
  -d "$SUBMIT_PAYLOAD" | json_pp || true

# 4) Proctoring events
step "Proctoring Events"
NOW=$(date +%s%3N)
EVENTS_PAYLOAD=$(cat <<JSON
{
  "sessionId": "$SESSION_ID",
  "events": [
    {"type":"devtools_detected","timestamp": $NOW, "metadata": {}},
    {"type":"clipboard_paste","timestamp": $NOW, "metadata": {"textLength": 600}}
  ],
  "urgent": false
}
JSON
)

curl -s -X POST "$BASE_URL/api/proctoring/events" \
  -H 'Content-Type: application/json' \
  -d "$EVENTS_PAYLOAD" | json_pp || true

# 5) Code snapshot (originality)
step "Code Snapshot"
SNAP_PAYLOAD=$(cat <<JSON
{
  "sessionId": "$SESSION_ID",
  "taskId": "task1",
  "code": "def fib(n):\n    return 0 if n==0 else 1 if n==1 else fib(n-1)+fib(n-2)",
  "language": "python",
  "timestamp": $NOW
}
JSON
)

curl -s -X POST "$BASE_URL/api/proctoring/code-snapshot" \
  -H 'Content-Type: application/json' \
  -d "$SNAP_PAYLOAD" | json_pp || true

# 6) Current risk score
step "Risk Score"
sleep 2
curl -s "$BASE_URL/api/proctoring/score/$SESSION_ID" | json_pp || true

echo -e "\nDone. SESSION_ID=$SESSION_ID"
