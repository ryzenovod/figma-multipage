from __future__ import annotations

from datetime import datetime
from typing import Dict, List

from .models import (
    AIVerdict,
    DevToolsEvent,
    EventEnvelope,
    EventType,
    ExtensionEvent,
    ParticipantMetrics,
    ParticipantSummary,
    PasteEvent,
    Submission,
)
from .scibox_client import SciBoxClient


class ParticipantState:
    def __init__(self, participant_id: str):
        self.participant_id = participant_id
        self.paste_events: int = 0
        self.paste_volume: int = 0
        self.large_pastes: int = 0
        self.suspicious_extensions: List[str] = []
        self.devtools_opened: bool = False
        self.ai_verdict: AIVerdict | None = None
        self.updated_at: datetime = datetime.utcnow()

    def to_metrics(self) -> ParticipantMetrics:
        return ParticipantMetrics(
            participant_id=self.participant_id,
            paste_events=self.paste_events,
            paste_volume=self.paste_volume,
            large_pastes=self.large_pastes,
            suspicious_extensions=self.suspicious_extensions,
            devtools_opened=self.devtools_opened,
            ai_verdict=self.ai_verdict,
            risk_score=self.calculate_risk(),
            updated_at=self.updated_at,
        )

    def calculate_risk(self) -> int:
        score = 0
        if self.large_pastes > 0:
            score += 25
        if self.paste_events > 5:
            score += 20
        if self.suspicious_extensions:
            score += 30
        if self.ai_verdict and self.ai_verdict.is_copied:
            score += 50
        if self.devtools_opened:
            score = min(score + 10, 100)
        return min(score, 100)


class ProctoringService:
    def __init__(self, scibox_client: SciBoxClient):
        self._participants: Dict[str, ParticipantState] = {}
        self._scibox = scibox_client

    def _get_state(self, participant_id: str) -> ParticipantState:
        if participant_id not in self._participants:
            self._participants[participant_id] = ParticipantState(participant_id)
        return self._participants[participant_id]

    def ingest_event(self, envelope: EventEnvelope) -> ParticipantMetrics:
        if envelope.type == EventType.paste:
            event = PasteEvent(**envelope.payload)
            return self._handle_paste(event)
        if envelope.type == EventType.extension:
            event = ExtensionEvent(**envelope.payload)
            return self._handle_extension(event)
        if envelope.type == EventType.devtools:
            event = DevToolsEvent(**envelope.payload)
            return self._handle_devtools(event)
        raise ValueError(f"Unsupported event type: {envelope.type}")

    def _handle_paste(self, event: PasteEvent) -> ParticipantMetrics:
        state = self._get_state(event.participant_id)
        state.paste_events += 1
        state.paste_volume += event.length
        if event.length > 500:
            state.large_pastes += 1
        state.updated_at = event.timestamp
        return state.to_metrics()

    def _handle_extension(self, event: ExtensionEvent) -> ParticipantMetrics:
        state = self._get_state(event.participant_id)
        if event.extension_name not in state.suspicious_extensions:
            state.suspicious_extensions.append(event.extension_name)
        state.updated_at = event.timestamp
        return state.to_metrics()

    def _handle_devtools(self, event: DevToolsEvent) -> ParticipantMetrics:
        state = self._get_state(event.participant_id)
        state.devtools_opened = state.devtools_opened or event.opened
        state.updated_at = event.timestamp
        return state.to_metrics()

    async def analyze_submission(self, submission: Submission) -> ParticipantMetrics:
        state = self._get_state(submission.participant_id)
        verdict = await self._scibox.score_originality(submission.code, submission.language)
        state.ai_verdict = verdict
        state.updated_at = submission.timestamp
        return state.to_metrics()

    def list_participants(self) -> List[ParticipantSummary]:
        result: List[ParticipantSummary] = []
        for participant in self._participants.values():
            metrics = participant.to_metrics()
            result.append(
                ParticipantSummary(
                    participant_id=metrics.participant_id,
                    risk_score=metrics.risk_score,
                    paste_events=metrics.paste_events,
                    devtools_opened=metrics.devtools_opened,
                    suspicious_extensions=metrics.suspicious_extensions,
                    ai_status=None if not metrics.ai_verdict else (
                        "copied" if metrics.ai_verdict.is_copied else "original"
                    ),
                )
            )
        return sorted(result, key=lambda p: p.risk_score, reverse=True)

    def get_metrics(self, participant_id: str) -> ParticipantMetrics:
        return self._get_state(participant_id).to_metrics()
