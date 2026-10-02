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
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_schedules_period ON coop_schedules(period_id);
CREATE INDEX idx_schedules_type   ON coop_schedules(activity_type);