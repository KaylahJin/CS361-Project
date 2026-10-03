-- ---------------------------------------------------------------------
-- สร้างจาก Data Dictionary: Student Data (V2)
-- ตารางในไฟล์นี้: students, student_courses
-- ---------------------------------------------------------------------

-- สำหรับค้นชื่อแบบบางส่วน
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- students : ข้อมูลประจำตัวนักศึกษา
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

-- student_courses : ผลการเรียนเฉพาะวิชาที่อยู่ใน coop_course_rules (ตารางของเพื่อน)
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