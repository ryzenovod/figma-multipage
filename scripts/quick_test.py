#!/usr/bin/env python3
"""Quick test for proctoring ML components without slow LLM calls"""
import requests
import json
import time
from datetime import datetime

BASE_URL = "http://localhost:8000"

def print_section(title):
    print(f"\n{'='*60}\n{title}\n{'='*60}")

def print_json(data):
    print(json.dumps(data, indent=2, ensure_ascii=False))

def main():
    session_id = f"test_session_{int(time.time())}"
    timestamp = int(time.time() * 1000)
    
    # 1. Health check
    print_section("Health Check")
    resp = requests.get(f"{BASE_URL}/health")
    print_json(resp.json())
    
    # 2. Proctoring events
    print_section("Proctoring Events (DevTools + Clipboard + Extension)")
    events_payload = {
        "sessionId": session_id,
        "events": [
            {"type": "devtools_detected", "timestamp": timestamp, "metadata": {}},
            {"type": "clipboard_paste", "timestamp": timestamp, "metadata": {"textLength": 600}},
            {"type": "extension_detected", "timestamp": timestamp, "metadata": {"extensionName": "GitHub Copilot"}}
        ],
        "urgent": False
    }
    resp = requests.post(f"{BASE_URL}/api/proctoring/events", json=events_payload)
    print_json(resp.json())
    
    # 3. Risk score
    print_section("Risk Score")
    time.sleep(1)
    resp = requests.get(f"{BASE_URL}/api/proctoring/score/{session_id}")
    print_json(resp.json())
    
    # 4. Code snapshot (will trigger LLM analysis in background)
    print_section("Code Snapshot (Originality Check)")
    snapshot_payload = {
        "sessionId": session_id,
        "taskId": "task1",
        "code": "def hello():\n    print('Hello World')",
        "language": "python",
        "timestamp": timestamp
    }
    resp = requests.post(f"{BASE_URL}/api/proctoring/code-snapshot", json=snapshot_payload)
    print_json(resp.json())
    
    print(f"\n✅ Quick test complete. SESSION_ID={session_id}")
    print("\nNote: Code originality LLM analysis runs in background.")
    print("Full interview test with resume analysis takes 30-60s due to SciBox rate limits.")

if __name__ == "__main__":
    main()
