"""
SciBox LLM API Configuration and Client
"""
import os
from typing import Optional, Dict, Any, List
import requests
from datetime import datetime
import time
from queue import Queue
import threading
import asyncio
from dotenv import load_dotenv


class SciBoxConfig:
    """Configuration for SciBox LLM API"""
    
    def __init__(self):
        # Load environment variables from .env if present
        load_dotenv()
        self.api_key = os.getenv("SCIBOX_API_KEY")
        self.base_url = os.getenv("SCIBOX_BASE_URL", "https://llm.t1v.scibox.tech")
        
        if not self.api_key:
            raise ValueError("SCIBOX_API_KEY environment variable is not set")
        
        # Models and their RPS limits
        self.models = {
            "bge-m3": {
                "name": "bge-m3",
                "rps": 7,
                "type": "embedding",
                "description": "Эмбеддинг-модель для поиска и ранжирования"
            },
            "qwen3-coder": {
                "name": "qwen3-coder-30b-a3b-instruct-fp8",
                "rps": 2,
                "type": "chat",
                "description": "Инструкционная кодовая модель"
            },
            "qwen3-awq": {
                "name": "qwen3-32b-awq",
                "rps": 2,
                "type": "chat",
                "description": "Универсальная чат-модель"
            }
        }
        
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
    
    def get_models_url(self) -> str:
        """Get URL for listing models"""
        return f"{self.base_url}/v1/models"
    
    def get_chat_url(self) -> str:
        """Get URL for chat completions"""
        return f"{self.base_url}/v1/chat/completions"
    
    def get_embeddings_url(self) -> str:
        """Get URL for embeddings"""
        return f"{self.base_url}/v1/embeddings"


class RateLimiter:
    """Rate limiter for API requests respecting RPS limits"""
    
    def __init__(self, rps: int):
        self.rps = rps
        self.min_interval = 1.0 / rps  # Minimum interval between requests
        self.last_request_time = {}
        self.lock = threading.Lock()
    
    def wait_if_needed(self, model: str):
        """Wait if necessary to respect rate limit"""
        with self.lock:
            current_time = time.time()
            last_time = self.last_request_time.get(model, 0)
            elapsed = current_time - last_time
            
            if elapsed < self.min_interval:
                sleep_time = self.min_interval - elapsed
                time.sleep(sleep_time)
            
            self.last_request_time[model] = time.time()


class SciBoxClient:
    """Client for SciBox LLM API with rate limiting"""
    
    def __init__(self, config: Optional[SciBoxConfig] = None):
        self.config = config or SciBoxConfig()
        self.rate_limiters = {
            model_name: RateLimiter(model_config["rps"])
            for model_name, model_config in self.config.models.items()
        }
        self.session = requests.Session()
        self.session.headers.update(self.config.headers)
    
    def list_models(self) -> List[Dict[str, Any]]:
        """Get list of available models"""
        response = self.session.get(self.config.get_models_url())
        response.raise_for_status()
        return response.json().get("data", [])
    
    def generate_embedding(
        self, 
        text: str, 
        model: str = "bge-m3"
    ) -> List[float]:
        """
        Generate embedding using bge-m3 model
        
        Args:
            text: Input text to embed
            model: Model name (default: bge-m3)
            
        Returns:
            List of embedding values
        """
        if model != "bge-m3":
            raise ValueError(f"Embeddings only supported with bge-m3 model, got {model}")
        
        self.rate_limiters["bge-m3"].wait_if_needed("bge-m3")
        
        payload = {
            "model": self.config.models["bge-m3"]["name"],
            "input": text
        }
        
        response = self.session.post(
            self.config.get_embeddings_url(),
            json=payload
        )
        response.raise_for_status()
        
        data = response.json()
        return data["data"][0]["embedding"]
    
    def chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: str = "qwen3-awq",
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> str:
        """
        Generate chat completion
        
        Args:
            messages: List of message dicts with "role" and "content"
            model: Model name (qwen3-coder or qwen3-awq)
            temperature: Sampling temperature
            max_tokens: Maximum tokens to generate
            
        Returns:
            Generated text response
        """
        model_key = "qwen3-coder" if "coder" in model.lower() else "qwen3-awq"
        self.rate_limiters[model_key].wait_if_needed(model_key)
        
        model_name = self.config.models[model_key]["name"]
        
        payload = {
            "model": model_name,
            "messages": messages,
            "temperature": temperature,
            **kwargs
        }
        
        if max_tokens:
            payload["max_tokens"] = max_tokens
        
        response = self.session.post(
            self.config.get_chat_url(),
            json=payload
        )
        response.raise_for_status()
        
        data = response.json()
        return data["choices"][0]["message"]["content"]

    # --- Async convenience wrappers (run sync client in thread) ---
    async def async_chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: str = "qwen3-awq",
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> str:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            lambda: self.chat_completion(
                messages=messages,
                model=model,
                temperature=temperature,
                max_tokens=max_tokens,
                **kwargs,
            ),
        )

    async def async_generate_embedding(
        self,
        text: str,
        model: str = "bge-m3",
    ) -> List[float]:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            lambda: self.generate_embedding(text, model=model),
        )

    # Backwards-compatible alias used by interviewer modules
    def create_embedding(self, input_text: str, model: str = "bge-m3") -> List[float]:
        return self.generate_embedding(input_text, model=model)
    
    def analyze_code_originality(
        self,
        code: str,
        task_description: str
    ) -> Dict[str, Any]:
        """
        Analyze code for signs of copying using qwen3-coder
        
        Args:
            code: Code snippet to analyze
            task_description: Description of the task
            
        Returns:
            Dictionary with originality_score, suspicious_patterns, explanation
        """
        prompt = f"""Проанализируй следующий код на признаки того, что он может быть скопирован из внешнего источника (GitHub, Stack Overflow, онлайн-репозиториев).

Код:
```python
{code}
```

Задача: {task_description}

Верни JSON с полями:
- originality_score: число от 0 до 100 (100 = полностью оригинальный)
- suspicious_patterns: список строк с подозрительными паттернами (может быть пустым)
- explanation: объяснение оценки

Отвечай ТОЛЬКО валидным JSON, без дополнительного текста."""
        
        messages = [
            {"role": "system", "content": "Ты - эксперт по анализу кода на оригинальность. Ты всегда отвечаешь валидным JSON."},
            {"role": "user", "content": prompt}
        ]
        
        try:
            response_text = self.chat_completion(
                messages=messages,
                model="qwen3-coder",
                temperature=0.3
            )
            
            # Parse JSON from response
            import json
            # Try to extract JSON from response (might have markdown code blocks)
            response_text = response_text.strip()
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.startswith("```"):
                response_text = response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            response_text = response_text.strip()
            
            return json.loads(response_text)
        except Exception as e:
            return {
                "originality_score": 50,
                "suspicious_patterns": [f"Ошибка анализа: {str(e)}"],
                "explanation": "Не удалось проанализировать код"
            }
    
    def analyze_proctoring_behavior(
        self,
        events: List[Dict[str, Any]],
        task_description: str,
        elapsed_time: int,
        candidate_level: str
    ) -> Dict[str, Any]:
        """
        Analyze proctoring events for cheating signs using qwen3-awq
        
        Args:
            events: List of proctoring events
            task_description: Description of the task
            elapsed_time: Time spent on task in minutes
            candidate_level: Candidate level (junior/middle/senior)
            
        Returns:
            Dictionary with risk_score, flagged_events, reasoning, recommendation
        """
        import json
        
        prompt = f"""Проанализируй следующую историю событий прокторинга и определи, есть ли признаки читерства:

События:
{json.dumps(events, indent=2, ensure_ascii=False)}

Задача: {task_description}
Время решения: {elapsed_time} минут
Уровень кандидата: {candidate_level}

Верни JSON с полями:
- risk_score: число от 0 до 100 (риск читерства, 0 = нет риска, 100 = точно читерство)
- flagged_events: список типов событий, которые подозрительны
- reasoning: объяснение оценки на русском языке
- recommendation: одно из значений: "pass" (все ок), "watch" (наблюдать), "fail" (подозрение в читерстве)

Отвечай ТОЛЬКО валидным JSON, без дополнительного текста."""
        
        messages = [
            {"role": "system", "content": "Ты - эксперт по детектированию читерства на технических собеседованиях. Ты всегда отвечаешь валидным JSON."},
            {"role": "user", "content": prompt}
        ]
        
        try:
            response_text = self.chat_completion(
                messages=messages,
                model="qwen3-awq",
                temperature=0.3,
                max_tokens=1000
            )
            
            # Parse JSON from response
            response_text = response_text.strip()
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.startswith("```"):
                response_text = response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            response_text = response_text.strip()
            
            return json.loads(response_text)
        except Exception as e:
            return {
                "risk_score": 50,
                "flagged_events": [],
                "reasoning": f"Ошибка анализа: {str(e)}",
                "recommendation": "watch"
            }


# Singleton instance
_client_instance: Optional[SciBoxClient] = None


def get_scibox_client() -> SciBoxClient:
    """Get singleton SciBox client instance"""
    global _client_instance
    if _client_instance is None:
        _client_instance = SciBoxClient()
    return _client_instance

