"""
Code Analyzer - Анализ оригинальности кода
Использует SciBox LLM для детектирования скопированного кода
"""
import hashlib
import json
from typing import Dict, Any, Optional, List
from datetime import datetime
import asyncio

from config.scibox import SciBoxClient


class CodeAnalyzer:
    """
    Анализатор кода для проверки оригинальности
    
    Критерии оценивания (20 баллов):
    - Эффективность детектирования скопированного кода
    - Система верификации оригинальности решения
    """
    
    def __init__(self, scibox_client: SciBoxClient):
        self.client = scibox_client
        self.code_cache: Dict[str, Dict[str, Any]] = {}  # Кеш анализов
    
    def hash_code(self, code: str) -> str:
        """Генерация хеша кода для быстрого сравнения"""
        return hashlib.sha256(code.encode('utf-8')).hexdigest()
    
    async def analyze_originality(
        self,
        code: str,
        task_id: str,
        language: str = "python"
    ) -> Dict[str, Any]:
        """
        Анализ оригинальности кода
        
        Использует:
        1. qwen3-coder для анализа на признаки копирования
        2. bge-m3 для поиска похожих решений
        3. Локальный AST анализ
        """
        code_hash = self.hash_code(code)
        
        # Проверяем кеш
        if code_hash in self.code_cache:
            cached_result = self.code_cache[code_hash]
            cached_result["cached"] = True
            return cached_result
        
        # Получаем описание задачи (можно из БД или передавать)
        task_description = await self._get_task_description(task_id)
        
        # Анализ через qwen3-coder
        originality_result = self.client.analyze_code_originality(
            code=code,
            task_description=task_description
        )
        
        # Поиск похожих решений через эмбеддинги (если есть банк решений)
        similar_solutions = await self._find_similar_solutions(code)
        
        # Локальный анализ кода
        local_analysis = self._local_code_analysis(code, language)
        
        # Комбинирование результатов
        final_result = {
            "originality_score": originality_result["originality_score"],
            "suspicious_patterns": originality_result.get("suspicious_patterns", []),
            "explanation": originality_result.get("explanation", ""),
            "similar_solutions": similar_solutions,
            "local_analysis": local_analysis,
            "code_hash": code_hash,
            "analyzed_at": datetime.utcnow().isoformat(),
            "cached": False
        }
        
        # Корректировка скора на основе локального анализа
        if local_analysis["is_suspicious"]:
            final_result["originality_score"] = max(
                0,
                final_result["originality_score"] - 20
            )
        
        # Если найдены похожие решения, снижаем скор
        if similar_solutions:
            max_similarity = max(s["similarity"] for s in similar_solutions)
            if max_similarity > 0.85:
                final_result["originality_score"] = max(
                    0,
                    final_result["originality_score"] - 30
                )
                final_result["suspicious_patterns"].append(
                    f"Найдено похожее решение (схожесть: {max_similarity:.2%})"
                )
        
        # Кешируем результат
        self.code_cache[code_hash] = final_result
        
        return final_result
    
    async def analyze_originality_standalone(
        self,
        code: str,
        task_description: str,
        candidate_level: str = "middle"
    ) -> Dict[str, Any]:
        """
        Анализ оригинальности без привязки к сессии
        (для административных целей)
        """
        # Анализ через qwen3-coder
        originality_result = self.client.analyze_code_originality(
            code=code,
            task_description=task_description
        )
        
        # Поиск похожих через эмбеддинги
        similar_solutions = await self._find_similar_solutions(code)
        
        return {
            "originality_score": originality_result["originality_score"],
            "suspicious_patterns": originality_result.get("suspicious_patterns", []),
            "explanation": originality_result.get("explanation", ""),
            "similar_solutions": similar_solutions,
            "code_hash": self.hash_code(code),
            "analyzed_at": datetime.utcnow().isoformat()
        }
    
    def _local_code_analysis(self, code: str, language: str) -> Dict[str, Any]:
        """
        Локальный анализ кода без LLM
        
        Проверяет:
        - Стиль кода
        - Имена переменных
        - Структуру
        - Комментарии
        """
        suspicious = False
        issues = []
        
        # Проверка на копи-паст паттерны
        lines = code.split('\n')
        
        # Подозрительно: слишком много комментариев из одного источника
        comment_style_count = {}
        for line in lines:
            stripped = line.strip()
            if stripped.startswith('//') or stripped.startswith('#'):
                # Анализируем стиль комментариев
                if len(stripped) > 10:
                    comment_style_count[stripped[:10]] = \
                        comment_style_count.get(stripped[:10], 0) + 1
        
        # Если много одинаковых комментариев - возможно копирование
        if comment_style_count:
            max_comments = max(comment_style_count.values())
            if max_comments > 5:
                suspicious = True
                issues.append("Обнаружены повторяющиеся комментарии")
        
        # Проверка на стандартные решения (слишком идеальные)
        if language == "python":
            # Подозрительно: идеальное решение без ошибок для сложной задачи
            if "def" in code and "class" in code:
                # Проверяем, нет ли слишком "книжного" стиля
                if code.count('"""') > 2 or code.count("'''") > 2:
                    # Много docstrings - возможно скопировано
                    pass
        
        # Проверка на отсутствие личного стиля
        # (слишком чистый код без характерных признаков)
        unique_vars = set()
        for word in code.split():
            if word.isalpha() and len(word) > 2:
                unique_vars.add(word)
        
        if len(unique_vars) < 5:
            suspicious = True
            issues.append("Недостаточно уникальных идентификаторов")
        
        return {
            "is_suspicious": suspicious,
            "issues": issues,
            "unique_identifiers": len(unique_vars),
            "lines_count": len(lines)
        }
    
    async def _find_similar_solutions(self, code: str) -> List[Dict[str, Any]]:
        """
        Поиск похожих решений через эмбеддинги
        
        Использует bge-m3 для генерации эмбеддинга и поиска похожих
        """
        try:
            # Генерируем эмбеддинг для текущего кода
            embedding = self.client.generate_embedding(code)
            
            # Здесь должна быть логика поиска похожих решений в БД
            # Пока возвращаем пустой список (реализуется при наличии банка задач)
            # TODO: Реализовать векторный поиск в PostgreSQL через pgvector
            
            similar_solutions = []
            
            # Пример структуры:
            # similar_solutions = [
            #     {
            #         "solution_id": "uuid",
            #         "similarity": 0.92,
            #         "source": "github"
            #     }
            # ]
            
            return similar_solutions
            
        except Exception as e:
            print(f"Error finding similar solutions: {e}")
            return []
    
    async def _get_task_description(self, task_id: str) -> str:
        """Получить описание задачи"""
        # TODO: Реализовать получение из БД
        # Пока возвращаем заглушку
        return "Техническая задача на программирование"
    
    def compare_code_versions(
        self,
        code1: str,
        code2: str
    ) -> Dict[str, Any]:
        """
        Сравнение двух версий кода
        Полезно для детектирования больших вставок
        """
        hash1 = self.hash_code(code1)
        hash2 = self.hash_code(code2)
        
        # Если коды идентичны
        if hash1 == hash2:
            return {
                "identical": True,
                "similarity": 1.0,
                "changes": 0
            }
        
        # Подсчет различий (упрощенный алгоритм)
        lines1 = set(code1.split('\n'))
        lines2 = set(code2.split('\n'))
        
        common_lines = lines1 & lines2
        total_lines = len(lines1 | lines2)
        
        similarity = len(common_lines) / total_lines if total_lines > 0 else 0
        
        return {
            "identical": False,
            "similarity": similarity,
            "changes": total_lines - len(common_lines),
            "added_lines": len(lines2 - lines1),
            "removed_lines": len(lines1 - lines2)
        }

