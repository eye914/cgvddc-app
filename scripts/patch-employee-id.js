/**
 * 미소지기 추가 폼에 사원번호 입력란 추가
 * - cgv-body.html: 사원번호 input 필드 추가
 * - cgv-app.js: showAddMisojigiForm 초기화 + submitAddMisojigi 전송에 employee_id 포함
 */
const fs = require('fs');
const path = require('path');

// ── 1. HTML: 사원번호 입력란 추가 ──
const htmlPath = path.join(__dirname, '..', 'public', 'cgv-body.html');
let h = fs.readFileSync(htmlPath, 'utf8');

const oldHtml = '                            <input id="miso-add-name" type="text" placeholder="이름" class="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-slate-400" />';
const newHtml =
'                            <input id="miso-add-name" type="text" placeholder="이름" class="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-slate-400" />\n' +
'                            <input id="miso-add-empid" type="text" placeholder="사원번호 (예: 38128)" maxlength="10" class="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-slate-400" />';

if (h.includes(oldHtml)) { h = h.replace(oldHtml, newHtml); console.log('1. HTML 사원번호 입력란: OK'); }
else { console.log('1. HTML 마커 없음'); }

fs.writeFileSync(htmlPath, h, 'utf8');

// ── 2. JS: showAddMisojigiForm에 사원번호 초기화 추가 ──
const appJsPath = path.join(__dirname, '..', 'public', 'cgv-app.js');
let c = fs.readFileSync(appJsPath, 'utf8');

const old2 =
'        function showAddMisojigiForm() {\n' +
'            var form = document.getElementById(\'miso-add-form\');\n' +
'            if (!form) return;\n' +
'            form.classList.remove(\'hidden\');\n' +
'            var nameInput = document.getElementById(\'miso-add-name\');\n' +
'            if (nameInput) { nameInput.value = \'\'; nameInput.focus(); }\n' +
'            [\'매점\', \'플로어\', \'통합\'].forEach(function(p) {\n' +
'                var cb = document.getElementById(\'miso-pos-\' + p);\n' +
'                if (cb) cb.checked = false;\n' +
'            });\n' +
'            var h = document.getElementById(\'miso-add-hours\');\n' +
'            if (h) h.value = \'5.5\';\n' +
'        }';

const new2 =
'        function showAddMisojigiForm() {\n' +
'            var form = document.getElementById(\'miso-add-form\');\n' +
'            if (!form) return;\n' +
'            form.classList.remove(\'hidden\');\n' +
'            var nameInput = document.getElementById(\'miso-add-name\');\n' +
'            if (nameInput) { nameInput.value = \'\'; nameInput.focus(); }\n' +
'            var empInput = document.getElementById(\'miso-add-empid\');\n' +
'            if (empInput) empInput.value = \'\';\n' +
'            [\'매점\', \'플로어\', \'통합\'].forEach(function(p) {\n' +
'                var cb = document.getElementById(\'miso-pos-\' + p);\n' +
'                if (cb) cb.checked = false;\n' +
'            });\n' +
'            var h = document.getElementById(\'miso-add-hours\');\n' +
'            if (h) h.value = \'5.5\';\n' +
'        }';

if (c.includes(old2)) { c = c.replace(old2, new2); console.log('2. JS showAddMisojigiForm 초기화: OK'); }
else { console.log('2. JS showAddMisojigiForm 마커 없음'); }

// ── 3. JS: submitAddMisojigi에 employee_id 포함 ──
const old3 = '                .addMisojigi(name, pos, hours);';
const new3 = '                .addMisojigi(name, pos, hours, employeeId);';

// employeeId 변수 선언 추가
const old3b =
'        function submitAddMisojigi() {\n' +
'            var name = ((document.getElementById(\'miso-add-name\') || {}).value || \'\').trim();\n' +
'            if (!name) { alert(\'이름을 입력하세요.\'); return; }';

const new3b =
'        function submitAddMisojigi() {\n' +
'            var name = ((document.getElementById(\'miso-add-name\') || {}).value || \'\').trim();\n' +
'            if (!name) { alert(\'이름을 입력하세요.\'); return; }\n' +
'            var employeeId = ((document.getElementById(\'miso-add-empid\') || {}).value || \'\').trim();';

if (c.includes(old3b)) { c = c.replace(old3b, new3b); console.log('3a. JS employeeId 변수: OK'); }
else { console.log('3a. JS employeeId 변수 마커 없음'); }

if (c.includes(old3)) { c = c.replace(old3, new3); console.log('3b. JS addMisojigi 호출: OK'); }
else { console.log('3b. JS addMisojigi 호출 마커 없음'); }

fs.writeFileSync(appJsPath, c, 'utf8');
console.log('패치 완료');
try { new Function(c); console.log('문법 OK'); } catch(e) { console.log('문법 에러:', e.message); }
