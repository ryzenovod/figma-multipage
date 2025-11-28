"""
Task Generator - Генерация персонализированных задач
"""
from typing import Dict, Any, List, Optional
from datetime import datetime
import json
import re

from config.scibox import SciBoxClient


class TaskGenerator:
    """
    Генератор технических задач на основе:
    - Уровня кандидата (Junior/Middle/Senior)
    - Анализа резюме (навыки, опыт)
    - Предыдущих ответов (адаптивность)
    """
    
    def __init__(self, scibox_client: SciBoxClient):
        self.client = scibox_client
    
    async def generate_task(
        self,
        candidate_level: str,
        focus_skills: List[str],
        task_number: int = 1,
        previous_performance: Optional[Dict[str, Any]] = None,
        resume_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Генерация задачи с адаптивной сложностью
        
        Args:
            candidate_level: Junior | Middle | Senior
            focus_skills: ["Python", "FastAPI", "PostgreSQL"]
            task_number: Номер задачи в интервью
            previous_performance: {score: 85, time: 15, errors: 2}
            resume_context: Данные из резюме для персонализации
        
        Returns:
            {
                "task_id": "uuid",
                "title": "API для системы рекомендаций",
                "description": "...",
                "difficulty": "middle",
                "estimated_time": 25,
                "requirements": [...],
                "test_cases": {
                    "visible": [...],
                    "hidden": [...]
                },
                "hints": [...],
                "evaluation_criteria": {...}
            }
        """
        # Адаптация сложности на основе предыдущих результатов
        adjusted_level = self._adjust_difficulty(
            candidate_level,
            previous_performance
        )
        
        # Формирование промпта с учетом резюме
        prompt = self._build_task_prompt(
            adjusted_level,
            focus_skills,
            task_number,
            resume_context
        )
        
        try:
            content = await self.client.async_chat_completion(
                messages=[{"role": "user", "content": prompt}],
                model="qwen3-coder",
                temperature=0.8,  # Креативность для уникальных задач
                max_tokens=2000
            )
            
            task_data = self._extract_json_from_text(content)
            
            # Генерация unit-тестов
            task_data["test_cases"] = await self._generate_test_cases(
                task_data,
                adjusted_level
            )
            
            # Добавление метаданных
            task_data["task_id"] = f"task_{datetime.utcnow().timestamp()}"
            task_data["generated_at"] = datetime.utcnow().isoformat()
            task_data["difficulty"] = adjusted_level
            
            return task_data
            
        except Exception as e:
            print(f"Error generating task: {e}")
            return self._get_fallback_task(adjusted_level, focus_skills)
    
    def _adjust_difficulty(
        self,
        base_level: str,
        previous_performance: Optional[Dict[str, Any]]
    ) -> str:
        """
        Адаптация сложности на основе предыдущих результатов
        
        Логика:
        - Отличные результаты (score > 85) → повысить уровень
        - Плохие результаты (score < 50) → понизить уровень
        - Средние результаты → оставить текущий
        """
        if not previous_performance:
            return base_level
        
        score = previous_performance.get("score", 50)
        
        level_order = ["Junior", "Middle", "Senior"]
        current_index = level_order.index(base_level)
        
        if score > 85 and current_index < len(level_order) - 1:
            return level_order[current_index + 1]
        elif score < 50 and current_index > 0:
            return level_order[current_index - 1]
        else:
            return base_level
    
    def _build_task_prompt(
        self,
        level: str,
        focus_skills: List[str],
        task_number: int,
        resume_context: Optional[Dict[str, Any]]
    ) -> str:
        """
        Формирование промпта для генерации задачи
        """
        # Персонализация на основе резюме
        context_str = ""
        if resume_context and resume_context.get("projects"):
            projects = resume_context["projects"][:2]
            context_str = f"\n\nКандидат работал над проектами:\n"
            for p in projects:
                context_str += f"- {p.get('name', 'Проект')}: {p.get('description', '')}\n"
        
        difficulty_guides = {
            "Junior": "базовые алгоритмы, работа с коллекциями, простая логика",
            "Middle": "оптимизация, работа с БД, API дизайн, обработка ошибок",
            "Senior": "системный дизайн, распределенные системы, производительность"
        }
        
        time_limits = {
            "Junior": "15-20 минут",
            "Middle": "20-30 минут",
            "Senior": "30-40 минут"
        }
        
        prompt = f"""Сгенерируй техническую задачу для собеседования.

Уровень: {level}
Фокус на технологиях: {', '.join(focus_skills)}
Номер задачи: {task_number}
Сложность: {difficulty_guides[level]}
Время на решение: {time_limits[level]}
{context_str}

ВАЖНО:
- Задача должна быть РЕАЛИСТИЧНОЙ (как из реальных проектов)
- Решаема за указанное время
- Проверяет понимание, а не зубрежку
- Персонализирована под опыт кандидата (если есть контекст проектов)

Формат ответа (JSON):
{{
  "title": "Краткое название задачи",
  "description": "Подробное описание задачи с примерами",
  "requirements": [
    "Функция должна...",
    "Обработать граничные случаи...",
    "Сложность не более O(n log n)"
  ],
  "input_example": "пример входных данных",
  "output_example": "пример выходных данных",
  "hints": [
    "Подсказка 1 (если застрянет)",
    "Подсказка 2"
  ],
  "estimated_time": 25,
  "evaluation_criteria": {{
    "correctness": "Проходит все тесты",
    "efficiency": "Оптимальная сложность",
    "code_quality": "Читаемость и стиль"
  }}
}}

Верни ТОЛЬКО JSON, без дополнительного текста."""

        return prompt
    
    async def _generate_test_cases(
        self,
        task_data: Dict[str, Any],
        level: str
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Генерация unit-тестов для задачи
        
        Создает:
        - 2-3 видимых теста (примеры для кандидата)
        - 5-7 скрытых тестов (проверка граничных случаев)
        """
        prompt = f"""Сгенерируй unit-тесты для задачи:

Задача: {task_data.get('title')}
Описание: {task_data.get('description', '')[:500]}

Требования: {json.dumps(task_data.get('requirements', []), ensure_ascii=False)}

Создай тесты в формате JSON:
{{
  "visible": [
    {{
      "input": "пример входных данных",
      "expected_output": "ожидаемый результат",
      "description": "Базовый случай"
    }},
    {{
      "input": "...",
      "expected_output": "...",
      "description": "Второй пример"
    }}
  ],
  "hidden": [
    {{
      "input": "граничный случай",
      "expected_output": "...",
      "description": "Пустой массив"
    }},
    {{
      "input": "...",
      "expected_output": "...",
      "description": "Большой объем данных"
    }},
    ... еще 3-5 edge cases
  ]
}}

Верни только JSON."""

        try:
            content = await self.client.async_chat_completion(
                messages=[{"role": "user", "content": prompt}],
                model="qwen3-coder",
                temperature=0.5
            )
            
            tests = self._extract_json_from_text(content)
            
            return tests
            
        except Exception as e:
            print(f"Error generating tests: {e}")
            return {
                "visible": [
                    {"input": "example", "expected_output": "result", "description": "Basic test"}
                ],
                "hidden": [
                    {"input": "edge_case", "expected_output": "result", "description": "Edge case"}
                ]
            }
    
    def _extract_json_from_text(self, text: str) -> Any:
        """Извлечение JSON из текста LLM"""
        try:
            return json.loads(text)
        except:
            pass
        
        json_match = re.search(r'```(?:json)?\s*(\{.*?\}|\[.*?\])\s*```', text, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group(1))
            except:
                pass
        
        json_match = re.search(r'(\{.*?\}|\[.*?\])', text, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group(1))
            except:
                pass
        
        return {}
    
    def _get_fallback_task(self, level: str, skills: List[str]) -> Dict[str, Any]:
        """Базовая задача если LLM не сработал"""
        tasks = {
            "Junior": {
                "title": "Поиск дубликатов в массиве",
                "description": "Напишите функцию, которая находит все дубликаты в массиве целых чисел.",
                "requirements": [
                    "Функция принимает список целых чисел",
                    "Возвращает список уникальных дубликатов",
                    "Сложность не более O(n)"
                ],
                "estimated_time": 15,
                "test_cases": {
                    "visible": [
                        {"input": [1, 2, 3, 1], "expected_output": [1], "description": "Один дубликат"}
                    ],
                    "hidden": [
                        {"input": [1, 1, 2, 2, 3], "expected_output": [1, 2], "description": "Несколько дубликатов"}
                    ]
                }
            },
            "Middle": {
                "title": "API эндпоинт для фильтрации данных",
                "description": "Реализуйте FastAPI эндпоинт с фильтрацией, пагинацией и сортировкой.",
                "requirements": [
                    "GET /items с query параметрами",
                    "Фильтрация по полям",
                    "Пагинация (offset, limit)",
                    "Обработка ошибок"
                ],
                "estimated_time": 25,
                "test_cases": {
                    "visible": [],
                    "hidden": []
                }
            },
            "Senior": {
                "title": "Дизайн распределенного кеша",
                "description": "Спроектируйте систему распределенного кеша с TTL и консистентным хешированием.",
                "requirements": [
                    "Описать архитектуру",
                    "Выбрать алгоритм",
                    "Обосновать решения"
                ],
                "estimated_time": 35,
                "test_cases": {
                    "visible": [],
                    "hidden": []
                }
            }
        }
        
        return tasks.get(level, tasks["Middle"])


