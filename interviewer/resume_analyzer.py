"""
Resume Analyzer - Анализ резюме кандидата через LLM
Извлекает навыки, опыт, уровень и генерирует персонализированные вопросы
"""
from typing import Dict, Any, List, Optional
from datetime import datetime
import json
import re

from config.scibox import SciBoxClient


class ResumeAnalyzer:
    """
    Анализатор резюме для персонализации интервью
    
    Использует LLM для:
    - Парсинга структурированных данных из текста резюме
    - Определения уровня кандидата (Junior/Middle/Senior)
    - Выявления ключевых навыков и технологий
    - Генерации персонализированных вопросов
    """
    
    def __init__(self, scibox_client: SciBoxClient):
        self.client = scibox_client
    
    async def analyze_resume(
        self,
        resume_text: str,
        job_position: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Полный анализ резюме
        
        Args:
            resume_text: Текст резюме (PDF/DOCX конвертирован в текст)
            job_position: Целевая позиция (для фокусировки вопросов)
        
        Returns:
            {
                "candidate_level": "Junior|Middle|Senior",
                "experience_years": 3,
                "primary_skills": ["Python", "FastAPI", "PostgreSQL"],
                "secondary_skills": ["Docker", "Redis", "asyncio"],
                "frameworks": ["Django", "Flask"],
                "projects": [{...}],
                "education": {...},
                "strengths": ["Опыт с микросервисами", "Знание CI/CD"],
                "weaknesses": ["Нет опыта с Kubernetes"],
                "recommended_level": "Middle",
                "personalized_questions": [...]
            }
        """
        # 1. Парсинг резюме через LLM
        parsed_data = await self._parse_resume_structure(resume_text)
        
        # 2. Определение уровня
        candidate_level = await self._determine_level(parsed_data)
        
        # 3. Анализ навыков
        skills_analysis = await self._analyze_skills(parsed_data, job_position)
        
        # 4. Генерация персонализированных вопросов
        questions = await self._generate_personalized_questions(
            parsed_data,
            candidate_level,
            job_position
        )
        
        return {
            "candidate_level": candidate_level,
            "experience_years": parsed_data.get("experience_years", 0),
            "primary_skills": skills_analysis["primary"],
            "secondary_skills": skills_analysis["secondary"],
            "frameworks": parsed_data.get("frameworks", []),
            "projects": parsed_data.get("projects", []),
            "education": parsed_data.get("education", {}),
            "strengths": skills_analysis["strengths"],
            "gaps": skills_analysis["gaps"],
            "recommended_level": candidate_level,
            "personalized_questions": questions,
            "analysis_timestamp": datetime.utcnow().isoformat()
        }
    
    async def _parse_resume_structure(self, resume_text: str) -> Dict[str, Any]:
        """
        Извлечение структурированных данных из резюме
        
        LLM промпт для извлечения:
        - Имя, контакты
        - Опыт работы (компании, должности, период)
        - Навыки (языки, фреймворки, инструменты)
        - Проекты
        - Образование
        """
        prompt = f"""Проанализируй резюме и извлеки структурированную информацию.

Резюме:
{resume_text[:4000]}  # Ограничение на токены

Верни JSON в формате:
{{
  "name": "Имя Фамилия",
  "experience_years": 3,
  "positions": [
    {{
      "title": "Backend Developer",
      "company": "Tech Corp",
      "duration": "2 года",
      "technologies": ["Python", "Django", "PostgreSQL"]
    }}
  ],
  "skills": {{
    "languages": ["Python", "JavaScript"],
    "frameworks": ["FastAPI", "React"],
    "databases": ["PostgreSQL", "MongoDB"],
    "tools": ["Docker", "Git", "CI/CD"]
  }},
  "projects": [
    {{
      "name": "E-commerce API",
      "description": "REST API с 50k+ пользователей",
      "technologies": ["Python", "FastAPI", "Redis"]
    }}
  ],
  "education": {{
    "degree": "Бакалавр",
    "field": "Компьютерные науки",
    "university": "МГУ"
  }}
}}

Будь точным. Если информация отсутствует, укажи null."""

        try:
            content = await self.client.async_chat_completion(
                messages=[{"role": "user", "content": prompt}],
                model="qwen3-coder",  # Хорошо парсит структурированные данные
                temperature=0.3  # Низкая для точности
            )
            
            # Извлечение JSON из ответа
            parsed = self._extract_json_from_text(content)
            
            return parsed
            
        except Exception as e:
            print(f"Error parsing resume: {e}")
            return {}
    
    async def _determine_level(self, parsed_data: Dict[str, Any]) -> str:
        """
        Определение уровня кандидата на основе опыта и навыков
        
        Критерии:
        - Junior: 0-2 года, базовые навыки
        - Middle: 2-5 лет, знание архитектуры, работа с БД
        - Senior: 5+ лет, системный дизайн, лидерство
        """
        experience_years = parsed_data.get("experience_years", 0)
        positions = parsed_data.get("positions", [])
        skills = parsed_data.get("skills", {})
        
        # Быстрая эвристика
        if experience_years >= 5:
            return "Senior"
        elif experience_years >= 2:
            return "Middle"
        else:
            return "Junior"
    
    async def _analyze_skills(
        self,
        parsed_data: Dict[str, Any],
        job_position: Optional[str]
    ) -> Dict[str, Any]:
        """
        Анализ навыков: сильные стороны и пробелы
        
        Сравнивает навыки кандидата с требованиями позиции
        """
        skills = parsed_data.get("skills", {})
        all_skills = []
        
        for category, skill_list in skills.items():
            all_skills.extend(skill_list)
        
        # LLM анализ: что хорошо, чего не хватает
        prompt = f"""Проанализируй навыки кандидата для позиции {job_position or 'Backend Developer'}.

Навыки кандидата:
{json.dumps(skills, ensure_ascii=False, indent=2)}

Опыт: {parsed_data.get('experience_years', 0)} лет

Верни JSON:
{{
  "primary": ["Топ-3 сильных навыка"],
  "secondary": ["Дополнительные навыки"],
  "strengths": ["Что выделяет кандидата"],
  "gaps": ["Чего не хватает для позиции"]
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
            print(f"Error analyzing skills: {e}")
            return {
                "primary": all_skills[:3],
                "secondary": all_skills[3:],
                "strengths": [],
                "gaps": []
            }
    
    async def _generate_personalized_questions(
        self,
        parsed_data: Dict[str, Any],
        candidate_level: str,
        job_position: Optional[str]
    ) -> List[Dict[str, Any]]:
        """
        Генерация персонализированных вопросов на основе резюме
        
        Типы вопросов:
        1. О проектах из резюме (детали реализации)
        2. О технологиях (проверка глубины знаний)
        3. Ситуационные (на основе опыта)
        """
        projects = parsed_data.get("projects", [])
        skills = parsed_data.get("skills", {})
        positions = parsed_data.get("positions", [])
        
        prompt = f"""Сгенерируй 5 персонализированных вопросов для технического интервью.

Кандидат: {candidate_level} уровень
Позиция: {job_position or 'Backend Developer'}

Проекты:
{json.dumps(projects, ensure_ascii=False, indent=2)[:1000]}

Навыки:
{json.dumps(skills, ensure_ascii=False, indent=2)}

Опыт:
{json.dumps(positions, ensure_ascii=False, indent=2)[:1000]}

Правила:
1. Вопросы должны быть КОНКРЕТНЫМИ про опыт кандидата
2. Проверяй реальные знания, а не теорию
3. Каждый вопрос привязан к проекту/технологии из резюме

Формат ответа (JSON):
[
  {{
    "question": "В проекте X вы использовали FastAPI. Как вы решали проблему N+1 queries?",
    "type": "technical",
    "focus": "FastAPI",
    "difficulty": "middle"
  }},
  ...
]

Верни только JSON массив, без дополнительного текста."""

        try:
            content = await self.client.async_chat_completion(
                messages=[{"role": "user", "content": prompt}],
                model="qwen3-coder",
                temperature=0.7  # Креативность для разнообразия вопросов
            )
            
            questions = self._extract_json_from_text(content)
            
            # Проверка формата
            if isinstance(questions, list) and len(questions) > 0:
                return questions[:5]
            else:
                return self._get_fallback_questions(candidate_level)
            
        except Exception as e:
            print(f"Error generating questions: {e}")
            return self._get_fallback_questions(candidate_level)
    
    def _extract_json_from_text(self, text: str) -> Any:
        """
        Извлечение JSON из текста LLM (может быть обернут в markdown)
        """
        # Попытка 1: прямой парсинг
        try:
            return json.loads(text)
        except:
            pass
        
        # Попытка 2: извлечение из markdown блока
        json_match = re.search(r'```(?:json)?\s*(\{.*?\}|\[.*?\])\s*```', text, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group(1))
            except:
                pass
        
        # Попытка 3: поиск первого JSON объекта/массива
        json_match = re.search(r'(\{.*?\}|\[.*?\])', text, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group(1))
            except:
                pass
        
        return {}
    
    def _get_fallback_questions(self, level: str) -> List[Dict[str, Any]]:
        """Базовые вопросы если LLM не сработал"""
        base_questions = {
            "Junior": [
                {
                    "question": "Расскажите о вашем самом сложном проекте из резюме",
                    "type": "behavioral",
                    "focus": "projects",
                    "difficulty": "junior"
                },
                {
                    "question": "Какие технологии из вашего стека вы знаете лучше всего?",
                    "type": "technical",
                    "focus": "skills",
                    "difficulty": "junior"
                }
            ],
            "Middle": [
                {
                    "question": "Опишите архитектуру одного из ваших проектов",
                    "type": "technical",
                    "focus": "architecture",
                    "difficulty": "middle"
                },
                {
                    "question": "Как вы решали проблемы с производительностью?",
                    "type": "problem-solving",
                    "focus": "optimization",
                    "difficulty": "middle"
                }
            ],
            "Senior": [
                {
                    "question": "Как вы принимали технические решения в ваших проектах?",
                    "type": "leadership",
                    "focus": "decision-making",
                    "difficulty": "senior"
                },
                {
                    "question": "Опишите систему, которую вы проектировали с нуля",
                    "type": "system-design",
                    "focus": "architecture",
                    "difficulty": "senior"
                }
            ]
        }
        
        return base_questions.get(level, base_questions["Middle"])
    
    async def get_interview_strategy(
        self,
        resume_analysis: Dict[str, Any],
        interview_type: str = "technical"
    ) -> Dict[str, Any]:
        """
        Формирование стратегии интервью на основе резюме
        
        Args:
            resume_analysis: Результат analyze_resume()
            interview_type: technical | behavioral | mixed
        
        Returns:
            {
                "start_level": "Middle",
                "focus_areas": ["FastAPI", "PostgreSQL"],
                "time_allocation": {"coding": 40, "theory": 30, "projects": 30},
                "adaptive_strategy": "Начать с middle задач, адаптировать сложность"
            }
        """
        level = resume_analysis["candidate_level"]
        primary_skills = resume_analysis["primary_skills"]
        
        return {
            "start_level": level,
            "focus_areas": primary_skills[:3],
            "time_allocation": {
                "coding": 40,
                "theory": 30,
                "projects": 30
            },
            "adaptive_strategy": f"Начать с {level} задач, адаптировать по результатам",
            "red_flags": resume_analysis.get("gaps", []),
            "strengths_to_validate": resume_analysis.get("strengths", [])
        }


