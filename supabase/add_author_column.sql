-- 공지·매뉴얼에 작성자(관리자 이름) 표시용 컬럼 추가
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요. (한 번만)
ALTER TABLE notices ADD COLUMN IF NOT EXISTS author text;
ALTER TABLE manuals ADD COLUMN IF NOT EXISTS author text;
