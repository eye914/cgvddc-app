-- CGV동두천 맞교대 시스템 DB 세팅
-- Supabase SQL Editor에서 한 번만 실행하세요

-- 1. 교대 요청 테이블
CREATE TABLE IF NOT EXISTS trades (
  id TEXT PRIMARY KEY,
  req_name TEXT NOT NULL,
  shift_date TEXT NOT NULL,
  req_pos TEXT DEFAULT '',
  desired_shift TEXT DEFAULT '',
  reason TEXT DEFAULT '',
  trade_type TEXT DEFAULT '',
  sub_name TEXT DEFAULT '모집중',
  sub_pos TEXT DEFAULT '',
  status TEXT DEFAULT '모집중',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 미소지기 테이블
CREATE TABLE IF NOT EXISTS misojigi (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  pos TEXT DEFAULT '',
  hours TEXT DEFAULT '4.5',
  active BOOLEAN DEFAULT TRUE
);

-- 3. 출결 테이블
CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  week TEXT NOT NULL,
  late INTEGER DEFAULT 0,
  absent INTEGER DEFAULT 0,
  logs JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 푸시 구독 테이블
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  subscription TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 기본 미소지기 데이터
INSERT INTO misojigi (name, pos, hours, active) VALUES
  ('김한솔', '통합', '5.5', TRUE),
  ('신재용', '통합', '5.5', TRUE),
  ('방회윤', '통합', '4.5', TRUE),
  ('홍성현', '통합', '4.5', TRUE),
  ('홍민경', '통합', '4.5', TRUE),
  ('김나은', '통합', '4.5', TRUE),
  ('정태민', '통합', '4.5', TRUE),
  ('신민경', '통합', '5.5', TRUE),
  ('조동우', '통합', '5.5', TRUE),
  ('이진아', '통합', '4.5', TRUE),
  ('이예빈', '통합', '5.5', TRUE),
  ('윤소은', '통합', '4.5', TRUE),
  ('손정현', '매점,플로어', '4.5', TRUE),
  ('이하율', '매점,플로어', '4.5', TRUE),
  ('송해인', '매점,플로어', '4.5', TRUE),
  ('최재은', '플로어', '4.5', TRUE)
ON CONFLICT DO NOTHING;

-- 6. RLS 비활성화 (팀 내부 시스템이므로)
ALTER TABLE trades DISABLE ROW LEVEL SECURITY;
ALTER TABLE misojigi DISABLE ROW LEVEL SECURITY;
ALTER TABLE attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions DISABLE ROW LEVEL SECURITY;
