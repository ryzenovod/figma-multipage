"""
Behavior Analyzer - Анализ поведения кандидата
Детектирование подозрительных действий: DevTools, расширения, clipboard
"""
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from collections import defaultdict

from config.scibox import SciBoxClient


class BehaviorAnalyzer:
    """
    Анализатор поведения для детектирования читерства
    
    Критерии оценивания (20 баллов):
    - Анализ браузерных расширений
    - Анализ консолей (DevTools)
    """
    
    def __init__(self, scibox_client: SciBoxClient):
        self.client = scibox_client
        self.event_rules = self._init_event_rules()
    
    def _init_event_rules(self) -> Dict[str, Dict[str, Any]]:
        """
        Правила оценки событий
        
        Каждое событие имеет:
        - base_score: базовый балл риска
        - multiplier: множитель для повторяющихся событий
        - critical: критичность события
        """
        return {
            "devtools_detected": {
                "base_score": 30,
                "multiplier": 1.5,
                "critical": True,
                "description": "Обнаружены инструменты разработчика"
            },
            "extension_detected": {
                "base_score": 20,
                "multiplier": 1.2,
                "critical": True,
                "description": "Обнаружено браузерное расширение"
            },
            "clipboard_paste": {
                "base_score": 5,
                "multiplier": 1.3,
                "critical": False,
                "description": "Вставка из буфера обмена",
                "dynamic_score": True  # Зависит от размера вставленного текста
            },
            "clipboard_copy": {
                "base_score": 0,
                "multiplier": 1.0,
                "critical": False,
                "description": "Копирование в буфер обмена"
            },
            "tab_switch": {
                "base_score": 10,
                "multiplier": 1.1,
                "critical": False,
                "description": "Переключение вкладок"
            },
            "visibility_change": {
                "base_score": 15,
                "multiplier": 1.2,
                "critical": False,
                "description": "Изменение видимости страницы"
            },
            "face_detection": {
                "base_score": 0,
                "multiplier": 1.0,
                "critical": False,
                "description": "Событие детекции лиц",
                "dynamic_score": True
            }
        }
    
    async def analyze_session(
        self,
        session_id: str,
        time_window_minutes: int = 30
    ) -> Dict[str, Any]:
        """
        Анализ всех событий сессии
        
        Возвращает:
        - rule_based_score: оценка на основе правил
        - flagged_events: список подозрительных событий
        - final_score: финальный скор риска
        """
        # Получаем события из БД
        events = await self._get_session_events(session_id, time_window_minutes)
        print('[DEBUG] Events:', events)
        
        if not events:
            return {
                "rule_based_score": 0,
                "flagged_events": [],
                "final_score": 0,
                "analysis_time": datetime.utcnow().isoformat()
            }
        
        # DEBUG: Печатаем все события
        print("[DEBUG] Events for analysis:")
        for e in events:
            print(f"  {e}")
        # Анализ по правилам
        rule_analysis = self._analyze_by_rules(events)
        print(f"[DEBUG] Rule analysis: {rule_analysis}")
        # Группировка событий по типам
        event_groups = self._group_events_by_type(events)
        print(f"[DEBUG] Event groups: {event_groups}")
        # Детектирование паттернов
        patterns = self._detect_suspicious_patterns(events, event_groups)
        print(f"[DEBUG] Patterns: {patterns}")
        # Расчет финального скора
        final_score = self._calculate_final_score(
            rule_analysis["score"],
            patterns
        )
        print(f"[DEBUG] Final score: {final_score}")
        # Формирование списка подозрительных событий
        flagged_events = self._get_flagged_events(events, rule_analysis, patterns)
        print(f"[DEBUG] Flagged events: {flagged_events}")
        return {
            "rule_based_score": rule_analysis["score"],
            "flagged_events": flagged_events,
            "final_score": min(100, max(0, final_score)),
            "patterns": patterns,
            "event_statistics": {
                "total_events": len(events),
                "events_by_type": event_groups,
                "critical_events": rule_analysis["critical_count"]
            },
            "analysis_time": datetime.utcnow().isoformat()
        }
    
    def _analyze_by_rules(self, events: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Анализ событий по правилам"""
        total_score = 0
        event_counts = defaultdict(int)
        critical_events = []
        
        for event in events:
            event_type = event.get("event_type", "")
            rule = self.event_rules.get(event_type)
            
            if not rule:
                continue
            
            # Базовый балл
            score = rule["base_score"]
            
            # Динамический расчет для некоторых событий
            if rule.get("dynamic_score") and event.get("metadata"):
                score = self._calculate_dynamic_score(event, rule)
            
            # Подсчет повторений
            event_counts[event_type] += 1
            
            # Множитель для повторяющихся событий
            if event_counts[event_type] > 1:
                score *= rule["multiplier"] ** (event_counts[event_type] - 1)
            
            total_score += score
            
            # Критичные события
            if rule.get("critical"):
                critical_events.append({
                    "type": event_type,
                    "timestamp": event.get("timestamp"),
                    "score": score
                })
        
        return {
            "score": min(100, total_score),
            "critical_count": len(critical_events),
            "critical_events": critical_events,
            "event_counts": dict(event_counts)
        }
    
    def _calculate_dynamic_score(
        self,
        event: Dict[str, Any],
        rule: Dict[str, Any]
    ) -> float:
        """Динамический расчет скора на основе метаданных события"""
        base_score = rule["base_score"]
        metadata = event.get("metadata", {})
        
        # Для clipboard_paste скор зависит от размера вставленного текста
        if event.get("event_type") == "clipboard_paste":
            text_length = metadata.get("textLength", 0)
            
            if text_length > 500:
                return base_score + 40  # Очень большой фрагмент
            elif text_length > 200:
                return base_score + 25
            elif text_length > 100:
                return base_score + 15
            elif text_length > 50:
                return base_score + 8
            else:
                return base_score + 3
        
        # Для face_detection скор зависит от severity
        if event.get("event_type") == "face_detection":
            severity = metadata.get("severity", "normal")
            current_count = metadata.get("currentCount", 1)
            
            if severity == "critical":  # 2+ человека в кадре
                return 15 * current_count  # До 15 баллов за каждого
            elif severity == "warning":  # Участник вышел из кадра
                return 3
            else:  # normal - 1 человек
                return 0
        
        return base_score
    
    def _group_events_by_type(
        self,
        events: List[Dict[str, Any]]
    ) -> Dict[str, int]:
        """Группировка событий по типам"""
        groups = defaultdict(int)
        for event in events:
            event_type = event.get("event_type", "unknown")
            groups[event_type] += 1
        return dict(groups)
    
    def _detect_suspicious_patterns(
        self,
        events: List[Dict[str, Any]],
        event_groups: Dict[str, int]
    ) -> List[Dict[str, Any]]:
        """Детектирование подозрительных паттернов"""
        patterns = []
        
        # Паттерн 1: Быстрая последовательность clipboard_paste
        paste_events = [
            e for e in events
            if e.get("event_type") == "clipboard_paste"
        ]
        
        if len(paste_events) > 3:
            # Проверяем временные интервалы
            recent_pastes = sorted(
                paste_events,
                key=lambda x: x.get("timestamp", 0),
                reverse=True
            )[:5]
            
            if len(recent_pastes) >= 2:
                time_diffs = []
                for i in range(len(recent_pastes) - 1):
                    diff = abs(
                        recent_pastes[i].get("timestamp", 0) -
                        recent_pastes[i+1].get("timestamp", 0)
                    )
                    time_diffs.append(diff)
                
                # Если несколько вставок за короткое время
                if any(diff < 5000 for diff in time_diffs):  # Менее 5 секунд
                    patterns.append({
                        "type": "rapid_pasting",
                        "severity": "high",
                        "description": "Множественные быстрые вставки кода",
                        "count": len(recent_pastes)
                    })
        
        # Паттерн 2: DevTools + Clipboard одновременно
        devtools_events = [
            e for e in events
            if e.get("event_type") == "devtools_detected"
        ]
        
        if devtools_events and paste_events:
            patterns.append({
                "type": "devtools_with_paste",
                "severity": "critical",
                "description": "DevTools открыты во время вставки кода",
                "devtools_count": len(devtools_events),
                "paste_count": len(paste_events)
            })
        
        # Паттерн 3: Расширение + большая вставка
        extension_events = [
            e for e in events
            if e.get("event_type") == "extension_detected"
        ]
        
        if extension_events:
            large_pastes = [
                e for e in paste_events
                if e.get("metadata", {}).get("textLength", 0) > 200
            ]
            
            if large_pastes:
                patterns.append({
                    "type": "extension_with_large_paste",
                    "severity": "high",
                    "description": "Расширение активно во время больших вставок",
                    "extension_count": len(extension_events),
                    "large_paste_count": len(large_pastes)
                })
        
        # Паттерн 4: Множественные переключения вкладок
        tab_switches = [
            e for e in events
            if e.get("event_type") == "tab_switch"
        ]
        
        if len(tab_switches) > 5:
            patterns.append({
                "type": "excessive_tab_switching",
                "severity": "medium",
                "description": "Чрезмерное переключение вкладок",
                "count": len(tab_switches)
            })
        
        # Паттерн 5: Детекция множественных лиц в кадре
        face_detection_events = [
            e for e in events
            if e.get("event_type") == "face_detection"
        ]
        
        critical_face_events = [
            e for e in face_detection_events
            if e.get("metadata", {}).get("severity") == "critical"
        ]
        
        if len(critical_face_events) > 0:
            patterns.append({
                "type": "multiple_people_detected",
                "severity": "critical",
                "description": "Обнаружено несколько человек в кадре",
                "count": len(critical_face_events)
            })
        
        # Паттерн 6: Частый выход из кадра
        warning_face_events = [
            e for e in face_detection_events
            if e.get("metadata", {}).get("severity") == "warning"
        ]
        
        if len(warning_face_events) > 5:
            patterns.append({
                "type": "frequent_disappearance",
                "severity": "high",
                "description": "Участник часто выходит из кадра",
                "count": len(warning_face_events)
            })
        
        return patterns
    
    def _calculate_final_score(
        self,
        rule_score: float,
        patterns: List[Dict[str, Any]]
    ) -> float:
        """Расчет финального скора с учетом паттернов"""
        final_score = rule_score
        
        # Бонусы за паттерны
        for pattern in patterns:
            severity = pattern.get("severity", "medium")
            
            if severity == "critical":
                final_score += 30
            elif severity == "high":
                final_score += 20
            elif severity == "medium":
                final_score += 10
        
        return final_score
    
    def _get_flagged_events(
        self,
        events: List[Dict[str, Any]],
        rule_analysis: Dict[str, Any],
        patterns: List[Dict[str, Any]]
    ) -> List[str]:
        """Получить список типов подозрительных событий"""
        flagged = set()
        
        # Критичные события
        for critical_event in rule_analysis.get("critical_events", []):
            flagged.add(critical_event["type"])
        
        # События из паттернов
        for pattern in patterns:
            if pattern["type"] == "rapid_pasting":
                flagged.add("clipboard_paste")
            elif pattern["type"] == "devtools_with_paste":
                flagged.add("devtools_detected")
                flagged.add("clipboard_paste")
            elif pattern["type"] == "extension_with_large_paste":
                flagged.add("extension_detected")
                flagged.add("clipboard_paste")
            elif pattern["type"] == "excessive_tab_switching":
                flagged.add("tab_switch")
            elif pattern["type"] == "multiple_people_detected":
                flagged.add("face_detection")
            elif pattern["type"] == "frequent_disappearance":
                flagged.add("face_detection")
        
        return list(flagged)
    
    async def _get_session_events(
        self,
        session_id: str,
        time_window_minutes: int
    ) -> List[Dict[str, Any]]:
        """
        Получить события сессии из БД
        
        TODO: Реализовать реальный запрос к БД
        """
        # Временная заглушка - должна быть реализация через asyncpg
        from proctoring.backend.database import get_db
        db = await get_db()
        
        try:
            # Пример запроса (нужно адаптировать под используемую БД)
            rows = await db.fetch(
                """
                SELECT event_type, timestamp, metadata
                FROM proctoring_events
                WHERE session_id = $1
                  AND timestamp >= $2
                ORDER BY timestamp ASC
                """,
                session_id,
                datetime.utcnow() - timedelta(minutes=time_window_minutes)
            )
            
            events = []
            for row in rows:
                events.append({
                    "event_type": row["event_type"],
                    "timestamp": row["timestamp"].timestamp() * 1000,
                    "metadata": row.get("metadata", {})
                })
            
            return events
            
        except Exception as e:
            print(f"Error fetching session events: {e}")
            return []

