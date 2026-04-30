/**
 * 미소지기 캐시 만료 시간 추가
 * - sessionStorage cgv_miso 캐시에 타임스탬프 추가
 * - 1시간 경과 시 자동으로 새로 fetch
 * - DB 변경 후 앱 재실행 없이도 최신 인원 목록 반영
 */
const fs = require('fs');
const path = require('path');
const appJsPath = path.join(__dirname, '..', 'public', 'cgv-app.js');
let c = fs.readFileSync(appJsPath, 'utf8');

const old1 =
'        function loadMisoForAuth() {\n' +
'            var cached = sessionStorage.getItem(\'cgv_miso\');\n' +
'            if (cached) {\n' +
'                try { var p = JSON.parse(cached); if (p && p.length) { MISO_DATA = p; buildAuthNameGrid(); return; } } catch(e) {}\n' +
'            }\n' +
'            fetch(\'/api/misojigi\')\n' +
'                .then(function(r) { return r.json(); })\n' +
'                .then(function(list) {\n' +
'                    if (Array.isArray(list) && list.length) {\n' +
'                        MISO_DATA = list;\n' +
'                        sessionStorage.setItem(\'cgv_miso\', JSON.stringify(list));\n' +
'                    }\n' +
'                    buildAuthNameGrid();\n' +
'                })\n' +
'                .catch(function() { buildAuthNameGrid(); });\n' +
'        }';

const new1 =
'        function loadMisoForAuth() {\n' +
'            var CACHE_TTL = 60 * 60 * 1000; // 1시간\n' +
'            var cached = sessionStorage.getItem(\'cgv_miso\');\n' +
'            if (cached) {\n' +
'                try {\n' +
'                    var obj = JSON.parse(cached);\n' +
'                    var list = Array.isArray(obj) ? obj : (obj && obj.data ? obj.data : null);\n' +
'                    var ts = obj && obj.ts ? obj.ts : 0;\n' +
'                    var fresh = (Date.now() - ts) < CACHE_TTL;\n' +
'                    if (list && list.length && fresh) { MISO_DATA = list; buildAuthNameGrid(); return; }\n' +
'                } catch(e) {}\n' +
'            }\n' +
'            fetch(\'/api/misojigi\')\n' +
'                .then(function(r) { return r.json(); })\n' +
'                .then(function(list) {\n' +
'                    if (Array.isArray(list) && list.length) {\n' +
'                        MISO_DATA = list;\n' +
'                        sessionStorage.setItem(\'cgv_miso\', JSON.stringify({ data: list, ts: Date.now() }));\n' +
'                    }\n' +
'                    buildAuthNameGrid();\n' +
'                })\n' +
'                .catch(function() { buildAuthNameGrid(); });\n' +
'        }';

if (c.includes(old1)) { c = c.replace(old1, new1); console.log('1. loadMisoForAuth 캐시 만료: OK'); }
else { console.log('1. 마커 없음'); }

// fetchData 내부의 cgv_miso 저장도 동일하게 타임스탬프 포함하도록 수정
const old2 = "                        MISO_DATA = list;\n" +
             "                        sessionStorage.setItem('cgv_miso', JSON.stringify(list));";
// 여러 곳에 있을 수 있으므로 replace_all
if (c.includes(old2)) {
    c = c.split(old2).join(
        "                        MISO_DATA = list;\n" +
        "                        sessionStorage.setItem('cgv_miso', JSON.stringify({ data: list, ts: Date.now() }));"
    );
    console.log('2. fetchData cgv_miso 저장 타임스탬프: OK');
} else { console.log('2. fetchData cgv_miso 마커 없음 (스킵)'); }

// fetchData에서 cgv_miso 캐시 읽는 부분도 새 형식으로 수정
const old3 = "try { var p = JSON.parse(cached); if (p && p.length) { MISO_DATA = p;";
const new3 = "try { var parsed2 = JSON.parse(cached); var p = Array.isArray(parsed2) ? parsed2 : (parsed2 && parsed2.data ? parsed2.data : []); if (p && p.length) { MISO_DATA = p;";
if (c.includes(old3)) {
    c = c.split(old3).join(new3);
    console.log('3. 캐시 읽기 파싱 수정: OK');
} else { console.log('3. 캐시 읽기 마커 없음 (스킵)'); }

fs.writeFileSync(appJsPath, c, 'utf8');
console.log('패치 완료');
try { new Function(c); console.log('문법 OK'); } catch(e) { console.log('문법 에러:', e.message); }
