# Backend для прокторинг-системы VibeCode Jam

FastAPI-сервис для сбора событий мониторинга, расчёта риска и AI-проверки оригинальности кода через SciBox.

## Возможности
- Приём событий в реальном времени через WebSocket (`/ws/events`) или REST (`POST /events`).
- Расчёт риска с учётом частоты вставок, объёма вставленного кода, наличия подозрительных расширений, открытия DevTools и AI-вердикта.
- Анализ отправленного решения через SciBox LLM (offline-режим при отсутствии API-ключа).
- Дашбордные метрики по каждому участнику (`GET /participants` и `GET /participants/{id}`).

## Запуск локально
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Докер
Сервис упакован в Docker-образ.
```bash
cd backend
docker build -t vibecode-proctoring .
docker run -p 8000:8000 --env SCIBOX_API_KEY=... vibecode-proctoring
```

## Настройки SciBox
- `SCIBOX_API_KEY` — ключ для обращения к SciBox (если не задан, используется offline-эвристика).
- `SCIBOX_ENDPOINT` — кастомный endpoint, по умолчанию `https://api.scibox.ai/v1`.

## Ключевые эндпоинты
- `GET /health` — проверка состояния сервиса.
- `POST /events` — единичное событие (`type` = paste|extension|devtools, `payload` = объект события).
- `WS /ws/events` — потоковое получение/отправка событий и метрик в ответ.
- `POST /participants/{id}/submission` — отправка кода на AI-проверку.
- `GET /participants/{id}` — метрики конкретного участника.
- `GET /participants` — агрегированный список с сортировкой по риску.
