from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class EventType(str, Enum):
    paste = "paste"
    extension = "extension"
    devtools = "devtools"
    submission = "submission"


class PasteEvent(BaseModel):
    participant_id: str = Field(..., description="Уникальный идентификатор участника")
    length: int = Field(..., ge=0, description="Количество символов в вставке")
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ExtensionEvent(BaseModel):
    participant_id: str
    extension_name: str = Field(..., description="Название подозрительного расширения")
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class DevToolsEvent(BaseModel):
    participant_id: str
    opened: bool = Field(..., description="Флаг открытия DevTools")
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class Submission(BaseModel):
    participant_id: str
    code: str = Field(..., description="Текст решения для анализа")
    language: Optional[str] = Field(None, description="Язык решения (опционально)")
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class EventEnvelope(BaseModel):
    type: EventType
    payload: dict


class AIVerdict(BaseModel):
    originality_score: float = Field(..., ge=0, le=1, description="0-1, где 1 = оригинальное решение")
    is_copied: bool = Field(..., description="True, если модель подозревает копирование")
    explanation: str = Field(..., description="Комментарий от AI")


class ParticipantMetrics(BaseModel):
    participant_id: str
    paste_events: int
    paste_volume: int
    large_pastes: int
    suspicious_extensions: List[str]
    devtools_opened: bool
    ai_verdict: Optional[AIVerdict] = None
    risk_score: int
    updated_at: datetime


class ParticipantSummary(BaseModel):
    participant_id: str
    risk_score: int
    paste_events: int
    devtools_opened: bool
    suspicious_extensions: List[str]
    ai_status: Optional[str]


class SubmissionResponse(BaseModel):
    participant_id: str
    verdict: AIVerdict
    risk_score: int


class HealthResponse(BaseModel):
    status: str
    timestamp: datetime
