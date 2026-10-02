-- Extension สำหรับ search ชื่อบริษัท — must come before any index that uses
-- gin_trgm_ops, or that CREATE INDEX silently fails (psql -f doesn't stop on
-- error by default) and the index just never gets created.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

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

CREATE INDEX idx_companies_province   ON companies(province);
CREATE INDEX idx_companies_name       ON companies USING gin(name gin_trgm_ops);
CREATE INDEX idx_companies_short_name ON companies USING gin(short_name gin_trgm_ops);

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

-- 3. positions — ตำแหน่ง/โครงการสหกิจ
CREATE TABLE positions (
    position_id          VARCHAR(10) PRIMARY KEY,
    company_id           VARCHAR(10) NOT NULL,
    title                VARCHAR(255) NOT NULL,
    category             VARCHAR(50) NOT NULL,
    description          TEXT,
    qualification        TEXT,
    location             TEXT,
    work_mode            VARCHAR(20) NOT NULL DEFAULT 'unknown',
    application_deadline DATE,
    application_url      TEXT,
    status               VARCHAR(20) NOT NULL DEFAULT 'unknown',
    source_url           TEXT,
    created_at           TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT fk_position_company
        FOREIGN KEY (company_id)
        REFERENCES companies(company_id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_position_category
        CHECK (
            category IN (
                'software_development',
                'data_ai',
                'cloud_infrastructure_devops',
                'qa_testing',
                'business_enterprise_systems',
                'it_support_operations',
                'ux_ui_design',
                'cybersecurity',
                'technical_sales',
                'it_solutions',
                'other'
            )
        ),

    CONSTRAINT chk_position_work_mode
        CHECK (
            work_mode IN (
                'onsite',
                'hybrid',
                'remote',
                'unknown'
            )
        ),

    CONSTRAINT chk_position_status
        CHECK (
            status IN (
                'open',
                'closed',
                'expired',
                'unknown'
            )
        )
);

CREATE INDEX idx_positions_company_id ON positions(company_id);
CREATE INDEX idx_positions_category   ON positions(category);
CREATE INDEX idx_positions_work_mode  ON positions(work_mode);
CREATE INDEX idx_positions_status     ON positions(status);
CREATE INDEX idx_positions_title_trgm ON positions USING GIN (title gin_trgm_ops);

-- 4. periods — รอบเวลา/ภาคการศึกษาหลัก
CREATE TABLE periods (
    period_id     VARCHAR(10) PRIMARY KEY,
    name          TEXT NOT NULL,
    academic_year INT NOT NULL,
    semester      VARCHAR(5) NOT NULL DEFAULT '1',
    is_active     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_periods_year   ON periods(academic_year);
CREATE INDEX idx_periods_active ON periods(is_active);

-- 4.1 coop_schedules — กิจกรรมใน Timeline ของแต่ละรอบ (Feature #7)
CREATE TABLE coop_schedules (
    schedule_id   VARCHAR(10) PRIMARY KEY,
    period_id     VARCHAR(10) NOT NULL REFERENCES periods(period_id) ON DELETE CASCADE,
    title         TEXT NOT NULL,
    description   TEXT DEFAULT '',
    activity_type VARCHAR(30) NOT NULL,
    start_date    DATE NOT NULL,
    end_date      DATE NOT NULL,
    step_order    INT NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT chk_coop_schedules_activity_type 
    CHECK (activity_type IN (
        'APPLICATION',
        'INTERVIEW',
        'ORIENTATION',
        'WORK_PERIOD',
        'SUBMISSION'
    ))
);

CREATE INDEX idx_schedules_period ON coop_schedules(period_id);
CREATE INDEX idx_schedules_type   ON coop_schedules(activity_type);

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

CREATE INDEX idx_schedules_type   ON coop_schedules(activity_type);
