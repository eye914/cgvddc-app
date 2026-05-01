/**
 * C-2 시각적으로 눈에 띄는 변화 강화
 * 1. "공고 등록 하기" 버튼 → 레드(primary)로 변경
 * 2. cgv.css 배경 그라디언트 강화 + 카드 글래스 효과 + 헤더 하단 레드라인
 */
const fs = require('fs');
const path = require('path');

// ── 1. cgv-body.html: 공고 등록 버튼 dark → primary ──
const bodyPath = path.join(__dirname, '..', 'public', 'cgv-body.html');
let body = fs.readFileSync(bodyPath, 'utf8');

const oldSubmit = 'class="w-full btn-c2 btn-c2-dark py-5 rounded-[28px] font-black text-xl active:scale-95 transition-all"';
const newSubmit = 'class="w-full btn-c2 btn-c2-primary py-5 rounded-[28px] font-black text-xl active:scale-95 transition-all"';
if (body.includes(oldSubmit)) {
    body = body.replace(oldSubmit, newSubmit);
    console.log('1. 공고 등록 버튼 → 레드: OK');
} else { console.log('1. 마커 없음 (스킵)'); }

fs.writeFileSync(bodyPath, body, 'utf8');

// ── 2. cgv.css: 시각 강화 스타일 추가 ──
const cssPath = path.join(__dirname, '..', 'public', 'cgv.css');
let css = fs.readFileSync(cssPath, 'utf8');

// 기존 body 배경 그라디언트 강화
const oldBg = 'body { background: linear-gradient(150deg, #f8fafc 0%, #f1f5f9 100%) !important; min-height: 100vh; }';
const newBg = 'body { background: linear-gradient(160deg, #f0f4ff 0%, #faf5f5 50%, #f0f4f8 100%) !important; min-height: 100vh; }';
if (css.includes(oldBg)) {
    css = css.replace(oldBg, newBg);
    console.log('2. 배경 그라디언트 강화: OK');
} else { console.log('2. 배경 마커 없음 (스킵)'); }

// 헤더 override 강화 (하단 레드 라인 3px)
const oldHeader = '/* ── Header accent ── */\nheader { background: rgba(255,255,255,0.92) !important; backdrop-filter: blur(12px) !important; border-bottom: 1.5px solid #e2e8f0 !important; }';
const newHeader = '/* ── Header accent ── */\nheader { background: rgba(255,255,255,0.96) !important; backdrop-filter: blur(16px) !important; border-bottom: 3px solid #991b1b !important; box-shadow: 0 2px 16px rgba(153,27,27,0.08) !important; }';
if (css.includes(oldHeader)) {
    css = css.replace(oldHeader, newHeader);
    console.log('3. 헤더 레드 하단 라인: OK');
} else { console.log('3. 헤더 마커 없음 (스킵)'); }

// 카드 글래스 효과 추가 (section.card-shadow 모두 적용)
const glassBlock = `
/* ── C-2 카드 글래스 & 섀도우 강화 ── */
.card-shadow {
    background: rgba(255,255,255,0.92) !important;
    border: 1.5px solid rgba(226,232,240,0.85) !important;
    box-shadow: 0 4px 24px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.04) !important;
    backdrop-filter: blur(8px) !important;
}

/* ── 공고 등록 섹션 상단 레드 라인 ── */
.section-accent-top {
    border-top: 5px solid #991b1b !important;
    background: rgba(255,255,255,0.95) !important;
}

/* ── 필터 바 chip active (레드→네이비) ── */
.filter-chip { transition: all 0.18s !important; }
#flt-all { background: #0f172a !important; color: #fff !important; }

/* ── 탭 버튼 pill 모양 강화 ── */
.tab-btn { border-radius: 10px !important; }
.tab-btn.active {
    background: #991b1b !important;
    color: #fff !important;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.2), 0 2px 8px rgba(153,27,27,0.3) !important;
}
`;

if (!css.includes('C-2 카드 글래스 & 섀도우 강화')) {
    css = css + glassBlock;
    console.log('4. 카드 글래스 + 탭 강화 CSS 추가: OK');
} else { console.log('4. 이미 존재 (스킵)'); }

fs.writeFileSync(cssPath, css, 'utf8');

console.log('\n패치 완료');
