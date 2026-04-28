const fs = require('fs');
const path = require('path');
const appJsPath = path.join(__dirname, '..', 'public', 'cgv-app.js');
let c = fs.readFileSync(appJsPath, 'utf8');

// Find the stats header line by unique substring
const marker = "header.innerHTML = \"<div class='flex justify-between items-center bg-slate-50 p-3 rounded-2xl";
const idx = c.indexOf(marker);
if (idx < 0) { console.log('마커 없음'); process.exit(1); }

// Find end of that line
const lineEnd = c.indexOf('\n', idx);
const oldLine = c.substring(idx, lineEnd);

// Build replacement - use shorter buttons
const newLine = "            header.innerHTML = \"<div class='flex justify-between items-center gap-1 bg-slate-50 px-3 py-2 rounded-2xl border-2 border-slate-200 mb-3 font-black'><button onclick='changeStatsWeek(-1)' class='shrink-0 px-2 py-1 bg-white rounded-lg shadow-sm border font-black text-slate-500 text-xs'>\\uC774\\uC804</button><span class='font-black text-xs text-slate-700 text-center flex-1'>\"+wk+\"</span><button onclick='changeStatsWeek(1)' class='shrink-0 px-2 py-1 bg-white rounded-lg shadow-sm border font-black text-slate-500 text-xs'>\\uB2E4\\uC74C</button></div>\";";

c = c.substring(0, idx) + newLine + c.substring(lineEnd);
fs.writeFileSync(appJsPath, c, 'utf8');
console.log('stats 헤더 교체: OK');
try { new Function(c); console.log('문법 OK'); } catch(e) { console.log('문법 에러:', e.message); }
