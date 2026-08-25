-- 쉼데이(합의 하 무급휴무) 모집·신청
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요. (한 번만)

-- 모집 공고: 날짜 + 포지션별 정원
create table if not exists restday_posts (
  id           text primary key,
  work_date    date        not null,           -- 대상 근무일
  shift_code   text        default '',          -- 시프트(D1 등). 비우면 전체
  quota_store  integer     default 0,           -- 매점 정원
  quota_floor  integer     default 0,           -- 플로어 정원
  quota_total  integer     default 0,           -- 통합 정원
  deadline     timestamptz not null,            -- 마감(당일 09:00 KST)
  status       text        default 'open',      -- open | closed | canceled
  created_by   text        default '',
  created_at   timestamptz default now()
);

-- 신청: 선착순. (공고, 이름) 유일 → 중복 신청 차단
create table if not exists restday_claims (
  id          bigserial primary key,
  post_id     text not null references restday_posts(id) on delete cascade,
  position    text not null,                    -- 매점 | 플로어 | 통합
  name        text not null,
  status      text default 'claimed',           -- claimed | approved | rejected | canceled
  form_id     text default null,                -- 발송된 확인서 요청 id
  sheet_done  boolean default false,            -- 스케줄 시트 반영 여부
  claimed_at  timestamptz default now(),
  approved_by text default null,
  approved_at timestamptz default null
);

create unique index if not exists restday_claims_uniq on restday_claims (post_id, name);
create index if not exists restday_claims_post on restday_claims (post_id);
create index if not exists restday_posts_date on restday_posts (work_date);
