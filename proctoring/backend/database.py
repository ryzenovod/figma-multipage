"""
Database module - Работа с PostgreSQL
"""
import os
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

# Опциональный импорт asyncpg
try:
    import asyncpg
    ASYNCPG_AVAILABLE = True
except ImportError:
    ASYNCPG_AVAILABLE = False
    asyncpg = None

_db_pool = None
_mock_db_singleton = None


async def init_db():
    """Инициализация подключения к БД"""
    global _db_pool
    
    if not ASYNCPG_AVAILABLE:
        print("⚠️  asyncpg not installed - continuing without database...")
        return
    
    database_url = os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/vibecodejam")
    
    try:
        _db_pool = await asyncpg.create_pool(
            database_url,
            min_size=2,
            max_size=10
        )
        
        # Создание таблиц
        await create_tables()
        
        print("✅ Database pool created")
        
    except Exception as e:
        print(f"❌ Error initializing database: {e}")
        # В режиме разработки можно работать без БД
        print("⚠️  Continuing without database...")


async def get_db():
    """Получить подключение к БД"""
    global _db_pool
    
    if _db_pool is None:
        await init_db()
    
    if _db_pool is None:
        # Возвращаем mock объект если БД недоступна (singleton)
        global _mock_db_singleton
        if _mock_db_singleton is None:
            _mock_db_singleton = MockDatabase()
        return _mock_db_singleton
    
    return _db_pool


async def create_tables():
    """Создание таблиц для прокторинга"""
    global _db_pool
    
    if _db_pool is None:
        return
    
    async with _db_pool.acquire() as conn:
        # Таблица событий прокторинга
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS proctoring_events (
                id SERIAL PRIMARY KEY,
                session_id VARCHAR(255) NOT NULL,
                candidate_id VARCHAR(255),
                event_type VARCHAR(50) NOT NULL,
                timestamp TIMESTAMP NOT NULL,
                metadata JSONB DEFAULT '{}',
                risk_score INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_proctoring_events_session 
            ON proctoring_events(session_id, timestamp);
        """)
        
        # Таблица снимков кода
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS code_snapshots (
                id SERIAL PRIMARY KEY,
                session_id VARCHAR(255) NOT NULL,
                task_id VARCHAR(255),
                timestamp TIMESTAMP NOT NULL,
                code_text TEXT NOT NULL,
                code_hash VARCHAR(64),
                language VARCHAR(20) DEFAULT 'python',
                originality_score INTEGER,
                llm_analysis JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_code_snapshots_session 
            ON code_snapshots(session_id, task_id);
        """)
        
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_code_snapshots_hash 
            ON code_snapshots(code_hash);
        """)
        
        # Таблица скоринга
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS proctoring_scores (
                id SERIAL PRIMARY KEY,
                session_id VARCHAR(255) UNIQUE NOT NULL,
                task_id VARCHAR(255),
                timestamp TIMESTAMP NOT NULL,
                rule_based_score INTEGER DEFAULT 0,
                llm_risk_score INTEGER,
                final_score INTEGER DEFAULT 0,
                flagged_events TEXT[] DEFAULT '{}',
                llm_recommendation VARCHAR(20),
                llm_reasoning TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_proctoring_scores_session 
            ON proctoring_scores(session_id);
        """)
        
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_proctoring_scores_final 
            ON proctoring_scores(final_score);
        """)
        
        print("✅ Database tables created")


class MockDatabase:
    """Mock объект для работы без БД (in-memory)"""
    def __init__(self):
        self._events = []  # [{session_id, event_type, timestamp(datetime), metadata(dict)}]
        self._scores = {}  # {session_id: {rule_based_score, llm_risk_score, final_score, flagged_events, ...}}

    async def execute(self, query, *args):
        """Mock execute: поддержка INSERT INTO proctoring_events и proctoring_scores"""
        q = (query or '').lower()
        if 'insert into proctoring_events' in q:
            # ожидается порядок аргументов как в main.py: sessionId, event_type, timestamp, metadata
            try:
                session_id, event_type, ts, metadata = args
            except Exception:
                return None
            self._events.append({
                'session_id': session_id,
                'event_type': event_type,
                'timestamp': ts,   # datetime
                'metadata': metadata or {}
            })
        elif 'insert into proctoring_scores' in q:
            # Поддержка INSERT INTO proctoring_scores с ON CONFLICT DO UPDATE
            # Аргументы: session_id, timestamp, rule_based_score, llm_risk_score, final_score, flagged_events
            try:
                session_id, timestamp, rule_based_score, llm_risk_score, final_score, flagged_events = args
            except Exception:
                return None
            self._scores[session_id] = {
                'rule_based_score': rule_based_score,
                'llm_risk_score': llm_risk_score,
                'final_score': final_score,
                'flagged_events': flagged_events or [],
                'timestamp': timestamp,
                'llm_recommendation': None,
                'llm_reasoning': None
            }
        elif 'update proctoring_scores' in q:
            # Поддержка UPDATE proctoring_scores SET llm_recommendation = $1, llm_reasoning = $2 WHERE session_id = $3
            if 'llm_recommendation' in q and len(args) >= 3:
                llm_recommendation, llm_reasoning, session_id = args[0], args[1], args[2]
                if session_id in self._scores:
                    self._scores[session_id]['llm_recommendation'] = llm_recommendation
                    self._scores[session_id]['llm_reasoning'] = llm_reasoning
        return None

    async def fetch(self, query, *args):
        """Mock fetch: поддержка SELECT ... FROM proctoring_events WHERE session_id = $1 AND timestamp >= $2"""
        q = (query or '').lower()
        if 'from proctoring_events' in q:
            if len(args) >= 2:
                session_id, since_dt = args[0], args[1]
            else:
                session_id, since_dt = (args[0] if args else None), None
            rows = []
            for e in self._events:
                if session_id and e['session_id'] != session_id:
                    continue
                if since_dt and e['timestamp'] < since_dt:
                    continue
                rows.append({
                    'event_type': e['event_type'],
                    'timestamp': e['timestamp'],
                    'metadata': e.get('metadata') or {}
                })
            # Эмуляция ORDER BY timestamp ASC
            rows.sort(key=lambda r: r['timestamp'])
            return rows
        return []

    async def fetchrow(self, query, *args):
        """Mock fetchrow: поддержка SELECT ... FROM proctoring_scores WHERE session_id = $1"""
        q = (query or '').lower()
        if 'from proctoring_scores' in q and len(args) >= 1:
            session_id = args[0]
            score_data = self._scores.get(session_id)
            if score_data:
                return score_data
        return None

    async def fetchval(self, query, *args):
        return None



async def close_db():
    """Закрыть пул подключений"""
    global _db_pool
    
    if _db_pool:
        await _db_pool.close()
        _db_pool = None
        print("✅ Database pool closed")

