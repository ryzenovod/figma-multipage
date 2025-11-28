"""
Risk Scoring System
Вычисляет риск читерства на основе событий прокторинга
"""
from typing import Dict, Any, List
from datetime import datetime
import asyncio
from config.scibox import get_scibox_client


class RiskScorer:
    """Система оценки риска читерства"""
    
    def __init__(self):
        self.scibox_client = get_scibox_client()
        self.event_weights = {
            # Критичные события
            "devtools_detected": 30,
            "clipboard_paste": 20,  # Базовое значение, зависит от размера
            "extension_detected": 20,
            
            # Средние события
            "tab_switch": 10,
            "window_blur": 8,
            "visibility_hidden": 10,
            "suspicious_keyboard": 15,
            
            # Низкие события
            "clipboard_copy": 3,
            "clipboard_cut": 2,
        }
    
    async def calculate_risk(
        self,
        session_id: str,
        events: List[Dict[str, Any]],
        task_description: str = "Техническая задача",
        elapsed_time: int = 0,
        candidate_level: str = "middle"
    ) -> Dict[str, Any]:
        """
        Вычислить риск читерства
        
        Args:
            session_id: ID сессии
            events: Список событий прокторинга
            task_description: Описание задачи
            elapsed_time: Время решения в минутах
            candidate_level: Уровень кандидата
            
        Returns:
            Словарь с оценкой риска
        """
        # Правила-основанная оценка (быстрая)
        rule_based_score = self._rule_based_scoring(events)
        
        # Флаги подозрительных событий
        flagged_events = self._get_flagged_events(events)
        
        # Финальный скор (пока только правило-основанный)
        final_score = rule_based_score
        
        # LLM анализ (если скор высокий или много событий)
        llm_risk_score = None
        if rule_based_score > 50 or len(events) > 20:
            try:
                llm_analysis = await self._llm_analysis(
                    events, task_description, elapsed_time, candidate_level
                )
                llm_risk_score = llm_analysis.get("risk_score", 0)
                # Обновляем финальный скор с учетом LLM
                final_score = int((rule_based_score * 0.4) + (llm_risk_score * 0.6))
            except Exception as e:
                print(f"[RiskScorer] LLM analysis error: {e}")
        
        return {
            "session_id": session_id,
            "rule_based_score": rule_based_score,
            "llm_risk_score": llm_risk_score,
            "final_score": final_score,
            "flagged_events": flagged_events,
            "events_count": len(events),
            "timestamp": datetime.now().isoformat()
        }
    
    def _rule_based_scoring(self, events: List[Dict[str, Any]]) -> int:
        """Оценка на основе правил"""
        total_score = 0
        event_counts = {}
        
        for event in events:
            event_type = event.get("type", "unknown")
            event_counts[event_type] = event_counts.get(event_type, 0) + 1
            
            # Базовый вес события
            base_weight = self.event_weights.get(event_type, 0)
            
            # Модификаторы в зависимости от типа события
            if event_type == "clipboard_paste":
                # Учитываем размер вставленного текста
                text_length = event.get("textLength", 0)
                if text_length > 500:
                    base_weight += 20  # Большая вставка
                elif text_length > 200:
                    base_weight += 10  # Средняя вставка
            
            elif event_type == "devtools_detected":
                # DevTools - всегда критично
                base_weight = 30
            
            elif event_type == "tab_switch" or event_type == "visibility_hidden":
                # Множественные переключения подозрительны
                count = event_counts.get(event_type, 0)
                if count > 5:
                    base_weight += 5 * (count - 5)  # Дополнительный штраф
            
            total_score += base_weight
        
        # Ограничиваем максимальный скор
        return min(100, total_score)
    
    def _get_flagged_events(self, events: List[Dict[str, Any]]) -> List[str]:
        """Получить список типов подозрительных событий"""
        flagged = set()
        
        for event in events:
            event_type = event.get("type", "")
            
            # Критичные события всегда флагятся
            if event_type in ["devtools_detected", "extension_detected"]:
                flagged.add(event_type)
            
            # Большие вставки кода
            if event_type == "clipboard_paste":
                text_length = event.get("textLength", 0)
                if text_length > 200:
                    flagged.add("large_code_paste")
            
            # Множественные переключения вкладок
            if event_type in ["tab_switch", "visibility_hidden"]:
                count = sum(1 for e in events if e.get("type") == event_type)
                if count > 3:
                    flagged.add("excessive_tab_switching")
        
        return list(flagged)
    
    async def _llm_analysis(
        self,
        events: List[Dict[str, Any]],
        task_description: str,
        elapsed_time: int,
        candidate_level: str
    ) -> Dict[str, Any]:
        """Анализ через LLM"""
        # Используем синхронный вызов в async функции
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            lambda: self.scibox_client.analyze_proctoring_behavior(
                events, task_description, elapsed_time, candidate_level
            )
        )
        return result
    
    def get_risk_level(self, score: int) -> str:
        """Определить уровень риска по скору"""
        if score >= 81:
            return "critical"
        elif score >= 61:
            return "high"
        elif score >= 31:
            return "medium"
        else:
            return "low"

