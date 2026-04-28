/**
 * cgv-app.js 맨 끝 초기화 코드 교체
 * defer 로딩 시: readyState === "interactive" → DOMContentLoaded 이후
 * 그냥 직접 호출하면 됨 (defer 보장)
 */
const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, '..', 'public', 'cgv-app.js');
let c = fs.readFileSync(appJsPath, 'utf8');

// 기존 readyState 체크 코드 교체
const oldInit = `        if (document.readyState === "complete") { __initApp__(); } else { window.addEventListener("load", __initApp__); }`;
const newInit = `        // defer 스크립트: DOM 파싱 완료 후 실행 보장 → 바로 호출
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", __initApp__);
        } else {
            __initApp__();
        }`;

if (c.indexOf(oldInit) > -1) {
    c = c.replace(oldInit, newInit);
    console.log('초기화 코드 교체: OK');
} else {
    console.log('패턴 없음 - 이미 교체됐거나 CRLF 문제');
    // 현재 어떤 형태인지 확인
    var idx = c.indexOf('__initApp__');
    if (idx > -1) {
        console.log('현재 __initApp__ 관련 코드:', c.substring(idx, idx + 200));
    }
}

fs.writeFileSync(appJsPath, c, 'utf8');
console.log('완료!');
console.log('DOMContentLoaded:', c.indexOf('DOMContentLoaded') > -1 ? 'OK' : 'FAIL');
