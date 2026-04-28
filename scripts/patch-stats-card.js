/**
 * renderStaffStats 카드 HTML을 줄 번호 기반으로 교체
 * CRLF 문제 우회: 시작/끝 마커로 찾아서 교체
 */
const fs = require('fs');
const path = require('path');
const appJsPath = path.join(__dirname, '..', 'public', 'cgv-app.js');
let c = fs.readFileSync(appJsPath, 'utf8');

// 시작 마커: container.innerHTML += 로 시작하는 카드 부분
const startMarker = "container.innerHTML += \"<div class='bg-white rounded-[24px]";
const endMarker = "logHtml+\"</div></div></div>\";";

const si = c.indexOf(startMarker);
const ei = c.indexOf(endMarker);

if (si < 0 || ei < 0) {
    // 이미 compact 버전으로 패치됐는지 확인
    const compactMarker = "container.innerHTML += \"<div class='bg-white rounded-xl border-2";
    if (c.indexOf(compactMarker) > -1) {
        console.log('카드: 이미 compact 버전 - 스킵');
    } else {
        console.log('FAIL: 마커를 찾을 수 없음');
        console.log('startMarker 찾기:', c.indexOf(startMarker));
        console.log('endMarker 찾기:', c.indexOf(endMarker));
    }
    process.exit(0);
}

const beforeCard = c.substring(0, si);
const afterCard = c.substring(ei + endMarker.length);

const newCard = `container.innerHTML += "<div class='bg-white rounded-xl border-2 shadow-sm "+(isP?"border-red-400 bg-red-50":"border-slate-200")+" relative overflow-hidden font-black'>"
                    + (isP ? "<div class='bg-red-500 text-white text-[8px] font-black py-0.5 text-center tracking-widest uppercase animate-pulse'>정지</div>" : "")
                    + "<div class='p-2'>"
                    + "<div class='flex justify-between items-start mb-1'>"
                    + "<span class='font-black text-sm "+(isP?"text-red-700":"text-slate-900")+"'>"+m.name+"</span>"
                    + "<span class='text-[9px] bg-slate-100 px-1.5 py-0.5 rounded-full font-black text-slate-500'>"+statsMap[m.name].count+"건</span></div>"
                    + "<p class='text-[9px] text-slate-400 font-medium mb-2'>"+m.pos.join("/")+"</p>"
                    + "<div class='flex gap-1'>"
                    + "<div class='flex-1 bg-slate-50 rounded-lg p-1 flex flex-col items-center'><span class='text-[8px] font-black text-slate-500'>지각</span><div class='flex items-center gap-1 mt-0.5'><button onclick=\\"updateAttendance('"+m.name+"','late',-1)\\" class='w-5 h-5 bg-white border border-slate-200 rounded text-xs shadow-sm leading-none'>-</button><span class='text-xs font-black "+(att.late>0?"text-red-600":"")+"'>"+att.late+"</span><button onclick=\\"updateAttendance('"+m.name+"','late',1)\\" class='w-5 h-5 bg-white border border-slate-200 rounded text-xs shadow-sm leading-none'>+</button></div></div>"
                    + "<div class='flex-1 bg-slate-50 rounded-lg p-1 flex flex-col items-center'><span class='text-[8px] font-black text-slate-500'>결근</span><div class='flex items-center gap-1 mt-0.5'><button onclick=\\"updateAttendance('"+m.name+"','absent',-1)\\" class='w-5 h-5 bg-white border border-slate-200 rounded text-xs shadow-sm leading-none'>-</button><span class='text-xs font-black "+(att.absent>0?"text-red-600":"")+"'>"+att.absent+"</span><button onclick=\\"updateAttendance('"+m.name+"','absent',1)\\" class='w-5 h-5 bg-white border border-slate-200 rounded text-xs shadow-sm leading-none'>+</button></div></div>"
                    + "</div></div></div>";`;

c = beforeCard + newCard + afterCard;
fs.writeFileSync(appJsPath, c, 'utf8');
console.log('카드 compact 교체: OK');

// 문법 검사
try { new Function(c); console.log('문법 OK'); } catch(e) { console.log('문법 에러:', e.message); }
