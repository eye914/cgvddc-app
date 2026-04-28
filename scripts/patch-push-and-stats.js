/**
 * 1. updatePushBtn: granted 상태에서 즉시 "알림ON" 표시, 백그라운드 재구독
 * 2. setTimeout 300ms 제거 → 즉시 호출
 * 3. stats header: 이전주/다음주 버튼 축약 + 주차 텍스트 폰트 축소
 * 4. visibilitychange: 즉시 업데이트
 */
const fs = require('fs');
const path = require('path');
const appJsPath = path.join(__dirname, '..', 'public', 'cgv-app.js');
let c = fs.readFileSync(appJsPath, 'utf8');

// ── 1. updatePushBtn 함수 교체 ──
const btnStart = '        function updatePushBtn(name) {';
const btnEnd = '        }';
const bsi = c.indexOf(btnStart);
if (bsi < 0) { console.log('updatePushBtn 마커 없음'); process.exit(1); }
// Find closing brace of updatePushBtn (first } at same indent level after bsi)
let depth = 0, bei = -1;
for (let i = bsi; i < c.length; i++) {
    if (c[i] === '{') depth++;
    else if (c[i] === '}') { depth--; if (depth === 0) { bei = i + 1; break; } }
}
if (bei < 0) { console.log('updatePushBtn 끝 찾기 실패'); process.exit(1); }

const newUpdatePushBtn = '        function updatePushBtn(name) {\n' +
'            var btn = document.getElementById(\'push-subscribe-btn\');\n' +
'            if (!btn) return;\n' +
'            if (!(\'Notification\' in window)) { btn.style.display = \'none\'; return; }\n' +
'            var n = name || getPushName();\n' +
'            var perm = Notification.permission;\n' +
'            if (perm === \'granted\') {\n' +
'                btn.innerHTML = \'<span class="text-green-600 font-black text-xs">🔔 알림 ON</span>\';\n' +
'                btn.onclick = null;\n' +
'                btn.style.cursor = \'default\';\n' +
'                // 세션 재시작 시 백그라운드 재구독\n' +
'                if (sessionStorage.getItem(\'cgv_push_subscribed\') !== \'true\' && n) {\n' +
'                    doSubscribe(n);\n' +
'                }\n' +
'            } else if (perm === \'denied\') {\n' +
'                btn.innerHTML = \'<span class="font-black text-xs text-red-500">🔕 차단됨</span>\';\n' +
'                btn.onclick = function() { showPushDeniedGuide(); };\n' +
'                btn.style.cursor = \'pointer\';\n' +
'            } else {\n' +
'                btn.innerHTML = \'<span class="font-black text-xs text-slate-500">🔕 알림 받기</span>\';\n' +
'                btn.onclick = function() { requestPushPermission(n); };\n' +
'                btn.style.cursor = \'pointer\';\n' +
'            }\n' +
'        }';

c = c.substring(0, bsi) + newUpdatePushBtn + c.substring(bei);

// ── 2. visibilitychange 핸들러: 기존 교체 ──
const visStart = '        // 앱 복귀 시 자동 감지';
const visEnd = '        function testPushNotification(name)';
const vsi = c.indexOf(visStart);
const vei = c.indexOf(visEnd);
if (vsi >= 0 && vei > vsi) {
    const newVis = '        // 앱 복귀 시 자동 감지 (설정 변경 후)\n' +
'        document.addEventListener(\'visibilitychange\', function() {\n' +
'            if (document.visibilityState !== \'visible\') return;\n' +
'            var n = getPushName();\n' +
'            if (!n) return;\n' +
'            updatePushBtn(n);\n' +
'        });\n\n' +
'        ';
    c = c.substring(0, vsi) + newVis + c.substring(vei);
}

// ── 3. setTimeout 300ms 제거 (authSuccess) ──
const authDelay = "if (_pName && typeof updatePushBtn === 'function') setTimeout(function(){ updatePushBtn(_pName); }, 300);";
const authImm   = "if (_pName && typeof updatePushBtn === 'function') updatePushBtn(_pName);";
c = c.split(authDelay).join(authImm);

// ── 4. setTimeout 300ms 제거 (__initApp__) ──
const initDelay = "if (_rName && typeof updatePushBtn === 'function') setTimeout(function(){ updatePushBtn(_rName); }, 300);";
const initImm   = "if (_rName && typeof updatePushBtn === 'function') updatePushBtn(_rName);";
c = c.split(initDelay).join(initImm);

// ── 5. stats header: 이전주/다음주 버튼 축소 + 주차 텍스트 ──
const oldHeader = '"<div class=\'flex justify-between items-center bg-slate-50 p-3 rounded-2xl border-2 border-slate-200 mb-6 font-black\'><button onclick=\'changeStatsWeek(-1)\' class=\'px-4 py-2.5 bg-white rounded-xl shadow-sm border font-black text-slate-500\'>\\uC774\\uC804 \\uC8FC</button><span class=\'font-black text-lg text-slate-800\'>"+wk+"</span><button onclick=\'changeStatsWeek(1)\' class=\'px-4 py-2.5 bg-white rounded-xl shadow-sm border font-black text-slate-500\'>\\uB2E4\\uC74C \\uC8FC</button></div>"';
const newHeader = '"<div class=\'flex justify-between items-center bg-slate-50 px-3 py-2 rounded-2xl border-2 border-slate-200 mb-4 font-black\'><button onclick=\'changeStatsWeek(-1)\' class=\'px-2 py-1.5 bg-white rounded-lg shadow-sm border font-black text-slate-500 text-xs\'>\\uC774\\uC804</button><span class=\'font-black text-sm text-slate-800 text-center flex-1\'>" + wk + "</span><button onclick=\'changeStatsWeek(1)\' class=\'px-2 py-1.5 bg-white rounded-lg shadow-sm border font-black text-slate-500 text-xs\'>\\uB2E4\\uC74C</button></div>"';

// Use simpler find and replace for the header innerHTML line
const headerLineOld = 'header.innerHTML = "<div class=\'flex justify-between items-center bg-slate-50 p-3 rounded-2xl border-2 border-slate-200 mb-6 font-black\'><button onclick=\'changeStatsWeek(-1)\' class=\'px-4 py-2.5 bg-white rounded-xl shadow-sm border font-black text-slate-500\'>이전 주</button><span class=\'font-black text-lg text-slate-800\'>"+wk+"</span><button onclick=\'changeStatsWeek(1)\' class=\'px-4 py-2.5 bg-white rounded-xl shadow-sm border font-black text-slate-500\'>다음 주</button></div>";';
const headerLineNew = 'header.innerHTML = "<div class=\'flex justify-between items-center gap-1 bg-slate-50 px-3 py-2 rounded-2xl border-2 border-slate-200 mb-4 font-black\'><button onclick=\'changeStatsWeek(-1)\' class=\'shrink-0 px-2 py-1.5 bg-white rounded-lg shadow-sm border font-black text-slate-500 text-xs\'>이전</button><span class=\'font-black text-sm text-slate-800 text-center leading-tight\'>" + wk + "</span><button onclick=\'changeStatsWeek(1)\' class=\'shrink-0 px-2 py-1.5 bg-white rounded-lg shadow-sm border font-black text-slate-500 text-xs\'>다음</button></div>";';

const hli = c.indexOf(headerLineOld);
if (hli >= 0) {
    c = c.substring(0, hli) + headerLineNew + c.substring(hli + headerLineOld.length);
    console.log('stats header 교체: OK');
} else {
    console.log('stats header 마커 없음 (건너뜀)');
}

fs.writeFileSync(appJsPath, c, 'utf8');
console.log('push + stats 패치: OK');
try { new Function(c); console.log('문법 OK'); } catch(e) { console.log('문법 에러:', e.message); }
