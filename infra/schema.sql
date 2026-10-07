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
    period_id     VARCHAR(20) PRIMARY KEY,
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
    schedule_id   VARCHAR(20) PRIMARY KEY,
    period_id     VARCHAR(20) NOT NULL REFERENCES periods(period_id) ON DELETE CASCADE,
    title         TEXT NOT NULL,
    description   TEXT DEFAULT '',
    activity_type VARCHAR(50) NOT NULL,
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
    student_id   VARCHAR(10)  PRIMARY KEY,           
    first_name   TEXT         NOT NULL,
    last_name    TEXT         NOT NULL,
    email        TEXT         NOT NULL UNIQUE,
    phone        VARCHAR(20),                        
    birth_date   DATE,                               
    curriculum   VARCHAR(2)   NOT NULL,     -- ลบ REFERENCES curricula ออกชั่วคราว
    gpa          NUMERIC(3,2),                       

    CONSTRAINT chk_students_gpa
        CHECK (gpa IS NULL OR gpa BETWEEN 0.00 AND 4.00),
    CONSTRAINT chk_students_phone
        CHECK (phone IS NULL OR phone ~ '^[0-9+-]+$'),
    CONSTRAINT chk_students_birth_date
        CHECK (birth_date IS NULL
               OR (birth_date >= DATE '1900-01-01' AND birth_date <= CURRENT_DATE)),
    -- เพิ่ม CHECK ไว้ชั่วคราวแทน FK
    CONSTRAINT chk_students_curriculum
        CHECK (curriculum ~ '^[0-9]{2}$')
);

-- Filter หลัก
CREATE INDEX idx_students_curriculum ON students (curriculum);
-- ค้นชื่อแบบบางส่วน
CREATE INDEX idx_students_first_name_trgm ON students USING gin (first_name gin_trgm_ops);
CREATE INDEX idx_students_last_name_trgm  ON students USING gin (last_name  gin_trgm_ops);

-- 6. student_courses - ผลการเรียนเฉพาะวิชาที่อยู่ใน coop_course_rules (ตารางของเพื่อน)
CREATE TABLE student_courses (
    student_id   VARCHAR(10)  NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    course_code  VARCHAR(10)  NOT NULL,              
    status       VARCHAR(10)  NOT NULL,
    grade_point  NUMERIC(3,2),                       

    PRIMARY KEY (student_id, course_code),
    CONSTRAINT chk_student_courses_status
        CHECK (status IN ('ENROLLED', 'PASSED', 'FAILED')),
    CONSTRAINT chk_student_courses_grade
        CHECK (grade_point IS NULL OR grade_point BETWEEN 0.00 AND 4.00)
);

-- ค้นหาว่าวิชาหนึ่ง ๆ มีใครเรียน/ผ่านบ้าง (PK ครอบคลุมการค้นตาม student_id แล้ว)
CREATE INDEX idx_student_courses_course ON student_courses (course_code, status);

-- TODO: รันหลังตาราง curricula ของเพื่อนถูกสร้างแล้ว
-- ALTER TABLE students
--     ADD CONSTRAINT fk_students_curriculum
--     FOREIGN KEY (curriculum) REFERENCES curricula(curriculum);

-- 7. coop_plans — แผนสหกิจศึกษา (V2)
CREATE TABLE coop_plans (
    plan_id                 INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    student_id              VARCHAR(10) NOT NULL,
    period_id               VARCHAR(20),
    position_id             VARCHAR(10),
    status                  VARCHAR(20) NOT NULL DEFAULT 'PREPARING',
    acknowledged_pre_course BOOLEAN     NOT NULL DEFAULT FALSE,
    terms_accepted_at       TIMESTAMPTZ,
    student_note            TEXT,
    submitted_at            TIMESTAMPTZ,
    reviewer_name           VARCHAR(100),   -- V2 ยังไม่มีตาราง users
    reviewed_at             TIMESTAMPTZ,
    review_comment          TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_coop_plans_student
        FOREIGN KEY (student_id)  REFERENCES students(student_id)   ON DELETE RESTRICT,
    CONSTRAINT fk_coop_plans_period
        FOREIGN KEY (period_id)   REFERENCES periods(period_id)     ON DELETE RESTRICT,
    CONSTRAINT fk_coop_plans_position   -- ผ่าน positions → companies (employers)
        FOREIGN KEY (position_id) REFERENCES positions(position_id) ON DELETE RESTRICT,

    CONSTRAINT chk_coop_plans_status
        CHECK (status IN ('PREPARING','SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED')),

    CONSTRAINT chk_coop_plans_submitted
        CHECK (status = 'PREPARING'
               OR (submitted_at IS NOT NULL
                   AND terms_accepted_at IS NOT NULL
                   AND acknowledged_pre_course = TRUE)),

    CONSTRAINT chk_coop_plans_decision
        CHECK (status NOT IN ('APPROVED','REJECTED')
               OR (reviewer_name IS NOT NULL AND reviewed_at IS NOT NULL)),

    CONSTRAINT chk_coop_plans_reject_reason
        CHECK (status <> 'REJECTED'
               OR length(btrim(COALESCE(review_comment, ''))) > 0)
);

CREATE INDEX idx_coop_plans_student       ON coop_plans(student_id);
CREATE INDEX idx_coop_plans_status_submit ON coop_plans(status, submitted_at);
CREATE INDEX idx_coop_plans_period        ON coop_plans(period_id);
CREATE INDEX idx_coop_plans_position      ON coop_plans(position_id);

-- อัปเดต updated_at อัตโนมัติ
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_coop_plans_updated_at
    BEFORE UPDATE ON coop_plans
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_coop_plans_student  ON coop_plans(student_id);
CREATE INDEX idx_coop_plans_position ON coop_plans(position_id);
CREATE INDEX idx_coop_plans_period   ON coop_plans(period_id);
