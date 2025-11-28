"""
Risk Scorer - Расчет и хранение скора риска читерства
"""
from typing import Dict, Any, Optional, List
from datetime import datetime
import json

from config.scibox import SciBoxClient


class RiskScorer:
    """
    Система скоринга риска читерства
    
    Комбинирует:
    - Правила на основе событий
    - LLM анализ поведения
    - Анализ оригинальности кода
    """
    
    def __init__(self):
        self.scibox_client = None  # Инициализируется при необходимости
        self.llm_cache: Dict[str, Dict[str, Any]] = {}
    
    def _get_scibox_client(self) -> SciBoxClient:
        """Ленивая инициализация SciBox клиента"""
        if self.scibox_client is None:
            from config.scibox import get_scibox_client
            self.scibox_client = get_scibox_client()
        return self.scibox_client
    
    async def update_session_score(
        self,
        session_id: str,
        rule_based_score: int,
        flagged_events: List[str],
        llm_risk_score: Optional[int] = None
    ):
        """
        Обновить скор риска для сессии
        """
        from proctoring.backend.database import get_db
        db = await get_db()
        
        # Расчет финального скора
        if llm_risk_score is not None:
            final_score = (rule_based_score + llm_risk_score) / 2
        else:
            final_score = rule_based_score
        
        try:
            await db.execute(
                """
                INSERT INTO proctoring_scores 
                (session_id, timestamp, rule_based_score, llm_risk_score, final_score, flagged_events)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (session_id) 
                DO UPDATE SET
                    timestamp = $2,
                    rule_based_score = $3,
                    llm_risk_score = $4,
                    final_score = $5,
                    flagged_events = $6
                """,
                session_id,
                datetime.utcnow(),
                rule_based_score,
                llm_risk_score,
                final_score,
                flagged_events
            )
        except Exception as e:
            print(f"Error updating session score: {e}")
            # Если таблица не существует, создаем запись в памяти
            pass
    
    async def get_session_score(self, session_id: str) -> Optional[Dict[str, Any]]:
        """
        Получить текущий скор риска для сессии
        """
        from proctoring.backend.database import get_db
        db = await get_db()
        
        try:
            row = await db.fetchrow(
                """
                SELECT rule_based_score, llm_risk_score, final_score, 
                       flagged_events, llm_recommendation, llm_reasoning
                FROM proctoring_scores
                WHERE session_id = $1
                ORDER BY timestamp DESC
                LIMIT 1
                """,
                session_id
            )
            
            if not row:
                return None
            
            return {
                "rule_based_score": row["rule_based_score"],
                "llm_risk_score": row.get("llm_risk_score"),
                "final_score": row["final_score"],
                "flagged_events": row.get("flagged_events", []),
                "llm_recommendation": row.get("llm_recommendation"),
                "llm_reasoning": row.get("llm_reasoning")
            }
            
        except Exception as e:
            print(f"Error getting session score: {e}")
            return None
    
    async def flag_suspicious_code(
        self,
        session_id: str,
        originality_score: int,
        suspicious_patterns: List[str]
    ):
        """
        Пометка подозрительного кода и обновление скора
        """
        current_score = await self.get_session_score(session_id)
        
        if current_score:
            rule_based_score = current_score.get("rule_based_score", 0)
        else:
            rule_based_score = 0
        
        # Если оригинальность низкая, увеличиваем риск
        if originality_score < 50:
            penalty = 50 - originality_score  # Штраф 0-50 баллов
            rule_based_score += penalty
            rule_based_score = min(100, rule_based_score)
        
        # Обновляем скор
        flagged_events = current_score.get("flagged_events", []) if current_score else []
        if "suspicious_code" not in flagged_events:
            flagged_events.append("suspicious_code")
        
        await self.update_session_score(
            session_id=session_id,
            rule_based_score=rule_based_score,
            flagged_events=flagged_events
        )
    
    async def request_llm_analysis(
        self,
        session_id: str,
        events: List[Dict[str, Any]],
        task_description: str,
        elapsed_time: int,
        candidate_level: str = "middle"
    ) -> Dict[str, Any]:
        """
        Запросить глубокий анализ через LLM
        
        Использует qwen3-awq для анализа поведения
        """
        # Проверяем кеш
        cache_key = f"{session_id}_{len(events)}_{elapsed_time}"
        if cache_key in self.llm_cache:
            return self.llm_cache[cache_key]
        
        client = self._get_scibox_client()
        
        # Анализ через LLM
        llm_result = client.analyze_proctoring_behavior(
            events=events,
            task_description=task_description,
            elapsed_time=elapsed_time,
            candidate_level=candidate_level
        )
        
        # Сохранение результата
        await self.update_session_score(
            session_id=session_id,
            rule_based_score=0,  # Обновляется отдельно
            flagged_events=llm_result.get("flagged_events", []),
            llm_risk_score=llm_result.get("risk_score")
        )
        
        # Обновление с рекомендацией
        from proctoring.backend.database import get_db
        db = await get_db()
        try:
            await db.execute(
                """
                UPDATE proctoring_scores
                SET llm_recommendation = $1, llm_reasoning = $2
                WHERE session_id = $3
                """,
                llm_result.get("recommendation"),
                llm_result.get("reasoning"),
                session_id
            )
        except Exception as e:
            print(f"Error updating LLM recommendation: {e}")
        
        # Кеширование
        self.llm_cache[cache_key] = llm_result
        
        return llm_result
    
    def calculate_risk_level(self, score: int) -> str:
        """
        Определить уровень риска по скору
        """
        if score >= 80:
            return "critical"
        elif score >= 60:
            return "high"
        elif score >= 40:
            return "medium"
        elif score >= 20:
            return "low"
        else:
            return "minimal"
    
    async def get_session_summary(self, session_id: str) -> Dict[str, Any]:
        """
        Получить полную сводку по сессии
        """
        score_data = await self.get_session_score(session_id)
        
        if not score_data:
            return {
                "session_id": session_id,
                "status": "no_data",
                "risk_level": "unknown"
            }
        
        final_score = score_data["final_score"]
        risk_level = self.calculate_risk_level(final_score)
        
        return {
            "session_id": session_id,
            "rule_based_score": score_data["rule_based_score"],
            "llm_risk_score": score_data.get("llm_risk_score"),
            "final_score": final_score,
            "risk_level": risk_level,
            "flagged_events": score_data.get("flagged_events", []),
            "llm_recommendation": score_data.get("llm_recommendation"),
            "llm_reasoning": score_data.get("llm_reasoning"),
            "timestamp": datetime.utcnow().isoformat()
        }

