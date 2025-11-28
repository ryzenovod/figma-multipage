"""
Code Originality Analyzer - Система верификации оригинальности решения

Использует SciBox LLM для анализа кода на признаки копирования.
Критерий: Система верификации оригинальности решения
"""

import sys
from pathlib import Path

# Добавляем корневую директорию в путь
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from config.scibox import get_scibox_client
from typing import Dict, Any, List, Optional
import hashlib
import json


class CodeOriginalityAnalyzer:
    """Анализатор оригинальности кода"""
    
    def __init__(self):
        self.scibox_client = get_scibox_client()
        self.code_cache = {}  # Кеш для уже проанализированного кода
    
    def analyze(
        self,
        code: str,
        task_description: str,
        language: str = "python",
        candidate_level: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Анализ кода на оригинальность
        
        Args:
            code: Код для анализа
            task_description: Описание задачи
            language: Язык программирования
            candidate_level: Уровень кандидата (junior/middle/senior)
            
        Returns:
            Словарь с результатами анализа:
            {
                "originality_score": 0-100,
                "suspicious_patterns": [...],
                "explanation": "...",
                "method": "llm" | "embedding" | "both"
            }
        """
        # Проверяем кеш
        code_hash = self._hash_code(code)
        if code_hash in self.code_cache:
            cached_result = self.code_cache[code_hash].copy()
            cached_result['cached'] = True
            return cached_result
        
        # Метод 1: LLM анализ через qwen3-coder
        llm_result = self._analyze_with_llm(code, task_description, language, candidate_level)
        
        # Метод 2: Эмбеддинг сравнение (если есть база решений)
        embedding_result = self._analyze_with_embeddings(code, task_description)
        
        # Комбинируем результаты
        result = self._combine_results(llm_result, embedding_result, code, task_description)
        
        # Сохраняем в кеш
        self.code_cache[code_hash] = result.copy()
        
        # Ограничиваем размер кеша
        if len(self.code_cache) > 1000:
            # Удаляем самые старые записи (простая стратегия - удаляем первые 100)
            keys_to_remove = list(self.code_cache.keys())[:100]
            for key in keys_to_remove:
                del self.code_cache[key]
        
        return result
    
    def _analyze_with_llm(
        self,
        code: str,
        task_description: str,
        language: str,
        candidate_level: Optional[str]
    ) -> Dict[str, Any]:
        """Анализ через LLM (qwen3-coder)"""
        try:
            result = self.scibox_client.analyze_code_originality(
                code=code,
                task_description=task_description
            )
            
            return {
                "originality_score": result.get("originality_score", 50),
                "suspicious_patterns": result.get("suspicious_patterns", []),
                "explanation": result.get("explanation", ""),
                "method": "llm",
                "success": True
            }
        except Exception as e:
            print(f"[CodeOriginalityAnalyzer] LLM analysis error: {e}")
            return {
                "originality_score": 50,
                "suspicious_patterns": [],
                "explanation": f"Ошибка анализа: {str(e)}",
                "method": "llm",
                "success": False,
                "error": str(e)
            }
    
    def _analyze_with_embeddings(
        self,
        code: str,
        task_description: str
    ) -> Dict[str, Any]:
        """Анализ через эмбеддинги (bge-m3)"""
        try:
            # Генерируем эмбеддинг для кода
            embedding = self.scibox_client.generate_embedding(code)
            
            # TODO: Сравнение с базой эталонных решений
            # Пока возвращаем только эмбеддинг
            return {
                "embedding": embedding,
                "similarity_score": None,  # Будет заполнено при наличии базы
                "method": "embedding",
                "success": True
            }
        except Exception as e:
            print(f"[CodeOriginalityAnalyzer] Embedding analysis error: {e}")
            return {
                "embedding": None,
                "similarity_score": None,
                "method": "embedding",
                "success": False,
                "error": str(e)
            }
    
    def _combine_results(
        self,
        llm_result: Dict[str, Any],
        embedding_result: Dict[str, Any],
        code: str,
        task_description: str
    ) -> Dict[str, Any]:
        """Комбинирование результатов разных методов"""
        
        # Базовый результат из LLM
        result = {
            "originality_score": llm_result.get("originality_score", 50),
            "suspicious_patterns": llm_result.get("suspicious_patterns", []),
            "explanation": llm_result.get("explanation", ""),
            "method": "llm"
        }
        
        # Если есть результат эмбеддинга, комбинируем
        if embedding_result.get("similarity_score") is not None:
            similarity = embedding_result["similarity_score"]
            
            # Если найдено похожее решение (>85% схожести)
            if similarity > 0.85:
                result["originality_score"] = max(0, result["originality_score"] - 30)
                result["suspicious_patterns"].append(f"Найдено очень похожее решение (схожесть: {similarity:.2%})")
                result["method"] = "both"
            elif similarity > 0.70:
                result["originality_score"] = max(0, result["originality_score"] - 15)
                result["suspicious_patterns"].append(f"Найдено похожее решение (схожесть: {similarity:.2%})")
                result["method"] = "both"
        
        # Дополнительные проверки
        result["analysis"] = {
            "code_length": len(code),
            "lines_count": code.count("\n") + 1,
            "complexity_indicators": self._analyze_complexity_indicators(code)
        }
        
        return result
    
    def _analyze_complexity_indicators(self, code: str) -> Dict[str, Any]:
        """Анализ индикаторов сложности кода"""
        return {
            "has_functions": "def " in code or "function " in code or "const " in code,
            "has_classes": "class " in code,
            "has_imports": "import " in code or "from " in code,
            "has_comments": "//" in code or "#" in code or "/*" in code,
            "has_docstrings": '"""' in code or "'''" in code
        }
    
    def _hash_code(self, code: str) -> str:
        """Вычислить хеш кода для кеширования"""
        normalized_code = code.strip().replace("\r\n", "\n").replace("\r", "\n")
        return hashlib.sha256(normalized_code.encode("utf-8")).hexdigest()
    
    def find_similar_solutions(
        self,
        code: str,
        task_id: Optional[str] = None,
        threshold: float = 0.85
    ) -> List[Dict[str, Any]]:
        """
        Найти похожие решения в базе данных
        
        Args:
            code: Код для поиска
            task_id: ID задачи (если указан, ищем только для этой задачи)
            threshold: Порог схожести (0-1)
            
        Returns:
            Список похожих решений с оценкой схожести
        """
        try:
            # Генерируем эмбеддинг
            embedding = self.scibox_client.generate_embedding(code)
            
            # TODO: Векторный поиск в базе данных
            # Пока возвращаем пустой список
            return []
        except Exception as e:
            print(f"[CodeOriginalityAnalyzer] Error finding similar solutions: {e}")
            return []
    
    def compare_with_solution(
        self,
        code1: str,
        code2: str
    ) -> Dict[str, Any]:
        """
        Сравнить два решения
        
        Args:
            code1: Первое решение
            code2: Второе решение
            
        Returns:
            Результат сравнения с оценкой схожести
        """
        try:
            # Генерируем эмбеддинги
            embedding1 = self.scibox_client.generate_embedding(code1)
            embedding2 = self.scibox_client.generate_embedding(code2)
            
            # Вычисляем косинусное сходство
            similarity = self._cosine_similarity(embedding1, embedding2)
            
            return {
                "similarity": similarity,
                "is_suspicious": similarity > 0.85,
                "interpretation": self._interpret_similarity(similarity)
            }
        except Exception as e:
            print(f"[CodeOriginalityAnalyzer] Error comparing solutions: {e}")
            return {
                "similarity": 0.0,
                "is_suspicious": False,
                "error": str(e)
            }
    
    def _cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """Вычислить косинусное сходство между двумя векторами"""
        try:
            import numpy as np
            
            vec1 = np.array(vec1)
            vec2 = np.array(vec2)
            
            dot_product = np.dot(vec1, vec2)
            norm1 = np.linalg.norm(vec1)
            norm2 = np.linalg.norm(vec2)
            
            if norm1 == 0 or norm2 == 0:
                return 0.0
            
            return float(dot_product / (norm1 * norm2))
        except ImportError:
            # Fallback на чистый Python, если numpy не установлен
            if len(vec1) != len(vec2):
                return 0.0
            
            dot_product = sum(a * b for a, b in zip(vec1, vec2))
            norm1 = sum(a * a for a in vec1) ** 0.5
            norm2 = sum(b * b for b in vec2) ** 0.5
            
            if norm1 == 0 or norm2 == 0:
                return 0.0
            
            return dot_product / (norm1 * norm2)
    
    def _interpret_similarity(self, similarity: float) -> str:
        """Интерпретация значения схожести"""
        if similarity > 0.95:
            return "Код практически идентичен - высокий риск копирования"
        elif similarity > 0.85:
            return "Код очень похож - возможное копирование"
        elif similarity > 0.70:
            return "Код похож, но могут быть законные совпадения"
        elif similarity > 0.50:
            return "Умеренное сходство - возможно использование похожего подхода"
        else:
            return "Код отличается - вероятно оригинальное решение"


# Singleton instance
_analyzer_instance: Optional[CodeOriginalityAnalyzer] = None


def get_code_originality_analyzer() -> CodeOriginalityAnalyzer:
    """Получить singleton экземпляр анализатора"""
    global _analyzer_instance
    if _analyzer_instance is None:
        _analyzer_instance = CodeOriginalityAnalyzer()
    return _analyzer_instance


if __name__ == "__main__":
    # Тест анализатора
    analyzer = CodeOriginalityAnalyzer()
    
    test_code = """
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)
"""
    
    result = analyzer.analyze(
        code=test_code,
        task_description="Реализовать функцию вычисления чисел Фибоначчи",
        language="python",
        candidate_level="junior"
    )
    
    print(json.dumps(result, indent=2, ensure_ascii=False))

