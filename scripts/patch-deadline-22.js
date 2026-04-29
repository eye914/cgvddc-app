/**
 * 공고 마감 시간 22:00으로 변경
 * - isExpired(): -1시간 → -2시간 (자정 기준 -2h = 전날 22:00)
 * - 알림 메시지: "전날 23시" → "전날 22시"
 * - 주석 정리
 */
const fs = require('fs');
const path = require('path');
const appJsPath = path.join(__dirname, '..', 'public', 'cgv-app.js');
let c = fs.readFileSync(appJsPath, 'utf8');

// ── 1. isExpired 계산식: -1시간 → -2시간 ──
const old1 = '            \\ 전날 23:00 = 교대일 00:00 - 1시간\n            var expireAt = new Date(shiftDay.getTime() - 1 * 60 * 60 * 1000);';
const new1 = '            // 전날 22:00 = 교대일 00:00 - 2시간\n            var expireAt = new Date(shiftDay.getTime() - 2 * 60 * 60 * 1000);';
if (c.includes(old1)) { c = c.replace(old1, new1); console.log('1. isExpired 계산식: OK'); }
else {
    // 주석 형태가 다를 수 있으므로 계산식만 교체
    const old1b = 'var expireAt = new Date(shiftDay.getTime() - 1 * 60 * 60 * 1000);';
    const new1b = 'var expireAt = new Date(shiftDay.getTime() - 2 * 60 * 60 * 1000);';
    if (c.includes(old1b)) { c = c.replace(old1b, new1b); console.log('1. isExpired 계산식(fallback): OK'); }
    else { console.log('1. isExpired 계산식 마커 없음'); }
}

// ── 2. 알림 메시지: 23시 → 22시 ──
const old2 = '전날 23시 이후에는 신청할 수 없습니다.';
const new2 = '전날 22시 이후에는 신청할 수 없습니다.';
if (c.includes(old2)) { c = c.replace(old2, new2); console.log('2. 알림 메시지: OK'); }
else {
    // 한글 직접 텍스트로도 시도
    const old2b = '전날 23시 이후에는 신청할 수 없습니다.';
    const new2b = '전날 22시 이후에는 신청할 수 없습니다.';
    if (c.includes(old2b)) { c = c.replace(old2b, new2b); console.log('2. 알림 메시지(fallback): OK'); }
    else { console.log('2. 알림 메시지 마커 없음'); }
}

fs.writeFileSync(appJsPath, c, 'utf8');
console.log('마감 22시 패치 완료');
try { new Function(c); console.log('문법 OK'); } catch(e) { console.log('문법 에러:', e.message); }
