/**
 * 관리자 탭 UI 개선:
 * 1. ADMIN 헤더 크기 축소
 * 2. 주간 근태 제목 폰트 조정
 * 3. 주간 근태 컨테이너 패딩 조정
 */
const fs = require('fs');
const path = require('path');
const htmlPath = path.join(__dirname, '..', 'public', 'cgv-body.html');
let c = fs.readFileSync(htmlPath, 'utf8');

// ── 1. ADMIN 헤더 축소 ──
const oldAdminCard = 'class="bg-slate-900 rounded-[50px] p-16 text-white relative overflow-hidden shadow-2xl border-b-[10px] border-red-600"';
const newAdminCard = 'class="bg-slate-900 rounded-[20px] p-5 text-white relative overflow-hidden shadow-xl border-b-[4px] border-red-600"';
if (c.includes(oldAdminCard)) {
    c = c.replace(oldAdminCard, newAdminCard);
    console.log('ADMIN 카드 교체: OK');
} else { console.log('ADMIN 카드 마커 없음'); }

const oldAdminTitle = 'class="text-5xl font-black italic tracking-tighter mb-3 text-red-500 font-mono">ADMIN</h2>';
const newAdminTitle = 'class="text-2xl font-black italic tracking-tighter mb-1 text-red-500 font-mono">ADMIN</h2>';
if (c.includes(oldAdminTitle)) {
    c = c.replace(oldAdminTitle, newAdminTitle);
    console.log('ADMIN 제목 교체: OK');
} else { console.log('ADMIN 제목 마커 없음'); }

const oldAdminSub = 'class="text-[11px] text-slate-400 font-bold uppercase tracking-[0.6em] opacity-90 mb-10">Final Approval Queue</p>';
const newAdminSub = 'class="text-[10px] text-slate-400 font-bold uppercase tracking-widest opacity-80 mb-0">Final Approval Queue</p>';
if (c.includes(oldAdminSub)) {
    c = c.replace(oldAdminSub, newAdminSub);
    console.log('ADMIN 서브타이틀 교체: OK');
} else { console.log('ADMIN 서브타이틀 마커 없음'); }

// ── 2. 주간 근태 컨테이너 패딩 축소 ──
const oldStatsCard = 'class="bg-white rounded-[50px] p-6 sm:p-10 shadow-2xl border-4 border-slate-100 mt-12 w-full overflow-hidden"';
const newStatsCard = 'class="bg-white rounded-[20px] p-4 sm:p-6 shadow-xl border-2 border-slate-100 mt-4 w-full overflow-hidden"';
if (c.includes(oldStatsCard)) {
    c = c.replace(oldStatsCard, newStatsCard);
    console.log('주간 근태 카드 교체: OK');
} else { console.log('주간 근태 카드 마커 없음'); }

// ── 3. 주간 근태 제목 폰트 축소 ──
const oldStatsTitle = 'class="text-2xl font-black text-slate-900 mb-2 italic">주간 근태 및 인력풀 모니터링</h3>';
const newStatsTitle = 'class="text-base font-black text-slate-900 mb-1 italic">주간 근태 · 인력풀 모니터링</h3>';
if (c.includes(oldStatsTitle)) {
    c = c.replace(oldStatsTitle, newStatsTitle);
    console.log('주간 근태 제목 교체: OK');
} else { console.log('주간 근태 제목 마커 없음'); }

// ── 4. 주간 근태 설명 텍스트 축소 ──
const oldStatsDesc = 'class="text-sm font-bold text-slate-500 mb-8 border-b-2 border-slate-100 pb-4">';
const newStatsDesc = 'class="text-xs font-bold text-slate-400 mb-3 border-b border-slate-100 pb-2">';
if (c.includes(oldStatsDesc)) {
    c = c.replace(oldStatsDesc, newStatsDesc);
    console.log('주간 근태 설명 교체: OK');
} else { console.log('주간 근태 설명 마커 없음'); }

// ── 5. space-y-10 → space-y-4 (관리자 탭 전체 간격) ──
const oldViewMgr = '<div id="view-manager" class="hidden space-y-10 pb-20 w-full">';
const newViewMgr = '<div id="view-manager" class="hidden space-y-4 pb-20 w-full">';
if (c.includes(oldViewMgr)) {
    c = c.replace(oldViewMgr, newViewMgr);
    console.log('view-manager 간격 교체: OK');
} else { console.log('view-manager 마커 없음'); }

fs.writeFileSync(htmlPath, c, 'utf8');
console.log('관리자 UI 패치 완료');
