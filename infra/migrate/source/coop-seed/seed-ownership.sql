-- Run once before coop-seed.sql.
BEGIN;
CREATE TABLE IF NOT EXISTS seed_period_ownership (
  seed_name varchar(100) NOT NULL, period_id varchar(20) NOT NULL,
  PRIMARY KEY (seed_name, period_id)
);
CREATE TABLE IF NOT EXISTS seed_schedule_ownership (
  seed_name varchar(100) NOT NULL, schedule_id varchar(20) NOT NULL,
  PRIMARY KEY (seed_name, schedule_id)
);
CREATE TABLE IF NOT EXISTS seed_position_period_ownership (
  seed_name varchar(100) NOT NULL, position_id varchar(10) NOT NULL,
  period_id varchar(20) NOT NULL,
  PRIMARY KEY (seed_name, position_id, period_id)
);
CREATE TABLE IF NOT EXISTS seed_student_ownership (
  seed_name varchar(100) NOT NULL, student_id varchar(10) NOT NULL,
  PRIMARY KEY (seed_name, student_id)
);
CREATE TABLE IF NOT EXISTS seed_course_ownership (
  seed_name varchar(100) NOT NULL, student_id varchar(10) NOT NULL,
  course_code varchar(10) NOT NULL,
  PRIMARY KEY (seed_name, student_id, course_code)
);
COMMIT;
