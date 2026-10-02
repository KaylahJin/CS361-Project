-- ---------------------------------------------------------------------
-- สร้างจาก Data Dictionary: Student Data (V2)
-- ตารางในไฟล์นี้: curricula, students, coop_course_rules, student_courses
-- ---------------------------------------------------------------------

-- สำหรับค้นชื่อแบบบางส่วน
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1) curricula : เกณฑ์ตัวเลขของแต่ละหลักสูตร
CREATE TABLE curricula (
    curriculum    VARCHAR(2)   PRIMARY KEY,          
    min_gpa       NUMERIC(3,2) NOT NULL,             
    min_core_avg  NUMERIC(3,2) NOT NULL,            

    CONSTRAINT chk_curricula_code
        CHECK (curriculum ~ '^[0-9]{2}$'),
    CONSTRAINT chk_curricula_min_gpa
        CHECK (min_gpa BETWEEN 0.00 AND 4.00),
    CONSTRAINT chk_curricula_min_core_avg
        CHECK (min_core_avg BETWEEN 0.00 AND 4.00)
);

-- 2) students : ข้อมูลประจำตัวนักศึกษา
CREATE TABLE students (
    student_id   VARCHAR(10)  PRIMARY KEY,           
    first_name   TEXT         NOT NULL,
    last_name    TEXT         NOT NULL,
    email        TEXT         NOT NULL UNIQUE,
    phone        VARCHAR(20),                        
    birth_date   DATE,                               
    curriculum   VARCHAR(2)   NOT NULL REFERENCES curricula(curriculum),
    gpa          NUMERIC(3,2),                       

    CONSTRAINT chk_students_gpa
        CHECK (gpa IS NULL OR gpa BETWEEN 0.00 AND 4.00),
    CONSTRAINT chk_students_phone
        CHECK (phone IS NULL OR phone ~ '^[0-9+-]+$'),
    CONSTRAINT chk_students_birth_date
        CHECK (birth_date IS NULL
               OR (birth_date >= DATE '1900-01-01' AND birth_date <= CURRENT_DATE))
);

-- Filter หลัก
CREATE INDEX idx_students_curriculum ON students (curriculum);
-- ค้นชื่อแบบบางส่วน
CREATE INDEX idx_students_first_name_trgm ON students USING gin (first_name gin_trgm_ops);
CREATE INDEX idx_students_last_name_trgm  ON students USING gin (last_name  gin_trgm_ops);

-- 3) coop_course_rules : เงื่อนไขรายวิชาของแต่ละหลักสูตร
CREATE TABLE coop_course_rules (
    rule_id      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    curriculum   VARCHAR(2)  NOT NULL REFERENCES curricula(curriculum),
    rule_type    VARCHAR(20) NOT NULL,
    slot_no      INTEGER     NOT NULL,
    course_code  VARCHAR(10) NOT NULL,               

    CONSTRAINT chk_rules_rule_type
        CHECK (rule_type IN ('COMPLETED_GROUP', 'TAKING_OR_COMPLETED', 'PASS_BEFORE_WORK')),
    CONSTRAINT chk_rules_slot_no
        CHECK (slot_no >= 1),
    CONSTRAINT uq_rules_slot_course
        UNIQUE (curriculum, rule_type, slot_no, course_code)
);

-- 4) student_courses : ผลการเรียนเฉพาะวิชาที่อยู่ใน coop_course_rules
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