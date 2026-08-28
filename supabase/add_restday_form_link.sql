-- 쉼데이 승인 시 자동 생성되는 '희망휴무 확인서' 요청과의 연결
--   관리자 화면에서 서명 완료 여부를 함께 보기 위해 필요합니다.
alter table restday_claims add column if not exists form_request_id text;
create index if not exists restday_claims_form on restday_claims (form_request_id);
