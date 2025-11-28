"""
Interview Session - Управление полным циклом интервью
"""
from typing import Dict, Any, List, Optional
from datetime import datetime
import uuid

from .resume_analyzer import ResumeAnalyzer
from .task_generator import TaskGenerator
from .solution_checker import SolutionChecker
from config.scibox import SciBoxClient


class InterviewSession:
    """
    Полный цикл автоматизированного интервью
    
    Этапы:
    1. Анализ резюме → определение уровня и навыков
    2. Генерация первой задачи → персонализированная под резюме
    3. Проверка решения → оценка + обратная связь
    4. Адаптация сложности → следующая задача
    5. Повторение 3-4 для N задач
    6. Финальный отчет → hire/reject с обоснованием
    """
    
    def __init__(self, scibox_client: SciBoxClient):
        self.client = scibox_client
        self.resume_analyzer = ResumeAnalyzer(scibox_client)
        self.task_generator = TaskGenerator(scibox_client)
        self.solution_checker = SolutionChecker(scibox_client)
        
        self.sessions: Dict[str, Dict[str, Any]] = {}  # session_id -> session_data
    
    async def start_interview(
        self,
        resume_text: str,
        job_position: str = "Backend Developer",
        num_tasks: int = 3
    ) -> Dict[str, Any]:
        """
        Начало интервью: анализ резюме и подготовка стратегии
        
        Args:
            resume_text: Текст резюме кандидата
            job_position: Целевая позиция
            num_tasks: Количество задач в интервью
        
        Returns:
            {
                "session_id": "uuid",
                "candidate_info": {...},
                "interview_strategy": {...},
                "first_task": {...},
                "status": "in_progress"
            }
        """
        session_id = str(uuid.uuid4())
        
        # 1. Анализ резюме
        print(f"[Session {session_id}] Analyzing resume...")
        resume_analysis = await self.resume_analyzer.analyze_resume(
            resume_text,
            job_position
        )
        
        # 2. Стратегия интервью
        strategy = await self.resume_analyzer.get_interview_strategy(
            resume_analysis,
            interview_type="technical"
        )
        
        # 3. Генерация первой задачи
        print(f"[Session {session_id}] Generating first task...")
        first_task = await self.task_generator.generate_task(
            candidate_level=strategy["start_level"],
            focus_skills=strategy["focus_areas"],
            task_number=1,
            resume_context=resume_analysis
        )
        
        # 4. Сохранение сессии
        self.sessions[session_id] = {
            "session_id": session_id,
            "job_position": job_position,
            "resume_analysis": resume_analysis,
            "strategy": strategy,
            "current_level": strategy["start_level"],
            "tasks": [first_task],
            "solutions": [],
            "scores": [],
            "num_tasks": num_tasks,
            "current_task_index": 0,
            "status": "in_progress",
            "started_at": datetime.utcnow().isoformat()
        }
        
        return {
            "session_id": session_id,
            "candidate_info": {
                "level": resume_analysis["candidate_level"],
                "experience_years": resume_analysis["experience_years"],
                "primary_skills": resume_analysis["primary_skills"]
            },
            "interview_strategy": strategy,
            "first_task": first_task,
            "personalized_questions": resume_analysis.get("personalized_questions", []),
            "status": "in_progress"
        }
    
    async def submit_solution(
        self,
        session_id: str,
        solution_code: str,
        test_results: Dict[str, Any],
        time_spent: int  # seconds
    ) -> Dict[str, Any]:
        """
        Прием и проверка решения задачи
        
        Args:
            session_id: ID сессии
            solution_code: Код решения
            test_results: Результаты выполнения тестов
            time_spent: Время на решение (секунды)
        
        Returns:
            {
                "evaluation": {...},
                "next_task": {...} or None,
                "interview_complete": False,
                "current_progress": {...}
            }
        """
        session = self.sessions.get(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")
        
        current_task = session["tasks"][session["current_task_index"]]
        
        # 1. Проверка решения
        print(f"[Session {session_id}] Checking solution for task {session['current_task_index'] + 1}...")
        evaluation = await self.solution_checker.check_solution(
            task=current_task,
            candidate_solution=solution_code,
            test_results=test_results,
            candidate_level=session["current_level"]
        )
        
        # 2. Сохранение результата
        session["solutions"].append({
            "task_id": current_task["task_id"],
            "code": solution_code,
            "time_spent": time_spent,
            "evaluation": evaluation,
            "submitted_at": datetime.utcnow().isoformat()
        })
        session["scores"].append(evaluation["score"])
        
        # 3. Проверка завершения интервью
        session["current_task_index"] += 1
        interview_complete = session["current_task_index"] >= session["num_tasks"]
        
        if interview_complete:
            session["status"] = "completed"
            session["completed_at"] = datetime.utcnow().isoformat()
            
            return {
                "evaluation": evaluation,
                "next_task": None,
                "interview_complete": True,
                "final_report": await self.generate_final_report(session_id)
            }
        
        # 4. Генерация следующей задачи (адаптивная)
        print(f"[Session {session_id}] Generating next task (adaptive)...")
        next_task = await self.task_generator.generate_task(
            candidate_level=session["current_level"],
            focus_skills=session["strategy"]["focus_areas"],
            task_number=session["current_task_index"] + 1,
            previous_performance={
                "score": evaluation["score"],
                "time": time_spent,
                "errors": test_results.get("failed_tests", 0)
            },
            resume_context=session["resume_analysis"]
        )
        
        session["tasks"].append(next_task)
        
        return {
            "evaluation": evaluation,
            "next_task": next_task,
            "interview_complete": False,
            "current_progress": {
                "completed_tasks": session["current_task_index"],
                "total_tasks": session["num_tasks"],
                "average_score": sum(session["scores"]) / len(session["scores"])
            }
        }
    
    async def generate_final_report(self, session_id: str) -> Dict[str, Any]:
        """
        Генерация финального отчета по интервью
        
        Включает:
        - Общий скор (0-100)
        - Вердикт (hire/reject)
        - Анализ сильных/слабых сторон
        - Детали по каждой задаче
        - Рекомендации
        """
        session = self.sessions.get(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")
        
        scores = session["scores"]
        solutions = session["solutions"]
        resume_analysis = session["resume_analysis"]
        
        # 1. Общие метрики
        average_score = sum(scores) / len(scores) if scores else 0
        passed_tasks = sum(1 for s in scores if s >= 60)
        
        # 2. LLM анализ всего интервью
        prompt = f"""Проанализируй интервью кандидата и дай рекомендацию.

Позиция: {session['job_position']}
Уровень кандидата: {resume_analysis['candidate_level']}
Опыт: {resume_analysis['experience_years']} лет
Навыки: {', '.join(resume_analysis['primary_skills'])}

Результаты задач:
"""
        for i, sol in enumerate(solutions, 1):
            prompt += f"\nЗадача {i}: {sol['evaluation']['score']}/100 - {sol['evaluation']['verdict']}\n"
        
        prompt += f"""
Средний балл: {average_score:.0f}/100
Успешно решено: {passed_tasks}/{len(scores)}

Дай финальный вердикт в JSON:
{{
  "decision": "hire" или "reject" или "maybe",
  "confidence": 85,
  "summary": "Краткое резюме на 2-3 предложения",
  "strengths": ["Сильная сторона 1", "Сильная сторона 2"],
  "weaknesses": ["Слабая сторона 1", "Слабая сторона 2"],
  "recommendations": ["Рекомендация 1", "Рекомендация 2"],
  "fit_for_level": "Middle"
}}"""

        try:
            content = await self.client.async_chat_completion(
                messages=[{"role": "user", "content": prompt}],
                model="qwen3-coder",
                temperature=0.5
            )
            
            llm_verdict = self._extract_json_from_text(content)
            
        except Exception as e:
            print(f"Error generating final report: {e}")
            llm_verdict = {
                "decision": "maybe",
                "confidence": 50,
                "summary": "Требуется дополнительная оценка",
                "strengths": [],
                "weaknesses": [],
                "recommendations": [],
                "fit_for_level": resume_analysis["candidate_level"]
            }
        
        # 3. Формирование отчета
        return {
            "session_id": session_id,
            "candidate_info": {
                "level": resume_analysis["candidate_level"],
                "experience": resume_analysis["experience_years"],
                "skills": resume_analysis["primary_skills"]
            },
            "interview_metrics": {
                "total_tasks": len(scores),
                "completed_tasks": len(scores),
                "average_score": average_score,
                "passed_tasks": passed_tasks,
                "total_time": sum(s["time_spent"] for s in solutions)
            },
            "task_details": [
                {
                    "task_number": i + 1,
                    "title": session["tasks"][i]["title"],
                    "score": sol["evaluation"]["score"],
                    "verdict": sol["evaluation"]["verdict"],
                    "time_spent": sol["time_spent"],
                    "feedback": sol["evaluation"]["feedback"]
                }
                for i, sol in enumerate(solutions)
            ],
            "final_verdict": llm_verdict,
            "decision": llm_verdict["decision"],
            "confidence": llm_verdict["confidence"],
            "summary": llm_verdict["summary"],
            "strengths": llm_verdict.get("strengths", []),
            "weaknesses": llm_verdict.get("weaknesses", []),
            "recommendations": llm_verdict.get("recommendations", []),
            "fit_for_level": llm_verdict.get("fit_for_level"),
            "completed_at": session.get("completed_at"),
            "duration": self._calculate_duration(session)
        }
    
    def _calculate_duration(self, session: Dict[str, Any]) -> int:
        """Расчет общей длительности интервью в секундах"""
        started = datetime.fromisoformat(session["started_at"])
        completed = datetime.fromisoformat(session.get("completed_at", datetime.utcnow().isoformat()))
        return int((completed - started).total_seconds())
    
    def _extract_json_from_text(self, text: str) -> Any:
        """Извлечение JSON из текста LLM"""
        import json
        import re
        
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
    
    def get_session_status(self, session_id: str) -> Dict[str, Any]:
        """Получить текущий статус сессии"""
        session = self.sessions.get(session_id)
        if not session:
            return {"error": "Session not found"}
        
        return {
            "session_id": session_id,
            "status": session["status"],
            "current_task": session["current_task_index"] + 1,
            "total_tasks": session["num_tasks"],
            "scores": session["scores"],
            "average_score": sum(session["scores"]) / len(session["scores"]) if session["scores"] else 0
        }


