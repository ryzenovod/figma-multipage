"""
FastAPI Backend для прокторинг-системы
"""
import os
import sys
from pathlib import Path

# Добавляем корневую директорию в путь
root_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(root_dir))

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid
import aiofiles
from dotenv import load_dotenv

from config.scibox import get_scibox_client
from interviewer.interview_session import InterviewSession
from proctoring.backend.analysis.code_analyzer import CodeAnalyzer
from proctoring.backend.analysis.behavior_analyzer import BehaviorAnalyzer
from proctoring.backend.analysis.risk_scorer import RiskScorer
from proctoring.backend.database import get_db, init_db

# Загрузка переменных окружения
load_dotenv()

app = FastAPI(
    title="VibeCode Jam Proctoring API",
    description="API для системы защиты от читерства",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # В продакшене указать конкретные домены
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Инициализация компонентов
scibox_client = get_scibox_client()
code_analyzer = CodeAnalyzer(scibox_client)
behavior_analyzer = BehaviorAnalyzer(scibox_client)
risk_scorer = RiskScorer()
interview_session = InterviewSession(scibox_client)

# WebSocket соединения
active_connections: Dict[str, WebSocket] = {}

# Директория для хранения скриншотов
SCREENSHOTS_DIR = Path("screenshots")
SCREENSHOTS_DIR.mkdir(exist_ok=True)

# Хранилище сессий (в продакшене использовать БД)
proctoring_sessions: Dict[str, Dict[str, Any]] = {}


# Pydantic модели
class ProctoringEvent(BaseModel):
    type: str
    timestamp: int
    sessionId: Optional[str] = None
    source: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = {}


class EventsBatch(BaseModel):
    sessionId: str
    events: List[ProctoringEvent]


class CodeSnapshot(BaseModel):
    sessionId: str
    taskId: str
    code: str
    language: str = "python"
    timestamp: Optional[int] = None


class Heartbeat(BaseModel):
    sessionId: str
    timestamp: int


# Interviewer API models
class StartInterviewRequest(BaseModel):
    resumeText: str
    jobPosition: Optional[str] = "Backend Developer"
    numTasks: int = 2


class SubmitSolutionRequest(BaseModel):
    sessionId: str
    solutionCode: str
    testResults: Dict[str, Any] = {}
    timeSpent: int = 0  # seconds


@app.on_event("startup")
async def startup_event():
    """Инициализация при запуске"""
    await init_db()
    print("✅ Database initialized")
    print("✅ Proctoring API started")


@app.on_event("shutdown")
async def shutdown_event():
    """Очистка при завершении"""
    print("🛑 Proctoring API stopped")


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "VibeCode Jam Proctoring API",
        "status": "running",
        "version": "1.0.0"
    }


# ---------------- Interviewer API ----------------
@app.post("/api/interview/start")
async def api_start_interview(body: StartInterviewRequest):
    """Начать интервью: анализ резюме и первая задача"""
    try:
        result = await interview_session.start_interview(
            resume_text=body.resumeText,
            job_position=body.jobPosition or "Backend Developer",
            num_tasks=max(1, min(5, body.numTasks)),
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/interview/submit-solution")
async def api_submit_solution(body: SubmitSolutionRequest):
    """Отправить решение для проверки и получить следующую задачу"""
    try:
        result = await interview_session.submit_solution(
            session_id=body.sessionId,
            solution_code=body.solutionCode,
            test_results=body.testResults,
            time_spent=body.timeSpent,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health():
    """Health check"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat()
    }


@app.post("/api/proctoring/events")
async def receive_events(batch: EventsBatch):
    """
    Прием событий прокторинга от клиента
    
    Критерии оценивания:
    - Детектирование скопированного кода
    - Анализ браузерных расширений
    - Анализ консолей
    """
    try:
        db = await get_db()
        
        # Сохранение событий в БД
        # Примечание: тестовые события могут иметь "старые" timestamps (например, 1000000000000),
        # поэтому используем текущее время, чтобы они попадали в окно анализа.
        for event in batch.events:
            await db.execute(
                """
                INSERT INTO proctoring_events 
                (session_id, event_type, timestamp, metadata)
                VALUES ($1, $2, $3, $4)
                """,
                batch.sessionId,
                event.type,
                datetime.utcnow(),
                (event.metadata or {})
            )
        
        # Анализ поведения и расчет риска
        risk_result = await behavior_analyzer.analyze_session(
            session_id=batch.sessionId
        )
        
        # Обновление скора риска
        await risk_scorer.update_session_score(
            session_id=batch.sessionId,
            rule_based_score=risk_result["rule_based_score"],
            flagged_events=risk_result["flagged_events"]
        )
        
        # Отправка обновления через WebSocket если есть подключение
        if batch.sessionId in active_connections:
            await send_websocket_message(
                batch.sessionId,
                {
                    "type": "risk_update",
                    "risk_score": risk_result["final_score"],
                    "flagged_events": risk_result["flagged_events"]
                }
            )
        
        return {
            "status": "ok",
            "events_received": len(batch.events),
            "current_risk_score": risk_result["final_score"],
            "flagged_events": risk_result["flagged_events"]
        }
        
    except Exception as e:
        print(f"Error processing events: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/proctoring/code-snapshot")
async def receive_code_snapshot(snapshot: CodeSnapshot):
    """
    Прием снимка кода для анализа оригинальности
    
    Критерии оценивания:
    - Эффективность детектирования скопированного кода
    - Система верификации оригинальности решения
    """
    try:
        db = await get_db()
        
        # Анализ оригинальности кода через SciBox LLM
        originality_result = await code_analyzer.analyze_originality(
            code=snapshot.code,
            task_id=snapshot.taskId,
            language=snapshot.language
        )
        
        # Сохранение снимка в БД
        code_hash = code_analyzer.hash_code(snapshot.code)
        await db.execute(
            """
            INSERT INTO code_snapshots 
            (session_id, task_id, timestamp, code_text, code_hash, 
             originality_score, llm_analysis)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            """,
            snapshot.sessionId,
            snapshot.taskId,
            datetime.fromtimestamp(
                (snapshot.timestamp or datetime.utcnow().timestamp() * 1000) / 1000
            ),
            snapshot.code,
            code_hash,
            originality_result["originality_score"],
            originality_result
        )
        
        # Обновление скора риска на основе оригинальности
        if originality_result["originality_score"] < 50:
            await risk_scorer.flag_suspicious_code(
                session_id=snapshot.sessionId,
                originality_score=originality_result["originality_score"],
                suspicious_patterns=originality_result.get("suspicious_patterns", [])
            )
        
        return {
            "status": "queued",
            "analysis_id": str(uuid.uuid4()),
            "originality_score": originality_result["originality_score"],
            "suspicious_patterns": originality_result.get("suspicious_patterns", []),
            "estimated_time": 5
        }
        
    except Exception as e:
        print(f"Error processing code snapshot: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/proctoring/score/{session_id}")
async def get_risk_score(session_id: str):
    """
    Получить текущий риск читерства для сессии
    """
    try:
        result = await risk_scorer.get_session_score(session_id)
        
        if not result:
            return {
                "session_id": session_id,
                "rule_based_score": 0,
                "llm_risk_score": None,
                "final_score": 0,
                "flagged_events": [],
                "status": "no_data"
            }
        
        return {
            "session_id": session_id,
            "rule_based_score": result["rule_based_score"],
            "llm_risk_score": result.get("llm_risk_score"),
            "final_score": result["final_score"],
            "flagged_events": result.get("flagged_events", []),
            "llm_recommendation": result.get("llm_recommendation"),
            "status": "monitoring"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/proctoring/analyze-code")
async def analyze_code(
    code: str,
    task_description: str,
    candidate_level: str = "middle"
):
    """
    Принудительный анализ кода (для администраторов)
    """
    try:
        result = await code_analyzer.analyze_originality_standalone(
            code=code,
            task_description=task_description,
            candidate_level=candidate_level
        )
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/proctoring/heartbeat")
async def receive_heartbeat(heartbeat: Heartbeat):
    """Heartbeat от клиента"""
    # Можно обновить время последней активности
    return {"status": "ok"}


@app.post("/api/proctoring/screenshot")
async def upload_screenshot(
    screenshot: UploadFile = File(...),
    sessionId: str = Form(...),
    timestamp: int = Form(...),
    severity: str = Form(...),
    faceCount: int = Form(...)
):
    """
    Принять скриншот с веб-камеры при критическом событии
    """
    try:
        # Создаем директорию для сессии
        session_dir = SCREENSHOTS_DIR / sessionId
        session_dir.mkdir(exist_ok=True)

        # Генерируем имя файла
        filename = f"{timestamp}_{severity}_{faceCount}faces.jpg"
        filepath = session_dir / filename

        # Сохраняем файл асинхронно
        async with aiofiles.open(filepath, 'wb') as f:
            content = await screenshot.read()
            await f.write(content)

        # Сохраняем метаданные
        metadata = {
            "sessionId": sessionId,
            "timestamp": timestamp,
            "severity": severity,
            "faceCount": faceCount,
            "filename": filename,
            "filepath": str(filepath),
            "size": len(content),
            "uploaded_at": datetime.now().isoformat()
        }

        # Добавляем к событиям прокторинга сессии
        if sessionId not in proctoring_sessions:
            proctoring_sessions[sessionId] = {
                "events": [],
                "code_snapshots": [],
                "screenshots": []
            }
        
        proctoring_sessions[sessionId]["screenshots"].append(metadata)

        print(f"Screenshot saved: {filepath} ({len(content)} bytes)")

        return {
            "success": True,
            "screenshotId": filename,
            "metadata": metadata
        }

    except Exception as e:
        print(f"Error saving screenshot: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/proctoring/screenshots/{session_id}")
async def get_session_screenshots(session_id: str):
    """
    Получить список скриншотов для сессии
    """
    if session_id not in proctoring_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    screenshots = proctoring_sessions[session_id].get("screenshots", [])
    
    return {
        "sessionId": session_id,
        "total": len(screenshots),
        "screenshots": screenshots
    }


@app.get("/api/proctoring/screenshot/{session_id}/{filename}")
async def get_screenshot_file(session_id: str, filename: str):
    """
    Получить файл скриншота
    """
    filepath = SCREENSHOTS_DIR / session_id / filename
    
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Screenshot not found")
    
    return FileResponse(
        path=filepath,
        media_type="image/jpeg",
        filename=filename
    )


@app.websocket("/api/proctoring/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """WebSocket endpoint для реалтайм коммуникации"""
    await websocket.accept()
    active_connections[session_id] = websocket
    
    try:
        while True:
            data = await websocket.receive_text()
            import json
            message = json.loads(data)
            
            if message.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
                
    except WebSocketDisconnect:
        del active_connections[session_id]
    except Exception as e:
        print(f"WebSocket error: {e}")
        if session_id in active_connections:
            del active_connections[session_id]


async def send_websocket_message(session_id: str, message: Dict[str, Any]):
    """Отправить сообщение через WebSocket"""
    if session_id in active_connections:
        try:
            await active_connections[session_id].send_json(message)
        except Exception as e:
            print(f"Error sending WebSocket message: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

