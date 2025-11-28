"""
FastAPI server for proctoring system
"""
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import asyncio
import json
from datetime import datetime

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from proctoring.code_analyzer import CodeOriginalityAnalyzer
from proctoring.risk_scorer import RiskScorer
from proctoring.models import ProctoringEvent, CodeSnapshot, ProctoringScore
from config.scibox import get_scibox_client

app = FastAPI(title="Proctoring API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # В продакшене указать конкретные домены
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Временное хранилище (в продакшене использовать БД)
events_storage: Dict[str, List[Dict]] = {}
code_snapshots: Dict[str, List[Dict]] = {}
risk_scores: Dict[str, Dict] = {}
active_sessions: Dict[str, Dict] = {}

# Инициализация анализаторов
code_analyzer = CodeOriginalityAnalyzer()
risk_scorer = RiskScorer()


class EventRequest(BaseModel):
    sessionId: str
    events: List[Dict[str, Any]]
    urgent: bool = False


class CodeSnapshotRequest(BaseModel):
    sessionId: str
    taskId: str
    code: str
    language: str
    timestamp: int


class HeartbeatRequest(BaseModel):
    sessionId: str
    timestamp: int


@app.post("/api/proctoring/events")
async def receive_events(request: EventRequest):
    """Прием событий прокторинга от клиента"""
    try:
        session_id = request.sessionId
        
        # Сохраняем события
        if session_id not in events_storage:
            events_storage[session_id] = []
        events_storage[session_id].extend(request.events)
        
        # Обновляем последнюю активность
        if session_id not in active_sessions:
            active_sessions[session_id] = {
                "sessionId": session_id,
                "startTime": datetime.now().isoformat(),
                "lastActivity": datetime.now().isoformat()
            }
        active_sessions[session_id]["lastActivity"] = datetime.now().isoformat()
        
        # Вычисляем риск на основе событий
        risk_result = await risk_scorer.calculate_risk(
            session_id=session_id,
            events=events_storage[session_id]
        )
        
        # Сохраняем скор
        risk_scores[session_id] = risk_result
        
        return {
            "status": "ok",
            "eventsReceived": len(request.events),
            "current_risk_score": risk_result.get("rule_based_score", 0),
            "flagged_events": risk_result.get("flagged_events", [])
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/proctoring/code-snapshot")
async def receive_code_snapshot(request: CodeSnapshotRequest):
    """Прием снимка кода для анализа оригинальности"""
    try:
        session_id = request.sessionId
        
        # Сохраняем снимок
        snapshot = {
            "sessionId": session_id,
            "taskId": request.taskId,
            "code": request.code,
            "language": request.language,
            "timestamp": request.timestamp
        }
        
        if session_id not in code_snapshots:
            code_snapshots[session_id] = []
        code_snapshots[session_id].append(snapshot)
        
        # Анализируем оригинальность кода
        # В фоне, чтобы не блокировать ответ
        asyncio.create_task(
            analyze_code_originality_async(session_id, request.taskId, request.code)
        )
        
        return {
            "status": "queued",
            "analysis_id": f"{session_id}_{request.taskId}",
            "estimated_time": 5
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def analyze_code_originality_async(session_id: str, task_id: str, code: str):
    """Асинхронный анализ оригинальности кода"""
    try:
        # Получаем описание задачи (в реальной системе из БД)
        task_description = "Техническая задача для собеседования"
        
        # Анализируем через SciBox
        analysis_result = await code_analyzer.analyze(code, task_description)
        
        # Обновляем скор риска с учетом оригинальности
        if session_id in risk_scores:
            risk_scores[session_id]["code_originality_score"] = analysis_result.get("originality_score", 50)
            risk_scores[session_id]["code_analysis"] = analysis_result
        
        print(f"[CodeAnalyzer] Session {session_id}, Originality: {analysis_result.get('originality_score')}")
        
    except Exception as e:
        print(f"[CodeAnalyzer] Error: {e}")


@app.get("/api/proctoring/score/{session_id}")
async def get_risk_score(session_id: str):
    """Получение текущего скора риска"""
    try:
        if session_id not in risk_scores:
            return {
                "session_id": session_id,
                "rule_based_score": 0,
                "llm_risk_score": None,
                "final_score": 0,
                "flagged_events": [],
                "status": "no_data"
            }
        
        score_data = risk_scores[session_id]
        
        return {
            "session_id": session_id,
            "rule_based_score": score_data.get("rule_based_score", 0),
            "llm_risk_score": score_data.get("llm_risk_score"),
            "code_originality_score": score_data.get("code_originality_score"),
            "final_score": score_data.get("final_score", score_data.get("rule_based_score", 0)),
            "flagged_events": score_data.get("flagged_events", []),
            "status": "monitoring"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/proctoring/analyze-code")
async def analyze_code(
    code: str,
    task_description: str = "Техническая задача",
    candidate_level: str = "middle"
):
    """Принудительный анализ кода (для администраторов)"""
    try:
        result = await code_analyzer.analyze(code, task_description)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/proctoring/heartbeat")
async def heartbeat(request: HeartbeatRequest):
    """Heartbeat для проверки активности клиента"""
    try:
        session_id = request.sessionId
        
        if session_id not in active_sessions:
            active_sessions[session_id] = {
                "sessionId": session_id,
                "startTime": datetime.now().isoformat()
            }
        
        active_sessions[session_id]["lastHeartbeat"] = datetime.now().isoformat()
        
        return {"status": "ok"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.websocket("/api/proctoring/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """WebSocket endpoint для реалтайм коммуникации"""
    await websocket.accept()
    
    try:
        while True:
            # Получаем события от клиента
            data = await websocket.receive_text()
            event = json.loads(data)
            
            # Обрабатываем событие
            if event.get("type") == "event":
                session_id = event.get("sessionId", session_id)
                proctoring_event = event.get("event", {})
                
                # Сохраняем событие
                if session_id not in events_storage:
                    events_storage[session_id] = []
                events_storage[session_id].append(proctoring_event)
                
                # Вычисляем риск
                risk_result = await risk_scorer.calculate_risk(
                    session_id=session_id,
                    events=events_storage[session_id]
                )
                
                # Отправляем обновление риска клиенту
                await websocket.send_json({
                    "type": "risk_update",
                    "risk_score": risk_result.get("final_score", 0),
                    "flagged_events": risk_result.get("flagged_events", [])
                })
                
                # Если высокий риск - отправляем предупреждение
                if risk_result.get("final_score", 0) > 70:
                    await websocket.send_json({
                        "type": "warning",
                        "message": "Обнаружена подозрительная активность",
                        "risk_level": "high"
                    })
            
            elif event.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
                
    except WebSocketDisconnect:
        print(f"[WebSocket] Client disconnected: {session_id}")
    except Exception as e:
        print(f"[WebSocket] Error: {e}")
        await websocket.close()


@app.get("/api/proctoring/stats/{session_id}")
async def get_statistics(session_id: str):
    """Получение статистики по сессии"""
    try:
        stats = {
            "sessionId": session_id,
            "eventsCount": len(events_storage.get(session_id, [])),
            "codeSnapshotsCount": len(code_snapshots.get(session_id, [])),
            "currentRiskScore": risk_scores.get(session_id, {}).get("final_score", 0),
            "sessionInfo": active_sessions.get(session_id, {})
        }
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/")
async def root():
    """Health check"""
    return {
        "status": "ok",
        "service": "Proctoring API",
        "version": "1.0.0"
    }

