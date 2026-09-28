import os
import json
import asyncpg
from asyncpg import Record
from typing import List, Dict, Any, Optional

DATABASE_URL = os.environ.get(
    'DATABASE_URL',
    'postgresql://neondb_owner:npg_Gosd9XVI1cTB@ep-square-waterfall-b38o9f42-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
)

pool: Optional[asyncpg.Pool] = None

async def init_pool():
    global pool
    if pool is None:
        try:
            pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=5)
        except Exception as e:
            print(f"Warning: Failed to init pool: {e}")
            raise

async def close_pool():
    global pool
    if pool:
        await pool.close()
        pool = None

async def ensure_pool():
    global pool
    if pool is None:
        await init_pool()

async def init_db():
    await init_pool()
    await ensure_pool()
    async with pool.acquire() as conn:
        await conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            name VARCHAR(150) NOT NULL,
            email VARCHAR(150) UNIQUE NOT NULL,
            role VARCHAR(50) DEFAULT 'teacher',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        """)
        await conn.execute("""
        CREATE TABLE IF NOT EXISTS exams (
            id SERIAL PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            code VARCHAR(50) UNIQUE NOT NULL,
            subject VARCHAR(100) NOT NULL,
            class_name VARCHAR(100) NOT NULL,
            academic_year VARCHAR(50) DEFAULT '2024/2025',
            total_questions INTEGER DEFAULT 0,
            passing_score NUMERIC(5,2) DEFAULT 75.0,
            description TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        """)
        await conn.execute("""
        CREATE TABLE IF NOT EXISTS questions (
            id SERIAL PRIMARY KEY,
            exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
            question_number INTEGER NOT NULL,
            question_type VARCHAR(50) NOT NULL,
            question_text TEXT,
            answer_key JSONB NOT NULL,
            weight NUMERIC(5,2) DEFAULT 1.0,
            options JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        """)
        await conn.execute("""
        CREATE TABLE IF NOT EXISTS exam_results (
            id SERIAL PRIMARY KEY,
            exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
            student_name VARCHAR(150) NOT NULL,
            student_id_number VARCHAR(50) NOT NULL,
            class_name VARCHAR(100),
            total_score NUMERIC(6,2) DEFAULT 0.0,
            max_possible_score NUMERIC(6,2) DEFAULT 100.0,
            percentage NUMERIC(5,2) DEFAULT 0.0,
            status VARCHAR(20) DEFAULT 'Lulus',
            scan_image_url TEXT,
            omr_confidence NUMERIC(5,2) DEFAULT 0.0,
            raw_details JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        """)
        await conn.execute("""
        CREATE TABLE IF NOT EXISTS student_answers (
            id SERIAL PRIMARY KEY,
            result_id INTEGER NOT NULL REFERENCES exam_results(id) ON DELETE CASCADE,
            question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
            student_response JSONB,
            is_correct BOOLEAN DEFAULT false,
            score_earned NUMERIC(5,2) DEFAULT 0.0,
            ai_feedback TEXT,
            ai_confidence NUMERIC(5,2),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        """)

# Helper to convert record to dict
def record_to_dict(record: Record) -> Dict[str, Any]:
    return dict(record) if record else None

async def create_exam(title: str, code: str, subject: str, class_name: str, academic_year: str, passing_score: float, description: str) -> Dict[str, Any]:
    await ensure_pool()
    async with pool.acquire() as conn:
        record = await conn.fetchrow("""
            INSERT INTO exams (title, code, subject, class_name, academic_year, passing_score, description)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        """, title, code, subject, class_name, academic_year, passing_score, description)
        return record_to_dict(record)

async def get_all_exams() -> List[Dict[str, Any]]:
    await ensure_pool()
    async with pool.acquire() as conn:
        records = await conn.fetch("SELECT * FROM exams ORDER BY created_at DESC")
        return [record_to_dict(r) for r in records]

async def get_exam(exam_id: int) -> Dict[str, Any]:
    await ensure_pool()
    async with pool.acquire() as conn:
        record = await conn.fetchrow("SELECT * FROM exams WHERE id = $1", exam_id)
        return record_to_dict(record)

async def update_exam(exam_id: int, title: str, code: str, subject: str, class_name: str, academic_year: str, passing_score: float, description: str) -> Dict[str, Any]:
    await ensure_pool()
    async with pool.acquire() as conn:
        record = await conn.fetchrow("""
            UPDATE exams
            SET title = $1, code = $2, subject = $3, class_name = $4, academic_year = $5, passing_score = $6, description = $7, updated_at = CURRENT_TIMESTAMP
            WHERE id = $8
            RETURNING *
        """, title, code, subject, class_name, academic_year, passing_score, description, exam_id)
        return record_to_dict(record)

async def delete_exam(exam_id: int) -> bool:
    await ensure_pool()
    async with pool.acquire() as conn:
        result = await conn.execute("DELETE FROM exams WHERE id = $1", exam_id)
        return result == "DELETE 1"

async def create_question(exam_id: int, question_number: int, question_type: str, question_text: str, answer_key: Any, weight: float, options: Any) -> Dict[str, Any]:
    await ensure_pool()
    async with pool.acquire() as conn:
        record = await conn.fetchrow("""
            INSERT INTO questions (exam_id, question_number, question_type, question_text, answer_key, weight, options)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        """, exam_id, question_number, question_type, question_text, json.dumps(answer_key), weight, json.dumps(options) if options else None)
        return record_to_dict(record)

async def get_questions_by_exam(exam_id: int) -> List[Dict[str, Any]]:
    await ensure_pool()
    async with pool.acquire() as conn:
        records = await conn.fetch("SELECT * FROM questions WHERE exam_id = $1 ORDER BY question_number ASC", exam_id)
        return [record_to_dict(r) for r in records]

async def delete_questions_by_exam(exam_id: int) -> bool:
    await ensure_pool()
    async with pool.acquire() as conn:
        result = await conn.execute("DELETE FROM questions WHERE exam_id = $1", exam_id)
        return result.startswith("DELETE")

async def create_exam_result(exam_id: int, student_name: str, student_id_number: str, class_name: str, total_score: float, max_possible_score: float, percentage: float, status: str, scan_image_url: str, omr_confidence: float, raw_details: Any) -> Dict[str, Any]:
    await ensure_pool()
    async with pool.acquire() as conn:
        record = await conn.fetchrow("""
            INSERT INTO exam_results (exam_id, student_name, student_id_number, class_name, total_score, max_possible_score, percentage, status, scan_image_url, omr_confidence, raw_details)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
        """, exam_id, student_name, student_id_number, class_name, total_score, max_possible_score, percentage, status, scan_image_url, omr_confidence, json.dumps(raw_details) if raw_details else None)
        return record_to_dict(record)

async def get_results_by_exam(exam_id: int) -> List[Dict[str, Any]]:
    await ensure_pool()
    async with pool.acquire() as conn:
        records = await conn.fetch("SELECT * FROM exam_results WHERE exam_id = $1 ORDER BY created_at DESC", exam_id)
        return [record_to_dict(r) for r in records]

async def get_result_detail(result_id: int) -> Dict[str, Any]:
    await ensure_pool()
    async with pool.acquire() as conn:
        result = await conn.fetchrow("SELECT * FROM exam_results WHERE id = $1", result_id)
        if not result:
            return None
        
        result_dict = record_to_dict(result)
        answers = await conn.fetch("SELECT * FROM student_answers WHERE result_id = $1 ORDER BY question_id ASC", result_id)
        result_dict['student_answers'] = [record_to_dict(a) for a in answers]
        return result_dict

async def create_student_answer(result_id: int, question_id: int, student_response: Any, is_correct: bool, score_earned: float, ai_feedback: str, ai_confidence: float) -> Dict[str, Any]:
    await ensure_pool()
    async with pool.acquire() as conn:
        record = await conn.fetchrow("""
            INSERT INTO student_answers (result_id, question_id, student_response, is_correct, score_earned, ai_feedback, ai_confidence)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        """, result_id, question_id, json.dumps(student_response) if student_response else None, is_correct, score_earned, ai_feedback, ai_confidence)
        return record_to_dict(record)

async def get_dashboard_stats(exam_id: int) -> Dict[str, Any]:
    await ensure_pool()
    async with pool.acquire() as conn:
        stats = await conn.fetchrow("""
            SELECT 
                COUNT(*) as total_students,
                COALESCE(AVG(percentage), 0) as avg_score,
                COALESCE(MAX(percentage), 0) as max_score,
                COALESCE(MIN(percentage), 0) as min_score,
                SUM(CASE WHEN status = 'Lulus' THEN 1 ELSE 0 END) as pass_count,
                SUM(CASE WHEN status = 'Tidak Lulus' THEN 1 ELSE 0 END) as fail_count
            FROM exam_results
            WHERE exam_id = $1
        """, exam_id)
        return record_to_dict(stats)

async def get_question_analysis(exam_id: int) -> List[Dict[str, Any]]:
    await ensure_pool()
    async with pool.acquire() as conn:
        records = await conn.fetch("""
            SELECT 
                q.question_number,
                COUNT(sa.id) as total_count,
                SUM(CASE WHEN sa.is_correct THEN 1 ELSE 0 END) as correct_count,
                CASE WHEN COUNT(sa.id) > 0 THEN (SUM(CASE WHEN sa.is_correct THEN 1 ELSE 0 END)::NUMERIC / COUNT(sa.id)) * 100 ELSE 0 END as percentage
            FROM questions q
            LEFT JOIN student_answers sa ON q.id = sa.question_id
            WHERE q.exam_id = $1
            GROUP BY q.id, q.question_number
            ORDER BY q.question_number ASC
        """, exam_id)
        return [record_to_dict(r) for r in records]
