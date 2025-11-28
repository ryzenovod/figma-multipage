"""
Code Originality Analyzer
Анализирует код на оригинальность через SciBox LLM
"""
import asyncio
import hashlib
from typing import Dict, Any, Optional
from config.scibox import get_scibox_client


class CodeOriginalityAnalyzer:
    """Анализатор оригинальности кода"""
    
    def __init__(self):
        self.scibox_client = get_scibox_client()
        self.code_cache: Dict[str, Dict] = {}  # Кеш для быстрого доступа
    
    async def analyze(
        self,
        code: str,
        task_description: str,
        language: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Анализировать код на оригинальность
        
        Args:
            code: Код для анализа
            task_description: Описание задачи
            language: Язык программирования
            
        Returns:
            Словарь с результатами анализа
        """
        # Генерируем хеш кода для кеширования
        code_hash = self._generate_code_hash(code)
        
        # Проверяем кеш
        if code_hash in self.code_cache:
            cached_result = self.code_cache[code_hash]
            # Добавляем флаг, что результат из кеша
            return {**cached_result, "cached": True}
        
        # Базовый анализ (локальный)
        local_analysis = self._local_analysis(code)
        
        # LLM анализ через SciBox
        try:
            llm_analysis = await self._llm_analysis(code, task_description)
        except Exception as e:
            print(f"[CodeAnalyzer] LLM analysis error: {e}")
            llm_analysis = {
                "originality_score": 50,
                "suspicious_patterns": [f"Ошибка LLM анализа: {str(e)}"],
                "explanation": "Не удалось проанализировать код через LLM"
            }
        
        # Объединяем результаты
        result = {
            "originality_score": self._combine_scores(
                local_analysis.get("score", 50),
                llm_analysis.get("originality_score", 50)
            ),
            "local_analysis": local_analysis,
            "llm_analysis": llm_analysis,
            "suspicious_patterns": llm_analysis.get("suspicious_patterns", []),
            "explanation": llm_analysis.get("explanation", ""),
            "code_hash": code_hash,
            "code_length": len(code),
            "cached": False
        }
        
        # Сохраняем в кеш
        self.code_cache[code_hash] = result
        
        return result
    
    def _generate_code_hash(self, code: str) -> str:
        """Генерировать хеш кода"""
        # Нормализуем код (убираем пробелы, комментарии для сравнения)
        normalized = self._normalize_code(code)
        return hashlib.sha256(normalized.encode()).hexdigest()
    
    def _normalize_code(self, code: str) -> str:
        """Нормализовать код для сравнения"""
        # Убираем комментарии и лишние пробелы
        lines = code.split('\n')
        normalized_lines = []
        for line in lines:
            # Убираем однострочные комментарии
            if '//' in line:
                line = line[:line.index('//')]
            # Убираем пробелы в начале и конце
            line = line.strip()
            if line:
                normalized_lines.append(line)
        return '\n'.join(normalized_lines)
    
    def _local_analysis(self, code: str) -> Dict[str, Any]:
        """Локальный анализ кода (без LLM)"""
        lines = code.split('\n')
        non_empty_lines = [line for line in lines if line.strip()]
        
        # Проверка на подозрительные паттерны
        suspicious_patterns = []
        
        # Слишком маленький код (возможно, скопирован фрагмент)
        if len(non_empty_lines) < 3:
            suspicious_patterns.append("Очень короткий код")
        
        # Много комментариев (может быть из примера)
        comment_lines = [l for l in lines if l.strip().startswith('//') or '/*' in l]
        comment_ratio = len(comment_lines) / len(non_empty_lines) if non_empty_lines else 0
        if comment_ratio > 0.5:
            suspicious_patterns.append("Много комментариев (возможно из примера)")
        
        # Проверка на типичные паттерны из примеров
        common_patterns = [
            "// TODO:",
            "// FIXME:",
            "def solution(",
            "function solution(",
            "class Solution"
        ]
        found_patterns = [p for p in common_patterns if p in code]
        if found_patterns:
            suspicious_patterns.append(f"Типичные паттерны из примеров: {', '.join(found_patterns)}")
        
        # Базовый скор (чем больше подозрений, тем ниже)
        base_score = 100 - (len(suspicious_patterns) * 10)
        base_score = max(0, min(100, base_score))
        
        return {
            "score": base_score,
            "suspicious_patterns": suspicious_patterns,
            "line_count": len(non_empty_lines),
            "comment_ratio": comment_ratio
        }
    
    async def _llm_analysis(self, code: str, task_description: str) -> Dict[str, Any]:
        """Анализ через LLM (SciBox)"""
        # Используем синхронный вызов в async функции
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            lambda: self.scibox_client.analyze_code_originality(code, task_description)
        )
        return result
    
    def _combine_scores(self, local_score: int, llm_score: int) -> int:
        """Объединить локальный и LLM скоры"""
        # Взвешенное среднее: LLM важнее
        combined = (local_score * 0.3) + (llm_score * 0.7)
        return int(combined)
    
    async def compare_with_solutions(
        self,
        code: str,
        solutions: list[str]
    ) -> Dict[str, Any]:
        """
        Сравнить код с известными решениями
        
        Args:
            code: Код для сравнения
            solutions: Список известных решений
            
        Returns:
            Результаты сравнения
        """
        code_hash = self._generate_code_hash(code)
        
        # Проверяем точное совпадение
        for solution in solutions:
            solution_hash = self._generate_code_hash(solution)
            if code_hash == solution_hash:
                return {
                    "match_found": True,
                    "match_type": "exact",
                    "similarity": 100
                }
        
        # Проверяем похожесть через нормализацию
        normalized_code = self._normalize_code(code)
        max_similarity = 0
        
        for solution in solutions:
            normalized_solution = self._normalize_code(solution)
            similarity = self._calculate_similarity(normalized_code, normalized_solution)
            max_similarity = max(max_similarity, similarity)
        
        return {
            "match_found": max_similarity > 85,
            "match_type": "similar" if max_similarity > 85 else "none",
            "similarity": max_similarity
        }
    
    def _calculate_similarity(self, text1: str, text2: str) -> float:
        """Вычислить похожесть двух текстов (простой алгоритм)"""
        # Используем Jaccard similarity на словах
        words1 = set(text1.split())
        words2 = set(text2.split())
        
        if not words1 and not words2:
            return 100.0
        if not words1 or not words2:
            return 0.0
        
        intersection = len(words1 & words2)
        union = len(words1 | words2)
        
        return (intersection / union) * 100

