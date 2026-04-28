/**
 * 1. window.onload → readyState 체크 방식으로 교체 (afterInteractive 타이밍 문제 해결)
 * 2. loadMisoForAuth → 직접 fetch 사용 (shim 의존성 제거)
 */
const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, '..', 'public', 'cgv-app.js');
let c = fs.readFileSync(appJsPath, 'utf8');

// ── 1. loadMisoForAuth: google.script.run → 직접 fetch ──
const oldLoad = `        function loadMisoForAuth() {
            var cached = sessionStorage.getItem('cgv_miso');
            if (cached) {
                try { var p = JSON.parse(cached); if (p && p.length) { MISO_DATA = p; buildAuthNameGrid(); return; } } catch(e) {}
            }
            google.script.run
                .withSuccessHandler(function(list) {
                    if (list && list.length) { MISO_DATA = list; sessionStorage.setItem('cgv_miso', JSON.stringify(list)); }
                    buildAuthNameGrid();
                })
                .withFailureHandler(function() { buildAuthNameGrid(); })
                .getMisojigiFromDB();
        }`;

const newLoad = `        function loadMisoForAuth() {
            var cached = sessionStorage.getItem('cgv_miso');
            if (cached) {
                try { var p = JSON.parse(cached); if (p && p.length) { MISO_DATA = p; buildAuthNameGrid(); return; } } catch(e) {}
            }
            fetch('/api/misojigi')
                .then(function(r) { return r.json(); })
                .then(function(list) {
                    if (Array.isArray(list) && list.length) {
                        MISO_DATA = list;
                        sessionStorage.setItem('cgv_miso', JSON.stringify(list));
                    }
                    buildAuthNameGrid();
                })
                .catch(function() { buildAuthNameGrid(); });
        }`;

if (c.indexOf(oldLoad) > -1) {
    c = c.replace(oldLoad, newLoad);
    console.log('1. loadMisoForAuth fetch 직접 호출: OK');
} else {
    console.log('1. loadMisoForAuth: 패턴 없음 - 이미 패치됐거나 CRLF 문제');
}

// ── 2. window.onload → readyState 체크 방식 교체 ──
// "window.onload = function() {" 를 찾아서 교체
const oldOnload = 'window.onload = function() {';
const newOnload = 'function __initApp__() {';

if (c.indexOf(oldOnload) > -1) {
    c = c.replace(oldOnload, newOnload);
    console.log('2. window.onload 선언 교체: OK');
} else {
    console.log('2. window.onload 선언: 이미 교체됐거나 없음');
}

// window.onload 닫는 부분 뒤에 readyState 초기화 코드 추가
// window.onload 의 마지막 }; 를 찾아서 교체 - 대신 __initApp__ 뒤에 추가
// window.onload = function() { ... }; 의 마지막 }; 를 찾아야 함
// __initApp__ 이 이미 교체된 상태이므로 function __initApp__() 로 찾으면 됨

// __initApp__ 함수 블록이 끝나는 위치 다음에 실행 코드 추가
// 패턴: 줄 끝에 있는 window.onload 관련 닫기를 찾기
// 더 안전한 방법: 파일 맨 끝에 추가

// 현재 파일에 readyState 초기화가 있는지 확인
if (c.indexOf('__initApp__') > -1 && c.indexOf('readyState') < 0) {
    // 파일 끝에 실행 코드 추가
    c = c + '\n        if (document.readyState === "complete") { __initApp__(); } else { window.addEventListener("load", __initApp__); }\n';
    console.log('3. readyState 초기화 코드 추가: OK');
} else if (c.indexOf('readyState') > -1) {
    console.log('3. readyState 초기화 코드: 이미 있음');
} else {
    console.log('3. readyState: __initApp__ 없음, 스킵');
}

fs.writeFileSync(appJsPath, c, 'utf8');
console.log('\n완료!');
console.log('loadMisoForAuth fetch:', c.indexOf("fetch('/api/misojigi')") > -1 ? 'OK' : 'FAIL');
console.log('__initApp__:', c.indexOf('__initApp__') > -1 ? 'OK' : 'FAIL');
console.log('readyState:', c.indexOf('readyState') > -1 ? 'OK' : 'FAIL');
