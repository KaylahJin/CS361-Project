-- 1. companies — สถานประกอบการ
CREATE TABLE companies (
    company_id    VARCHAR(10) PRIMARY KEY,
    name          TEXT NOT NULL,                   -- ชื่อเต็ม
    short_name    TEXT,                            -- ชื่อย่อ
    province      TEXT NOT NULL,                   -- จังหวัด (ใช้ filter)
    location      TEXT NOT NULL,                   -- ที่อยู่เต็ม
    description   TEXT DEFAULT '',
    logo_filename TEXT,
    url           TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_companies_province ON companies(province);
CREATE INDEX idx_companies_name     ON companies USING gin(name gin_trgm_ops);

-- 2. coop_info — เกณฑ์/ข้อกำหนดสหกิจ
CREATE TABLE coop_info (
    info_id       SERIAL PRIMARY KEY,
    item_number   INT NOT NULL,
    curriculum    VARCHAR(10) NOT NULL,            -- '61', '66', 'all'
    category      TEXT NOT NULL,                   -- 'qualification', 'required_course', 'gpa', 'behavior'
    title         TEXT NOT NULL,
    description   TEXT NOT NULL,
    gpa_requirement NUMERIC(3,2),
    academic_year INT NOT NULL DEFAULT 2568,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 3. positions — ตำแหน่ง/โครงการ
CREATE TABLE positions (
    position_id   VARCHAR(10) PRIMARY KEY,
    company_id    VARCHAR(10) NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
    title         TEXT NOT NULL,
    description   TEXT DEFAULT '',
    position_type TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_positions_company ON positions(company_id);
CREATE INDEX idx_positions_type    ON positions(position_type);

-- 4. periods — รอบเวลา/กำหนดการ
CREATE TABLE periods (
    period_id     VARCHAR(10) PRIMARY KEY,
    name          TEXT NOT NULL,
    step_order    INT,
    step_name     TEXT,
    start_date    DATE,
    end_date      DATE,
    academic_year INT NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_periods_year ON periods(academic_year);

-- 5. students — นักศึกษา
CREATE TABLE students (
    student_id    VARCHAR(10) PRIMARY KEY,
    name          TEXT NOT NULL,
    curriculum    VARCHAR(10),
    gpa           NUMERIC(3,2),
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 6. coop_plans — แผนสหกิจศึกษา
CREATE TABLE coop_plans (
    plan_id       VARCHAR(10) PRIMARY KEY,
    student_id    VARCHAR(10) NOT NULL REFERENCES students(student_id),
    position_id   VARCHAR(10) NOT NULL REFERENCES positions(position_id),
    period_id     VARCHAR(10) NOT NULL REFERENCES periods(period_id),
    status        VARCHAR(20) DEFAULT 'draft',
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_coop_plans_student  ON coop_plans(student_id);
CREATE INDEX idx_coop_plans_position ON coop_plans(position_id);
CREATE INDEX idx_coop_plans_period   ON coop_plans(period_id);

-- Extension สำหรับ search ชื่อบริษัท
CREATE EXTENSION IF NOT EXISTS pg_trgm;