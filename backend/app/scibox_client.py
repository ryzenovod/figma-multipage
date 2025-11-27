import os
from typing import Optional

import httpx

from .models import AIVerdict


class SciBoxClient:
    """Минимальный клиент для работы с SciBox.

    Если ключ API отсутствует, клиент работает в offline-режиме и возвращает
    эвристический ответ, чтобы система могла работать в изолированной среде.
    """

    def __init__(self, api_key: Optional[str] = None, endpoint: Optional[str] = None):
        self.api_key = api_key or os.getenv("SCIBOX_API_KEY")
        self.endpoint = endpoint or os.getenv("SCIBOX_ENDPOINT", "https://api.scibox.ai/v1")
        self._client = httpx.AsyncClient(timeout=10.0)

    async def close(self) -> None:
        await self._client.aclose()

    async def score_originality(self, code: str, language: Optional[str] = None) -> AIVerdict:
        if not self.api_key:
            # Offline режим: используем простую эвристику по размеру кода
            originality = 0.35 if len(code) > 1200 else 0.82
            copied = originality < 0.5
            explanation = (
                "Offline-оценка: длинные вставки считаем подозрительными" if copied else "Код выглядит оригинальным"
            )
            return AIVerdict(originality_score=originality, is_copied=copied, explanation=explanation)

        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        payload = {"model": "qwen3-coder", "code": code, "language": language or "unknown"}

        response = await self._client.post(f"{self.endpoint}/code/originality", json=payload, headers=headers)
        response.raise_for_status()
        data = response.json()

        return AIVerdict(
            originality_score=data.get("originality_score", 0.0),
            is_copied=data.get("copied", False),
            explanation=data.get("explanation", "Ответ от SciBox")
        )
