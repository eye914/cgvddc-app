/**
 * 관리자 취소 권한 추가
 * 1. 신청현황 카드: (isMine||isAdmin)&&!isD 조건으로 취소 버튼 표시
 * 2. 관리자 탭 카드: 승인대기 상태에 취소 버튼 추가
 * 3. adminCancelTrade 함수 추가
 */
const fs = require('fs');
const path = require('path');
const appJsPath = path.join(__dirname, '..', 'public', 'cgv-app.js');
let c = fs.readFileSync(appJsPath, 'utf8');

// ── 1. 메인 카드 헤더 취소버튼: isMine → isMine||isAdmin ──
const old1 = '+ (isMine ? "<button onclick=\\"cancelTrade(\'"+t.id+"\')\\" class=\'ml-auto text-[10px] bg-white text-red-400 border border-red-200 px-2 py-0.5 rounded-md font-black\'>\\uCDE8\\uC18C</button>" : "<span class=\'ml-auto text-slate-400 text-[10px] flex-shrink-0\'>눌러서 보기 ▼</span>")';
const new1 = '+ ((isMine||isAdmin) ? "<button onclick=\\"cancelTrade(\'"+t.id+"\')\\" class=\'ml-auto text-[10px] bg-white text-red-400 border border-red-200 px-2 py-0.5 rounded-md font-black\'>\\uCDE8\\uC18C</button>" : "<span class=\'ml-auto text-slate-400 text-[10px] flex-shrink-0\'>눌러서 보기 ▼</span>")';
if (c.includes(old1)) { c = c.replace(old1, new1); console.log('1. 헤더 취소버튼: OK'); }
else { console.log('1. 헤더 취소버튼 마커 없음'); }

// ── 2. 메인 카드 바디 취소버튼: isMine&&!isD → (isMine||isAdmin)&&!isD ──
const old2 = '+ (isMine&&!isD ? "<button onclick=\\"cancelTrade(\'"+t.id+"\')\\" class=\'text-[11px] bg-white text-slate-400 border border-slate-200 px-3 py-1.5 rounded-lg active:scale-95 font-black shadow-sm\'>\\uCDE8\\uC18C</button>" : "")';
const new2 = '+ ((isMine||isAdmin)&&!isD ? "<button onclick=\\"cancelTrade(\'"+t.id+"\')\\" class=\'text-[11px] bg-white text-red-400 border border-red-200 px-3 py-1.5 rounded-lg active:scale-95 font-black shadow-sm\'>\\uCDE8\\uC18C</button>" : "")';
if (c.includes(old2)) { c = c.replace(old2, new2); console.log('2. 바디 취소버튼: OK'); }
else { console.log('2. 바디 취소버튼 마커 없음'); }

// ── 3. 관리자 탭 카드: 승인대기에 취소 버튼 추가 ──
const old3 = ': "<div class=\'flex gap-3\'><button onclick=\\"adminApprove(\'"+t.id+"\')\\" class=\'flex-1 bg-slate-900 text-white py-5 rounded-2xl font-black shadow-md\'>\\uCD5C\\uC885 \\uC2B9\\uC778</button><button onclick=\\"adminReject(\'"+t.id+"\')\\" class=\'flex-1 bg-red-600 text-white py-5 rounded-2xl font-black shadow-md\'>\\uBC18\\uB824</button></div>")';
const new3 = ': "<div class=\'flex gap-3\'><button onclick=\\"adminApprove(\'"+t.id+"\')\\" class=\'flex-1 bg-slate-900 text-white py-5 rounded-2xl font-black shadow-md\'>\\uCD5C\\uC885 \\uC2B9\\uC778</button><button onclick=\\"adminReject(\'"+t.id+"\')\\" class=\'flex-1 bg-red-600 text-white py-5 rounded-2xl font-black shadow-md\'>\\uBC18\\uB824</button></div><button onclick=\\"adminCancelTrade(\'"+t.id+"\',\'"+t.reqName+"\')\\" class=\'w-full mt-2 bg-white text-slate-400 border border-slate-200 py-3 rounded-2xl font-black text-sm\'>\\uACF5\\uACE0 \\uCDE8\\uC18C (\\uAD00\\uB9AC\\uC790)</button>")';
if (c.includes(old3)) { c = c.replace(old3, new3); console.log('3. 관리자 탭 취소버튼: OK'); }
else { console.log('3. 관리자 탭 취소버튼 마커 없음'); }

// ── 4. adminCancelTrade 함수 추가 (cancelTrade 앞에) ──
const fnMarker = '        function cancelTrade(id){';
const fnIdx = c.indexOf(fnMarker);
if (fnIdx >= 0) {
    const newFn =
'        function adminCancelTrade(id, reqName) {\n' +
'            if (!confirm((reqName || "해당") + " 공고를 관리자 권한으로 취소합니다.\\n이 작업은 되돌릴 수 없습니다. 계속하시겠습니까?")) return;\n' +
'            showLoader(true);\n' +
'            google.script.run\n' +
'                .withSuccessHandler(fetchData)\n' +
'                .withFailureHandler(function(e){ showLoader(false); alert("취소 실패: " + e.message); })\n' +
'                .deleteTradeFromDB(id);\n' +
'        }\n\n';
    c = c.substring(0, fnIdx) + newFn + c.substring(fnIdx);
    console.log('4. adminCancelTrade 함수: OK');
} else {
    console.log('4. cancelTrade 마커 없음');
}

fs.writeFileSync(appJsPath, c, 'utf8');
console.log('패치 완료');
try { new Function(c); console.log('문법 OK'); } catch(e) { console.log('문법 에러:', e.message); }
