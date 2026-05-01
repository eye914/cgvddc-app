-- ========================================================
-- CGV동두천 전자 폼 시스템 — Supabase SQL
-- Supabase → SQL Editor 에서 실행하세요
-- ========================================================

-- 1. 서류 요청 테이블 (관리자 → 직원)
CREATE TABLE IF NOT EXISTS form_requests (
    id              TEXT PRIMARY KEY,           -- FRM-YYYYMMDD-XXXX
    type            TEXT NOT NULL,              -- 'late' | 'absent' | 'resign'
    target_name     TEXT NOT NULL,              -- 요청 대상 미소지기 이름
    requested_by    TEXT NOT NULL,              -- 관리자 이름
    requested_at    TIMESTAMPTZ DEFAULT NOW(),
    status          TEXT DEFAULT 'pending',     -- 'pending' | 'submitted' | 'viewed'
    note            TEXT DEFAULT '',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 제출된 서류 테이블 (직원이 작성 후 제출)
CREATE TABLE IF NOT EXISTS form_submissions (
    id              TEXT PRIMARY KEY,           -- SUB-YYYYMMDD-XXXX
    request_id      TEXT REFERENCES form_requests(id) ON DELETE CASCADE,
    type            TEXT NOT NULL,
    target_name     TEXT NOT NULL,
    submitted_at    TIMESTAMPTZ DEFAULT NOW(),
    form_data       JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 인덱스
CREATE INDEX IF NOT EXISTS idx_form_requests_target  ON form_requests(target_name);
CREATE INDEX IF NOT EXISTS idx_form_requests_status  ON form_requests(status);
CREATE INDEX IF NOT EXISTS idx_form_submissions_req  ON form_submissions(request_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_name ON form_submissions(target_name);

-- 4. RLS 비활성화 (service_role key 사용 → Next.js API에서 접근)
ALTER TABLE form_requests   DISABLE ROW LEVEL SECURITY;
ALTER TABLE form_submissions DISABLE ROW LEVEL SECURITY;
