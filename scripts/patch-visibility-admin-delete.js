/**
 * 1. visibilitychange: 앱 복귀 시 fetchData() 자동 호출 추가
 * 2. 실시간현황 카드: 관리자(isAdmin) 삭제 버튼 추가 (승인완료 포함 전체)
 */
const fs = require('fs');
const path = require('path');
const appJsPath = path.join(__dirname, '..', 'public', 'cgv-app.js');
let c = fs.readFileSync(appJsPath, 'utf8');

// ── 1. visibilitychange에 fetchData() 추가 ──
const old1 =
'        // 앱 복귀 시 자동 감지 (설정 변경 후)\n' +
'        document.addEventListener(\'visibilitychange\', function() {\n' +
'            if (document.visibilityState !== \'visible\') return;\n' +
'            var n = getPushName();\n' +
'            if (!n) return;\n' +
'            updatePushBtn(n);\n' +
'        });';

const new1 =
'        // 앱 복귀 시 자동 감지 (데이터 새로고침 + 알림 상태 갱신)\n' +
'        document.addEventListener(\'visibilitychange\', function() {\n' +
'            if (document.visibilityState !== \'visible\') return;\n' +
'            if (typeof fetchData === \'function\') fetchData();\n' +
'            var n = getPushName();\n' +
'            if (!n) return;\n' +
'            updatePushBtn(n);\n' +
'        });';

if (c.includes(old1)) { c = c.replace(old1, new1); console.log('1. visibilitychange fetchData: OK'); }
else { console.log('1. visibilitychange 마커 없음'); }

// ── 2. 실시간현황 카드: 관리자 삭제 버튼 (승인완료 포함) ──
// 기존: ((isMine||isAdmin)&&!isD ? 취소버튼 : "")
// 변경: 기존 유지 + isAdmin&&isD 일때 삭제버튼 추가

const old2 = '+ ((isMine||isAdmin)&&!isD ? "<button onclick=\\"cancelTrade(\'"+t.id+"\')\\" class=\'text-[11px] bg-white text-red-400 border border-red-200 px-3 py-1.5 rounded-lg active:scale-95 font-black shadow-sm\'>\\uCDE8\\uC18C</button>" : "")'
           + '\n                    + "</div>"';

const new2 = '+ ((isMine||isAdmin)&&!isD ? "<button onclick=\\"cancelTrade(\'"+t.id+"\')\\" class=\'text-[11px] bg-white text-red-400 border border-red-200 px-3 py-1.5 rounded-lg active:scale-95 font-black shadow-sm\'>\\uCDE8\\uC18C</button>" : "")'
           + '\n                    + (isAdmin&&isD ? "<button onclick=\\"adminCancelTrade(\'"+t.id+"\',\'"+t.reqName+"\')\\" class=\'text-[11px] bg-white text-slate-400 border border-slate-200 px-3 py-1.5 rounded-lg active:scale-95 font-black shadow-sm\'>\\uC0AD\\uC81C</button>" : "")'
           + '\n                    + "</div>"';

if (c.includes(old2)) { c = c.replace(old2, new2); console.log('2. 관리자 삭제 버튼: OK'); }
else {
    // 줄바꿈 없이 찾기
    const old2b = '+ ((isMine||isAdmin)&&!isD ? "<button onclick=\\"cancelTrade(\'"+t.id+"\')\\" class=\'text-[11px] bg-white text-red-400 border border-red-200 px-3 py-1.5 rounded-lg active:scale-95 font-black shadow-sm\'>\\uCDE8\\uC18C</button>" : "")';
    const idx2 = c.indexOf(old2b);
    if (idx2 >= 0) {
        // 다음 "</div>" 찾기
        const closeDiv = '\n                    + "</div>"';
        const insertPos = idx2 + old2b.length;
        const addBtn = '\n                    + (isAdmin&&isD ? "<button onclick=\\"adminCancelTrade(\'"+t.id+"\',\'"+t.reqName+"\')\\" class=\'text-[11px] bg-white text-slate-400 border border-slate-200 px-3 py-1.5 rounded-lg active:scale-95 font-black shadow-sm\'>\\uC0AD\\uC81C</button>" : "")';
        c = c.substring(0, insertPos) + addBtn + c.substring(insertPos);
        console.log('2. 관리자 삭제 버튼(fallback): OK');
    } else {
        console.log('2. 관리자 삭제 버튼 마커 없음');
    }
}

fs.writeFileSync(appJsPath, c, 'utf8');
console.log('패치 완료');
try { new Function(c); console.log('문법 OK'); } catch(e) { console.log('문법 에러:', e.message); }
