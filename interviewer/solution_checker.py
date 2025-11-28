"""
Solution Checker - Проверка и оценка решений кандидата
"""
from typing import Dict, Any, List, Optional
from datetime import datetime
import json
import re

from config.scibox import SciBoxClient


class SolutionChecker:
    """
    Проверяльщик решений с использованием LLM + эмбеддингов
    
    Функции:
    - Проверка корректности (прохождение тестов)
    - Оценка качества кода (стиль, читаемость)
    - Анализ эффективности (сложность алгоритма)
    - Проверка оригинальности (через bge-m3 эмбеддинги)
    - Генерация обратной связи
    """
    
    def __init__(self, scibox_client: SciBoxClient):
        self.client = scibox_client
        self.known_solutions_db = []  # База известных решений для проверки оригинальности
    
    async def check_solution(
        self,
        task: Dict[str, Any],
        candidate_solution: str,
        test_results: Dict[str, Any],
        candidate_level: str
    ) -> Dict[str, Any]:
        """
        Полная проверка решения кандидата
        
        Args:
            task: Данные задачи (из TaskGenerator)
            candidate_solution: Код решения
            test_results: Результаты выполнения тестов
            candidate_level: Junior | Middle | Senior
        
        Returns:
            {
                "score": 85,
                "verdict": "Хорошее решение",
                "correctness": {...},
                "quality": {...},
                "efficiency": {...},
                "originality": {...},
                "feedback": "Детальная обратная связь",
                "recommendations": [...]
            }
        """
        # 1. Корректность (40%)
        correctness = await self._check_correctness(
            candidate_solution,
            test_results,
            task.get("test_cases", {})
        )
        
        # 2. Качество кода (30%)
        quality = await self._analyze_code_quality(
            candidate_solution,
            candidate_level
        )
        
        # 3. Эффективность (20%)
        efficiency = await self._analyze_efficiency(
            candidate_solution,
            task.get("requirements", [])
        )
        
        # 4. Оригинальность (10%)
        originality = await self._check_originality(
            candidate_solution,
            task.get("task_id")
        )
        
        # 5. Расчет финального скора
        final_score = self._calculate_score(
            correctness, quality, efficiency, originality
        )
        
        # 6. Генерация обратной связи
        feedback = await self._generate_feedback(
            task,
            candidate_solution,
            correctness,
            quality,
            efficiency,
            originality,
            final_score
        )
        
        return {
            "score": final_score,
            "verdict": self._get_verdict(final_score),
            "correctness": correctness,
            "quality": quality,
            "efficiency": efficiency,
            "originality": originality,
            "feedback": feedback["text"],
            "recommendations": feedback["recommendations"],
            "strengths": feedback["strengths"],
            "weaknesses": feedback["weaknesses"],
            "checked_at": datetime.utcnow().isoformat()
        }
    
    async def _check_correctness(
        self,
        solution: str,
        test_results: Dict[str, Any],
        test_cases: Dict[str, List]
    ) -> Dict[str, Any]:
        """
        Проверка корректности решения
        
        Анализирует:
        - Прохождение видимых тестов
        - Прохождение скрытых тестов
        - Обработку граничных случаев
        """
        visible_tests = test_cases.get("visible", [])
        hidden_tests = test_cases.get("hidden", [])
        
        visible_passed = test_results.get("visible_passed", 0)
        visible_total = len(visible_tests)
        
        hidden_passed = test_results.get("hidden_passed", 0)
        hidden_total = len(hidden_tests)
        
        total_passed = visible_passed + hidden_passed
        total_tests = visible_total + hidden_total
        
        pass_rate = (total_passed / total_tests * 100) if total_tests > 0 else 0
        
        return {
            "pass_rate": pass_rate,
            "visible_tests": {"passed": visible_passed, "total": visible_total},
            "hidden_tests": {"passed": hidden_passed, "total": hidden_total},
            "all_passed": total_passed == total_tests,
            "score": pass_rate  # 0-100
        }
    
    async def _analyze_code_quality(
        self,
        solution: str,
        level: str
    ) -> Dict[str, Any]:
        """
        Анализ качества кода через LLM
        
        Критерии:
        - Читаемость (naming, структура)
        - Стиль (соответствие PEP8/стандартам)
        - Архитектура (разбиение на функции)
        - Документация (комментарии, docstrings)
        """
        prompt = f"""Проанализируй качество кода для {level} разработчика.

Код:
```python
{solution[:2000]}
```

Оцени по критериям (0-100 баллов):
1. Читаемость - понятность кода
2. Стиль - соответствие стандартам
3. Архитектура - организация кода
4. Документация - комментарии

Верни JSON:
{{
  "readability": 85,
  "style": 90,
  "architecture": 75,
  "documentation": 60,
  "overall_score": 77,
  "issues": ["Слишком длинная функция", "Нет docstrings"],
  "good_practices": ["Хорошие имена переменных", "Обработка ошибок"]
}}"""

        try:
            content = await self.client.async_chat_completion(
                messages=[{"role": "user", "content": prompt}],
                model="qwen3-coder",
                temperature=0.4
            )
            
            analysis = self._extract_json_from_text(content)
            
            return analysis
            
        except Exception as e:
            print(f"Error analyzing code quality: {e}")
            return {
                "readability": 70,
                "style": 70,
                "architecture": 70,
                "documentation": 50,
                "overall_score": 65,
                "issues": [],
                "good_practices": []
            }
    
    async def _analyze_efficiency(
        self,
        solution: str,
        requirements: List[str]
    ) -> Dict[str, Any]:
        """
        Анализ эффективности алгоритма
        
        Проверяет:
        - Временную сложность (Big O)
        - Использование памяти
        - Соответствие требованиям по производительности
        """
        req_str = "\n".join(requirements) if requirements else "Нет специфичных требований"
        
        prompt = f"""Проанализируй эффективность алгоритма.

Код:
```python
{solution[:2000]}
```

Требования:
{req_str}

Оцени:
{{
  "time_complexity": "O(n log n)",
  "space_complexity": "O(n)",
  "meets_requirements": true,
  "efficiency_score": 85,
  "optimizations": ["Можно использовать set вместо list для O(1) поиска"],
  "bottlenecks": ["Вложенные циклы в строке 15"]
}}

Верни JSON."""

        try:
            content = await self.client.async_chat_completion(
                messages=[{"role": "user", "content": prompt}],
                model="qwen3-coder",
                temperature=0.3
            )
            
            analysis = self._extract_json_from_text(content)
            
            return analysis
            
        except Exception as e:
            print(f"Error analyzing efficiency: {e}")
            return {
                "time_complexity": "Unknown",
                "space_complexity": "Unknown",
                "meets_requirements": True,
                "efficiency_score": 70,
                "optimizations": [],
                "bottlenecks": []
            }
    
    async def _check_originality(
        self,
        solution: str,
        task_id: str
    ) -> Dict[str, Any]:
        """
        Проверка оригинальности через эмбеддинги (bge-m3)
        
        Сравнивает код с:
        - Базой известных решений
        - Популярными GitHub-репозиториями (if needed)
        - Решениями других кандидатов на эту же задачу
        """
        try:
            # Генерация эмбеддинга для текущего решения
            embedding = await self.client.async_generate_embedding(
                text=solution,
                model="bge-m3"
            )
            
            # Сравнение с базой известных решений
            max_similarity = 0.0
            most_similar_source = None
            
            for known_solution in self.known_solutions_db:
                if known_solution.get("task_id") == task_id:
                    similarity = self._cosine_similarity(
                        embedding,
                        known_solution["embedding"]
                    )
                    
                    if similarity > max_similarity:
                        max_similarity = similarity
                        most_similar_source = known_solution.get("source", "unknown")
            
            # Оценка оригинальности (inverse similarity)
            originality_score = max(0, 100 - (max_similarity * 100))
            
            is_original = originality_score > 70  # Порог оригинальности
            
            # Сохранение решения в базу для будущих проверок
            self.known_solutions_db.append({
                "task_id": task_id,
                "embedding": embedding,
                "source": "candidate_solution",
                "timestamp": datetime.utcnow().isoformat()
            })
            
            return {
                "originality_score": originality_score,
                "is_original": is_original,
                "max_similarity": max_similarity,
                "similar_source": most_similar_source if max_similarity > 0.3 else None,
                "verdict": "Уникальное решение" if is_original else "Возможно скопировано"
            }
            
        except Exception as e:
            print(f"Error checking originality: {e}")
            return {
                "originality_score": 100,
                "is_original": True,
                "max_similarity": 0.0,
                "similar_source": None,
                "verdict": "Проверка недоступна"
            }
    
    def _cosine_similarity(self, emb1: List[float], emb2: List[float]) -> float:
        """Вычисление косинусной близости между двумя эмбеддингами"""
        if not emb1 or not emb2 or len(emb1) != len(emb2):
            return 0.0
        
        dot_product = sum(a * b for a, b in zip(emb1, emb2))
        magnitude1 = sum(a * a for a in emb1) ** 0.5
        magnitude2 = sum(b * b for b in emb2) ** 0.5
        
        if magnitude1 == 0 or magnitude2 == 0:
            return 0.0
        
        return dot_product / (magnitude1 * magnitude2)
    
    def _calculate_score(
        self,
        correctness: Dict[str, Any],
        quality: Dict[str, Any],
        efficiency: Dict[str, Any],
        originality: Dict[str, Any]
    ) -> int:
        """
        Расчет финального скора (0-100)
        
        Веса:
        - Корректность: 40%
        - Качество кода: 30%
        - Эффективность: 20%
        - Оригинальность: 10%
        """
        correctness_score = correctness.get("score", 0) * 0.4
        quality_score = quality.get("overall_score", 0) * 0.3
        efficiency_score = efficiency.get("efficiency_score", 0) * 0.2
        originality_score = originality.get("originality_score", 0) * 0.1
        
        final = correctness_score + quality_score + efficiency_score + originality_score
        
        return int(round(final))
    
    def _get_verdict(self, score: int) -> str:
        """Вердикт на основе скора"""
        if score >= 90:
            return "Отличное решение"
        elif score >= 75:
            return "Хорошее решение"
        elif score >= 60:
            return "Приемлемое решение"
        elif score >= 40:
            return "Слабое решение"
        else:
            return "Неудовлетворительное решение"
    
    async def _generate_feedback(
        self,
        task: Dict[str, Any],
        solution: str,
        correctness: Dict[str, Any],
        quality: Dict[str, Any],
        efficiency: Dict[str, Any],
        originality: Dict[str, Any],
        score: int
    ) -> Dict[str, Any]:
        """
        Генерация персонализированной обратной связи через LLM
        """
        prompt = f"""Сгенерируй обратную связь для кандидата по его решению.

Задача: {task.get('title')}

Решение кандидата:
```python
{solution[:1500]}
```

Оценка:
- Итоговый балл: {score}/100
- Корректность: {correctness.get('pass_rate', 0):.0f}% тестов пройдено
- Качество кода: {quality.get('overall_score', 0)}/100
- Эффективность: {efficiency.get('time_complexity', 'Unknown')}
- Оригинальность: {originality.get('originality_score', 0):.0f}%

Сгенерируй:
1. Сильные стороны решения (2-3 пункта)
2. Области для улучшения (2-3 пункта)
3. Конкретные рекомендации (3-4 пункта)

Формат JSON:
{{
  "text": "Общая обратная связь на 3-4 предложения",
  "strengths": ["Хорошая обработка edge cases", "Чистый код"],
  "weaknesses": ["Можно оптимизировать", "Нет docstrings"],
  "recommendations": [
    "Используйте set для O(1) поиска",
    "Добавьте документацию к функциям",
    "Обработайте исключения"
  ]
}}

Будь конструктивным и дружелюбным."""

        try:
            content = await self.client.async_chat_completion(
                messages=[{"role": "user", "content": prompt}],
                model="qwen3-coder",
                temperature=0.6
            )
            
            feedback = self._extract_json_from_text(content)
            
            return feedback
            
        except Exception as e:
            print(f"Error generating feedback: {e}")
            return {
                "text": f"Ваше решение оценено на {score}/100 баллов.",
                "strengths": ["Решение работает"],
                "weaknesses": ["Есть области для улучшения"],
                "recommendations": ["Продолжайте практиковаться"]
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


