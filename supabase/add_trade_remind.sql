-- 대타/맞교대 공고 재알림(리마인더) 하루 1회 제한용 컬럼
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요. (한 번만)
ALTER TABLE trades ADD COLUMN IF NOT EXISTS last_remind_at timestamptz;
