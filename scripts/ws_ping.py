import asyncio, os, json
import websockets

BASE_URL = os.environ.get("BASE_URL", "ws://localhost:8000")
SESSION_ID = os.environ.get("SESSION_ID")

if not SESSION_ID:
    raise SystemExit("Set SESSION_ID env var to an active session id")

async def main():
    uri = f"{BASE_URL}/api/proctoring/ws/{SESSION_ID}"
    print(f"Connecting to {uri}")
    async with websockets.connect(uri) as ws:
        await ws.send(json.dumps({"type": "ping"}))
        for _ in range(5):
            msg = await ws.recv()
            print("WS:", msg)

if __name__ == "__main__":
    asyncio.run(main())
