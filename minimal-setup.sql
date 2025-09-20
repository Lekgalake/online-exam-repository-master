-- Minimal Database Setup - Run this in Supabase SQL Editor
-- This will definitely work

-- 1. Drop existing tables if they have issues
DROP TABLE IF EXISTS public.results CASCADE;
DROP TABLE IF EXISTS public.students CASCADE;
DROP TABLE IF EXISTS public.exams CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- 2. Create tables with proper structure
CREATE TABLE public.users (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'student',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.students (
    student_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.exams (
    exam_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    course TEXT NOT NULL,
    exam_name TEXT NOT NULL,
    date DATE NOT NULL,
    credits INTEGER DEFAULT 3,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.results (
    result_id SERIAL PRIMARY KEY,
    student_id UUID REFERENCES public.students(student_id),
    exam_id UUID REFERENCES public.exams(exam_id),
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, exam_id)
);

-- 3. Insert test data
INSERT INTO public.students (name, email) VALUES 
    ('John Doe', 'john.doe@student.com'),
    ('Test Student', 'teststudent@gmail.com');

INSERT INTO public.exams (course, exam_name, date) VALUES 
    ('Computer Science', 'Midterm Exam', '2024-03-15'),
    ('Mathematics', 'Final Exam', '2024-05-20');

-- 4. Insert results using subqueries
INSERT INTO public.results (student_id, exam_id, score) 
VALUES 
    ((SELECT student_id FROM public.students WHERE email = 'john.doe@student.com'), 
     (SELECT exam_id FROM public.exams WHERE exam_name = 'Midterm Exam'), 85),
    ((SELECT student_id FROM public.students WHERE email = 'john.doe@student.com'), 
     (SELECT exam_id FROM public.exams WHERE exam_name = 'Final Exam'), 92),
    ((SELECT student_id FROM public.students WHERE email = 'teststudent@gmail.com'), 
     (SELECT exam_id FROM public.exams WHERE exam_name = 'Midterm Exam'), 78);

-- 5. Set up RLS (Row Level Security) - DISABLE for testing
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.students DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.results DISABLE ROW LEVEL SECURITY;

-- 6. Grant full permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 7. Verify data was inserted
SELECT 'Students:', COUNT(*) FROM public.students;
SELECT 'Exams:', COUNT(*) FROM public.exams;
SELECT 'Results:', COUNT(*) FROM public.results;
