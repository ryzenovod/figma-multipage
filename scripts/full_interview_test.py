#!/usr/bin/env python3
"""Full interview test: Resume → Tasks → Solution checking (2 LLM models)"""
import requests
import json
import time

BASE_URL = "http://localhost:8000"

def print_section(title):
    print(f"\n{'='*70}\n{title}\n{'='*70}")

def print_json(data):
    print(json.dumps(data, indent=2, ensure_ascii=False))

def main():
    # Test resume
    resume_text = """
    Иван Иванов
    Backend Developer, 3 года опыта
    
    Навыки: Python, FastAPI, PostgreSQL, Docker, Redis
    
    Опыт работы:
    - Tech Corp (2022-2024): разработка REST API для e-commerce
    - StartupXYZ (2021-2022): микросервисы на FastAPI
    
    Проекты:
    - API для системы рекомендаций (50k+ пользователей)
    - Система обработки платежей с Redis кешированием
    """
    
    print_section("1. START INTERVIEW - Resume Analysis (LLM Model 1: qwen3-coder)")
    print("Отправляем резюме для анализа...")
    
    start_payload = {
        "resumeText": resume_text,
        "jobPosition": "Backend Developer",
        "numTasks": 2
    }
    
    print("⏳ Ожидание LLM-анализа (ResumeAnalyzer + TaskGenerator)...")
    start_time = time.time()
    
    resp = requests.post(f"{BASE_URL}/api/interview/start", json=start_payload, timeout=120)
    
    elapsed = time.time() - start_time
    print(f"✅ Готово за {elapsed:.1f}s")
    
    result = resp.json()
    session_id = result["session_id"]
    
    print(f"\nSession ID: {session_id}")
    print(f"\nКандидат:")
    print_json(result["candidate_info"])
    
    print(f"\nСтратегия интервью:")
    print_json(result["interview_strategy"])
    
    print(f"\nПервая задача (адаптивная под резюме):")
    task = result["first_task"]
    print(f"  Название: {task.get('title', 'N/A')}")
    print(f"  Сложность: {task.get('difficulty', 'N/A')}")
    print(f"  Время: {task.get('estimated_time', 'N/A')} мин")
    if "requirements" in task:
        print(f"  Требования: {len(task['requirements'])} пунктов")
    
    # Симулируем решение задачи
    print_section("2. SUBMIT SOLUTION - Code Quality Check (LLM Model 2: qwen3-coder + bge-m3)")
    
    solution_code = """
def process_orders(orders):
    # Обработка заказов с кешированием
    result = []
    for order in orders:
        if order['status'] == 'pending':
            result.append(order['id'])
    return result
"""
    
    test_results = {
        "visible_passed": 2,
        "visible_total": 2,
        "hidden_passed": 4,
        "hidden_total": 5
    }
    
    submit_payload = {
        "sessionId": session_id,
        "solutionCode": solution_code,
        "testResults": test_results,
        "timeSpent": 900  # 15 минут
    }
    
    print("⏳ Ожидание проверки решения (SolutionChecker: 4 критерия)...")
    print("   - Корректность (40%)")
    print("   - Качество кода (30%)")
    print("   - Эффективность (20%)")
    print("   - Оригинальность через эмбеддинги bge-m3 (10%)")
    
    start_time = time.time()
    resp = requests.post(f"{BASE_URL}/api/interview/submit-solution", json=submit_payload, timeout=120)
    elapsed = time.time() - start_time
    
    print(f"✅ Готово за {elapsed:.1f}s")
    
    result = resp.json()
    
    print(f"\nОценка решения:")
    evaluation = result["evaluation"]
    print(f"  Общий балл: {evaluation['score']}/100")
    print(f"  Вердикт: {evaluation['verdict']}")
    
    print(f"\nДетали по критериям:")
    if "correctness" in evaluation:
        print(f"  ✓ Корректность: {evaluation['correctness'].get('pass_rate', 0):.0f}% тестов")
    if "quality" in evaluation:
        print(f"  ✓ Качество: {evaluation['quality'].get('overall_score', 0)}/100")
    if "efficiency" in evaluation:
        print(f"  ✓ Эффективность: {evaluation['efficiency'].get('efficiency_score', 0)}/100")
    if "originality" in evaluation:
        print(f"  ✓ Оригинальность: {evaluation['originality'].get('originality_score', 0)}/100")
    
    print(f"\nОбратная связь от LLM:")
    print(f"  {evaluation.get('feedback', 'N/A')[:200]}...")
    
    if result.get("interview_complete"):
        print_section("3. FINAL REPORT")
        report = result["final_report"]
        print(f"\nФинальное решение: {report['decision'].upper()}")
        print(f"Уверенность: {report['confidence']}%")
        print(f"\nСильные стороны:")
        for s in report.get("strengths", [])[:3]:
            print(f"  + {s}")
        print(f"\nСлабые стороны:")
        for w in report.get("weaknesses", [])[:3]:
            print(f"  - {w}")
    else:
        print(f"\nСледующая задача:")
        next_task = result.get("next_task", {})
        print(f"  Название: {next_task.get('title', 'N/A')}")
        print(f"  Сложность: {next_task.get('difficulty', 'N/A')}")
        
        progress = result.get("current_progress", {})
        print(f"\nПрогресс: {progress.get('completed_tasks', 0)}/{progress.get('total_tasks', 0)}")
        print(f"Средний балл: {progress.get('average_score', 0):.0f}/100")
    
    print_section("✅ FULL INTERVIEW TEST COMPLETE")
    print(f"Протестировано:")
    print(f"  ✓ ML Model 1 (ResumeAnalyzer + TaskGenerator) - qwen3-coder")
    print(f"  ✓ ML Model 2 (SolutionChecker) - qwen3-coder + bge-m3 embeddings")
    print(f"  ✓ Адаптивная генерация задач под профиль кандидата")
    print(f"  ✓ Комплексная оценка по 4 критериям с весами")
    print(f"  ✓ Обратная связь и рекомендации от LLM")

if __name__ == "__main__":
    main()
