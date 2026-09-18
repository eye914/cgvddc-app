-- ============================================
-- 미소지기 동명 중복 정리 + 재발 방지
--   증상: 추가하면 같은 이름이 2번 등록되고, 삭제하면 2개가 함께 사라짐
--   원인: name 에 unique 제약이 없어 중복 행이 생기는데,
--         수정·삭제는 모두 name 기준(.eq('name'))이라 두 행에 동시에 적용됨
--   Supabase 대시보드 → SQL Editor 에 붙여넣고 Run 하세요.
-- ============================================

-- 1) 기존 중복 행 정리: 같은 이름 중 id 가 가장 작은 행(먼저 만든 것)만 남긴다
delete from misojigi a
using misojigi b
where a.name = b.name
  and a.id > b.id;

-- 2) 재발 방지: 이름 중복 자체를 DB 에서 막는다
--    (동시에 두 번 요청이 들어와도 한 건만 저장됨)
create unique index if not exists misojigi_name_uniq on misojigi (name);

-- 3) 스키마 캐시 갱신
notify pgrst, 'reload schema';

-- 확인용: 아래를 실행하면 중복이 남아 있는지 볼 수 있습니다. (0건이어야 정상)
-- select name, count(*) from misojigi group by name having count(*) > 1;
