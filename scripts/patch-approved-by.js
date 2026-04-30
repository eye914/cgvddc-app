/**
 * 관리자 승인자 이름 표시
 * 1. adminApprove() → approvedBy 전송
 * 2. 관리자 카드 (확정완료) → 승인자 이름 표시
 * 3. toCamel에서 approvedBy 반환 → 이미 route.ts에서 처리됨
 */
const fs = require('fs');
const path = require('path');
const appPath = path.join(__dirname, '..', 'public', 'cgv-app.js');
let c = fs.readFileSync(appPath, 'utf8');

// 1. adminApprove() — approvedBy 포함
const old1 = ".updateTradeInDB(id, { status:\"\\uC2B9\\uC778\\uC644\\uB8CC\" });";
const new1 = ".updateTradeInDB(id, { status:\"\\uC2B9\\uC778\\uC644\\uB8CC\", approvedBy: sessionStorage.getItem('cgv_admin_name') || '\\uAD00\\uB9AC\\uC790' });";
if (c.includes(old1)) {
    c = c.replace(old1, new1);
    console.log('1. adminApprove approvedBy 전송: OK');
} else {
    console.log('1. adminApprove 마커 없음 (스킵)');
}

// 2. 관리자 카드 헤더 — 확정완료 상태일 때 승인자 이름 표시
// 현재: "<span class='text-[10px] font-black ...'>확정완료|승인대기</span>"
// 변경: div.flex 안에 왼쪽 상태 뱃지 + 오른쪽 "승인: 이름"
const old2 = "\"<span class='text-[10px] font-black \"+(isD?\"text-green-600\":\"text-blue-600\")+\"'>\"+(isD?\"\\uD655\\uC815\\uC644\\uB8CC\":\"\\uC2B9\\uC778\\uB300\\uAE30\")+\"</span>\"";
const new2 = "\"<div class='flex items-center justify-between gap-2'>\" + \"<span class='text-[10px] font-black \"+(isD?\"text-green-600\":\"text-blue-600\")+\"'>\"+(isD?\"\\uD655\\uC815\\uC644\\uB8CC\":\"\\uC2B9\\uC778\\uB300\\uAE30\")+\"</span>\" + (isD && t.approvedBy ? \"<span class='text-[10px] text-slate-400 font-bold'>\" + \"\\uC2B9\\uC778: \" + t.approvedBy + \"</span>\" : \"\") + \"</div>\"";
if (c.includes(old2)) {
    c = c.replace(old2, new2);
    console.log('2. 관리자 카드 승인자 표시: OK');
} else {
    console.log('2. 카드 헤더 마커 없음 (스킵)');
}

fs.writeFileSync(appPath, c, 'utf8');
console.log('cgv-app.js 저장 완료');

try { new Function(c); console.log('JS 문법 OK'); }
catch(e) { console.log('JS 문법 에러:', e.message); }
