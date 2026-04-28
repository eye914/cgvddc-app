/**
 * 1. renderStaffStats() 카드 컴팩트화 (절반 크기)
 * 2. buildAuthNameGrid() ㄱㄴㄷ 정렬 추가
 */
const fs = require('fs');
const path = require('path');
const appJsPath = path.join(__dirname, '..', 'public', 'cgv-app.js');
let c = fs.readFileSync(appJsPath, 'utf8');

// ── 1. renderStaffStats 카드 HTML 교체 ──
const oldCard = `                container.innerHTML += "<div class='bg-white rounded-[24px] border-2 shadow-sm flex flex-col justify-between "+(isP?"border-red-400 bg-red-50":"border-slate-200")+" relative overflow-hidden font-black'>"
                    + (isP ? "<div class='bg-red-500 text-white text-[10px] font-black py-1.5 text-center tracking-widest uppercase animate-pulse'>정지됨</div>" : "")
                    + "<div class='p-5 flex justify-between items-center'>"
                    + "<div><span class='font-black text-lg "+(isP?"text-red-700":"text-slate-900")+"'>"+m.name+"</span><p class='text-[10px] text-slate-400 font-medium'>"+m.pos.join("/")+"</p></div>"
                    + "<span class='text-[10px] bg-slate-100 px-2 py-1 rounded-full font-black text-slate-500'>주 "+statsMap[m.name].count+"건</span></div>"
                    + "<div class='border-t-2 border-slate-100 p-4 flex flex-col gap-3'>"
                    + "<div class='flex gap-2'>"
                    + "<div class='flex-1 bg-slate-50 rounded-xl p-2 flex flex-col items-center'><span class='text-[10px] font-black text-slate-500'>지각</span><div class='flex items-center gap-2 mt-1'><button onclick=\"updateAttendance('"+m.name+"','late',-1)\" class='w-6 h-6 bg-white border border-slate-200 rounded-md shadow-sm'>-</button><span class='font-black "+(att.late>0?"text-red-600":"")+"'>"+ att.late+"</span><button onclick=\"updateAttendance('"+m.name+"','late',1)\" class='w-6 h-6 bg-white border border-slate-200 rounded-md shadow-sm'>+</button></div></div>"
                    + "<div class='flex-1 bg-slate-50 rounded-xl p-2 flex flex-col items-center'><span class='text-[10px] font-black text-slate-500'>결근</span><div class='flex items-center gap-2 mt-1'><button onclick=\"updateAttendance('"+m.name+"','absent',-1)\" class='w-6 h-6 bg-white border border-slate-200 rounded-md shadow-sm'>-</button><span class='font-black "+(att.absent>0?"text-red-600":"")+"'>"+ att.absent+"</span><button onclick=\"updateAttendance('"+m.name+"','absent',1)\" class='w-6 h-6 bg-white border border-slate-200 rounded-md shadow-sm'>+</button></div></div>"
                    + "</div><div class='bg-gray-100/50 p-3 rounded-lg max-h-[60px] overflow-y-auto'><p class='text-[8px] font-black text-slate-500 uppercase mb-1'>Log</p>"+logHtml+"</div></div></div>";`;

const newCard = `                container.innerHTML += "<div class='bg-white rounded-xl border-2 shadow-sm "+(isP?"border-red-400 bg-red-50":"border-slate-200")+" relative overflow-hidden font-black'>"
                    + (isP ? "<div class='bg-red-500 text-white text-[8px] font-black py-0.5 text-center tracking-widest uppercase animate-pulse'>정지</div>" : "")
                    + "<div class='p-2'>"
                    + "<div class='flex justify-between items-start mb-1'>"
                    + "<span class='font-black text-sm "+(isP?"text-red-700":"text-slate-900")+"'>"+m.name+"</span>"
                    + "<span class='text-[9px] bg-slate-100 px-1.5 py-0.5 rounded-full font-black text-slate-500'>"+statsMap[m.name].count+"건</span></div>"
                    + "<p class='text-[9px] text-slate-400 font-medium mb-2'>"+m.pos.join("/")+"</p>"
                    + "<div class='flex gap-1'>"
                    + "<div class='flex-1 bg-slate-50 rounded-lg p-1 flex flex-col items-center'><span class='text-[8px] font-black text-slate-500'>지각</span><div class='flex items-center gap-1 mt-0.5'><button onclick=\"updateAttendance('"+m.name+"','late',-1)\" class='w-5 h-5 bg-white border border-slate-200 rounded text-xs shadow-sm leading-none'>-</button><span class='text-xs font-black "+(att.late>0?"text-red-600":"")+"'>"+att.late+"</span><button onclick=\"updateAttendance('"+m.name+"','late',1)\" class='w-5 h-5 bg-white border border-slate-200 rounded text-xs shadow-sm leading-none'>+</button></div></div>"
                    + "<div class='flex-1 bg-slate-50 rounded-lg p-1 flex flex-col items-center'><span class='text-[8px] font-black text-slate-500'>결근</span><div class='flex items-center gap-1 mt-0.5'><button onclick=\"updateAttendance('"+m.name+"','absent',-1)\" class='w-5 h-5 bg-white border border-slate-200 rounded text-xs shadow-sm leading-none'>-</button><span class='text-xs font-black "+(att.absent>0?"text-red-600":"")+"'>"+att.absent+"</span><button onclick=\"updateAttendance('"+m.name+"','absent',1)\" class='w-5 h-5 bg-white border border-slate-200 rounded text-xs shadow-sm leading-none'>+</button></div></div>"
                    + "</div></div></div>";`;

if (c.indexOf(oldCard) > -1) {
    c = c.replace(oldCard, newCard);
    console.log('1. 카드 컴팩트화: OK');
} else {
    console.log('1. 카드: 패턴 없음 (CRLF 문제)');
}

// ── 2. buildAuthNameGrid ㄱㄴㄷ 정렬 추가 ──
const oldGrid = `            grid.innerHTML = MISO_DATA.map(function(m) {`;
const newGrid = `            var sorted = MISO_DATA.slice().sort(function(a,b){ return a.name.localeCompare(b.name, 'ko'); });
            grid.innerHTML = sorted.map(function(m) {`;

if (c.indexOf(oldGrid) > -1) {
    c = c.replace(oldGrid, newGrid);
    console.log('2. ㄱㄴㄷ 정렬: OK');
} else {
    console.log('2. 정렬: 패턴 없음');
}

fs.writeFileSync(appJsPath, c, 'utf8');
console.log('\n완료!');
console.log('카드 컴팩트:', c.indexOf('rounded-xl border-2 shadow-sm') > -1 ? 'OK' : 'FAIL');
console.log('ㄱㄴㄷ 정렬:', c.indexOf('localeCompare') > -1 ? 'OK' : 'FAIL');
