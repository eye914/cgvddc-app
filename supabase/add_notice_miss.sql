-- 공지·매뉴얼 '미숙지'(서명은 했으나 현장 확인 시 내용을 모름) 카운터
-- 인력풀 현황에서 지각·결근과 함께 관리하며, 월말평가 공지 항목 점수에서 차감됩니다.
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요. (한 번만)
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS miss INTEGER DEFAULT 0;
