/**
 * push 버튼 업데이트 코드 삽입 (마커 기반)
 */
const fs = require('fs');
const path = require('path');
const appJsPath = path.join(__dirname, '..', 'public', 'cgv-app.js');
let c = fs.readFileSync(appJsPath, 'utf8');

// ── 1. authSuccess: fetchData(); 뒤에 push 버튼 업데이트 삽입 ──
// authSuccess 함수 내의 fetchData() 찾기
const authSuccessMarker = 'function authSuccess(r) {';
const fetchDataInAuth = 'fetchData();\n        }';  // authSuccess 함수의 마지막 fetchData

const siAuth = c.indexOf(authSuccessMarker);
if (siAuth > -1) {
    // authSuccess 함수 내에서 fetchData() 찾기
    const authBlock = c.substring(siAuth, siAuth + 600);
    const relIdx = authBlock.indexOf('fetchData();');
    if (relIdx > -1 && authBlock.indexOf('updatePushBtn') < 0) {
        const absIdx = siAuth + relIdx + 'fetchData();'.length;
        const insertCode = '\n            // 알림 버튼 업데이트\n            var _pName = sessionStorage.getItem(\'cgv_currentUser\') || sessionStorage.getItem(\'cgv_admin_name\');\n            if (_pName && typeof updatePushBtn === \'function\') setTimeout(function(){ updatePushBtn(_pName); }, 300);';
        c = c.substring(0, absIdx) + insertCode + c.substring(absIdx);
        console.log('1. authSuccess push 버튼: OK');
    } else if (authBlock.indexOf('updatePushBtn') > -1) {
        console.log('1. authSuccess push 버튼: 이미 있음');
    } else {
        console.log('1. authSuccess fetchData 위치 못 찾음');
    }
} else {
    console.log('1. authSuccess 함수 없음');
}

// ── 2. __initApp__ 세션 복원: fetchData(); 뒤에 push 버튼 삽입 ──
const initMarker = 'function __initApp__() {';
const siInit = c.indexOf(initMarker);
if (siInit > -1) {
    // __initApp__ 내부의 cgv_auth 분기 찾기
    const initBlock = c.substring(siInit, siInit + 1000);
    const cvIdx = initBlock.indexOf('cgv_auth');
    const fetchIdx = initBlock.indexOf('fetchData();', cvIdx);
    if (fetchIdx > -1 && initBlock.indexOf('_rName') < 0) {
        const absIdx = siInit + fetchIdx + 'fetchData();'.length;
        const insertCode = '\n                var _rName = sessionStorage.getItem(\'cgv_currentUser\') || sessionStorage.getItem(\'cgv_admin_name\');\n                if (_rName && typeof updatePushBtn === \'function\') setTimeout(function(){ updatePushBtn(_rName); }, 300);';
        c = c.substring(0, absIdx) + insertCode + c.substring(absIdx);
        console.log('2. 세션 복원 push 버튼: OK');
    } else if (initBlock.indexOf('_rName') > -1) {
        console.log('2. 세션 복원 push 버튼: 이미 있음');
    } else {
        console.log('2. 세션 복원 fetchData 위치 못 찾음');
    }
}

fs.writeFileSync(appJsPath, c, 'utf8');
try { new Function(c); console.log('\n문법 OK'); } catch(e) { console.log('\n문법 에러:', e.message); }
