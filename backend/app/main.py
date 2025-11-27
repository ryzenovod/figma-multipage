from datetime import datetime

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .models import (
    EventEnvelope,
    HealthResponse,
    ParticipantMetrics,
    ParticipantSummary,
    Submission,
    SubmissionResponse,
)
from .scibox_client import SciBoxClient
from .service import ProctoringService

app = FastAPI(title="VibeCode Jam Proctoring", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

scibox_client = SciBoxClient()
service = ProctoringService(scibox_client)


@app.on_event("shutdown")
async def shutdown_event():
    await scibox_client.close()


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(status="ok", timestamp=datetime.utcnow())


@app.post("/events", response_model=ParticipantMetrics)
async def ingest_event(envelope: EventEnvelope) -> ParticipantMetrics:
    return service.ingest_event(envelope)


@app.websocket("/ws/events")
async def websocket_events(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            payload = await websocket.receive_json()
            envelope = EventEnvelope(**payload)
            metrics = service.ingest_event(envelope)
            await websocket.send_json(metrics.dict())
    except WebSocketDisconnect:
        return


@app.post("/participants/{participant_id}/submission", response_model=SubmissionResponse)
async def analyze_submission(participant_id: str, submission: Submission) -> SubmissionResponse:
    submission_data = submission.dict()
    submission_data["participant_id"] = participant_id
    metrics = await service.analyze_submission(Submission(**submission_data))
    return SubmissionResponse(participant_id=participant_id, verdict=metrics.ai_verdict, risk_score=metrics.risk_score)


@app.get("/participants/{participant_id}", response_model=ParticipantMetrics)
async def get_participant(participant_id: str) -> ParticipantMetrics:
    return service.get_metrics(participant_id)


@app.get("/participants", response_model=list[ParticipantSummary])
async def list_participants():
    return service.list_participants()
