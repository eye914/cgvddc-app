-- ============================================
-- 중복 방지 제약 추가 (예방용)
--   코드가 "한 건만 있다"고 가정하고 조회하는데 DB 가 보장해 주지 않던 곳만 추가.
--   2026-09-18 점검 시 해당 테이블 모두 실제 중복 0건 확인 → 바로 실행해도 안전.
--   Supabase SQL Editor 에서 Run. (여러 번 실행해도 안전)
--
--   ※ 이미 보장된 곳(추가 불필요)
--     eval_periods / eval_assignments / eval_scores / notice_signatures
--       → 코드가 upsert(onConflict) 를 쓰고 있어 제약이 이미 존재
--     attendance → key(이름_주차) 로 이미 고유
-- ============================================

-- 관리자 이름
create unique index if not exists admins_name_uniq on admins (name);

-- 활성 관리자끼리 PIN 중복 금지
--   로그인이 PIN 만으로 관리자를 찾으므로, 겹치면 두 사람 모두 로그인이 막힌다
create unique index if not exists admins_active_pin_uniq on admins (pin) where active = true;

-- 평가 대상 / 신인왕 후보: 기간·사람별 1건
create unique index if not exists eval_targets_uniq on eval_targets (period, miso_name);
create unique index if not exists eval_rookies_uniq on eval_rookies (period, miso_name);

notify pgrst, 'reload schema';
