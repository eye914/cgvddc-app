-- ============================================================
-- CGV 동두천 스케줄 기능 스키마
-- Supabase SQL Editor에서 실행하세요
-- ============================================================

-- ① misojigi 테이블에 계약 근로일수 컬럼 추가
ALTER TABLE misojigi
  ADD COLUMN IF NOT EXISTS contract_days INT NOT NULL DEFAULT 5;

-- ============================================================
-- ② 취합 테이블: 미소지기가 신청한 가용 시간대
-- ============================================================
CREATE TABLE IF NOT EXISTS availability (
  id            BIGSERIAL PRIMARY KEY,
  name          TEXT    NOT NULL,               -- 미소지기 이름
  week_key      TEXT    NOT NULL,               -- 주차 시작 월요일 'YYYY-MM-DD'
  day_of_week   INT     NOT NULL                -- 0=월 1=화 2=수 3=목 4=금 5=토 6=일
                CHECK (day_of_week BETWEEN 0 AND 6),
  shift_codes   TEXT[]  NOT NULL DEFAULT '{}',  -- ['D1','M3','N1'] 선택한 타임슬롯
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (name, week_key, day_of_week)          -- 한 사람이 같은 주/요일에 하나만
);

-- ============================================================
-- ③ 편성 배정 테이블: 관리자가 확정한 배정
-- ============================================================
CREATE TABLE IF NOT EXISTS schedule_assignments (
  id              BIGSERIAL PRIMARY KEY,
  week_key        TEXT    NOT NULL,             -- 주차 시작 월요일 'YYYY-MM-DD'
  date            TEXT    NOT NULL,             -- 배정 날짜 'YYYY-MM-DD'
  day_of_week     INT     NOT NULL              -- 0=월 ~ 6=일
                  CHECK (day_of_week BETWEEN 0 AND 6),
  shift_code      TEXT    NOT NULL,             -- 'D1','M3','N1' 등 타임슬롯 코드
  position        TEXT    NOT NULL              -- 'mart','mart-close','floor','int'
                  CHECK (position IN ('mart','mart-close','floor','int')),
  name            TEXT    NOT NULL,             -- 배정된 미소지기 이름
  hours           NUMERIC NOT NULL              -- 4.5 또는 5.5
                  CHECK (hours IN (4.5, 5.5)),
  confirmed       BOOLEAN NOT NULL DEFAULT FALSE,      -- 확정 여부
  synced_to_sheet BOOLEAN NOT NULL DEFAULT FALSE,      -- GAS 시트 동기화 완료 여부
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (week_key, date, shift_code, position) -- 같은 슬롯에 중복 배정 불가
);

-- ============================================================
-- ④ updated_at 자동 갱신 트리거 함수
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- availability 트리거
DROP TRIGGER IF EXISTS availability_updated_at ON availability;
CREATE TRIGGER availability_updated_at
  BEFORE UPDATE ON availability
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- schedule_assignments 트리거
DROP TRIGGER IF EXISTS schedule_assignments_updated_at ON schedule_assignments;
CREATE TRIGGER schedule_assignments_updated_at
  BEFORE UPDATE ON schedule_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ⑤ 조회 인덱스 (성능)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_availability_week     ON availability (week_key);
CREATE INDEX IF NOT EXISTS idx_availability_name     ON availability (name);
CREATE INDEX IF NOT EXISTS idx_sched_week            ON schedule_assignments (week_key);
CREATE INDEX IF NOT EXISTS idx_sched_date            ON schedule_assignments (date);
CREATE INDEX IF NOT EXISTS idx_sched_name            ON schedule_assignments (name);
