"""
Database models for proctoring system
"""
from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel


class ProctoringEvent(BaseModel):
    """Модель события прокторинга"""
    id: Optional[int] = None
    session_id: str
    event_type: str
    timestamp: datetime
    metadata: Dict[str, Any]
    risk_score: int = 0


class CodeSnapshot(BaseModel):
    """Модель снимка кода"""
    id: Optional[int] = None
    session_id: str
    task_id: str
    timestamp: datetime
    code_text: str
    code_hash: Optional[str] = None
    language: str
    originality_score: Optional[int] = None
    llm_analysis: Optional[Dict[str, Any]] = None


class ProctoringScore(BaseModel):
    """Модель скора прокторинга"""
    id: Optional[int] = None
    session_id: str
    task_id: Optional[str] = None
    timestamp: datetime
    rule_based_score: int
    llm_risk_score: Optional[int] = None
    code_originality_score: Optional[int] = None
    final_score: int
    flagged_events: list[str]
    llm_recommendation: Optional[str] = None
    llm_reasoning: Optional[str] = None

