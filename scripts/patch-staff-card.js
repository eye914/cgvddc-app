/**
 * 미소지기 카드 이름 세로 줄바꿈 방지
 * - 이름: whitespace-nowrap + text-xs
 * - 0건 배지: 이름 아래로 이동 (flex-col)
 * - 포지션 텍스트: truncate
 * - 그리드: 모바일 grid-cols-2 → 이름이 짤리지 않게
 */
const fs = require('fs');
const path = require('path');
const appJsPath = path.join(__dirname, '..', 'public', 'cgv-app.js');
let c = fs.readFileSync(appJsPath, 'utf8');

// 카드 렌더링 블록 찾기
const startMarker = 'container.innerHTML += "<div class=\'bg-white rounded-xl border-2 shadow-sm ';
const idx = c.indexOf(startMarker);
if (idx < 0) { console.log('마커 없음'); process.exit(1); }

// 줄 끝 찾기 (+ "</div></div></div>"; 까지)
const endMarker = '+ "</div></div></div>";';
const endIdx = c.indexOf(endMarker, idx);
if (endIdx < 0) { console.log('끝 마커 없음'); process.exit(1); }
const endOfLine = c.indexOf('\n', endIdx);

const newCard =
'container.innerHTML += "<div class=\'bg-white rounded-xl border-2 shadow-sm "+(isP?"border-red-400 bg-red-50":"border-slate-200")+" relative overflow-hidden font-black\'>"\n' +
'                    + (isP ? "<div class=\'bg-red-500 text-white text-[8px] font-black py-0.5 text-center tracking-widest uppercase animate-pulse\'>정지</div>" : "")\n' +
'                    + "<div class=\'p-2\'>"\n' +
'                    + "<div class=\'mb-1\'>"\n' +
'                    + "<span class=\'font-black text-xs whitespace-nowrap "+(isP?"text-red-700":"text-slate-900")+"\'>"+m.name+"</span>"\n' +
'                    + "<span class=\'ml-1 text-[8px] bg-slate-100 px-1 py-0.5 rounded-full font-black text-slate-400\'>"+statsMap[m.name].count+"건</span></div>"\n' +
'                    + "<p class=\'text-[8px] text-slate-400 font-medium mb-1.5 truncate\'>"+m.pos.join("/")+"</p>"\n' +
'                    + "<div class=\'flex gap-1\'>"\n' +
'                    + "<div class=\'flex-1 bg-slate-50 rounded-lg p-1 flex flex-col items-center\'><span class=\'text-[8px] font-black text-slate-500\'>지각</span><div class=\'flex items-center gap-0.5 mt-0.5\'><button onclick=\\"updateAttendance(\'"+m.name+"\',' + "'late'" + ',-1)\\" class=\'w-5 h-5 bg-white border border-slate-200 rounded text-xs shadow-sm leading-none\'>-</button><span class=\'text-xs font-black "+(att.late>0?"text-red-600":"")+"\'>"+att.late+"</span><button onclick=\\"updateAttendance(\'"+m.name+"\',' + "'late'" + ',1)\\" class=\'w-5 h-5 bg-white border border-slate-200 rounded text-xs shadow-sm leading-none\'>+</button></div></div>"\n' +
'                    + "<div class=\'flex-1 bg-slate-50 rounded-lg p-1 flex flex-col items-center\'><span class=\'text-[8px] font-black text-slate-500\'>결근</span><div class=\'flex items-center gap-0.5 mt-0.5\'><button onclick=\\"updateAttendance(\'"+m.name+"\',' + "'absent'" + ',-1)\\" class=\'w-5 h-5 bg-white border border-slate-200 rounded text-xs shadow-sm leading-none\'>-</button><span class=\'text-xs font-black "+(att.absent>0?"text-red-600":"")+"\'>"+att.absent+"</span><button onclick=\\"updateAttendance(\'"+m.name+"\',' + "'absent'" + ',1)\\" class=\'w-5 h-5 bg-white border border-slate-200 rounded text-xs shadow-sm leading-none\'>+</button></div></div>"\n' +
'                    + "</div></div></div>";';

c = c.substring(0, idx) + newCard + c.substring(endOfLine);
fs.writeFileSync(appJsPath, c, 'utf8');
console.log('카드 교체: OK');
try { new Function(c); console.log('문법 OK'); } catch(e) { console.log('문법 에러:', e.message); }
