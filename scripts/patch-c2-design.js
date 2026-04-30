/**
 * C-2 Light Glassmorphism 디자인 시스템 적용
 * - cgv.css: C-2 버튼·뱃지·카드 클래스 추가
 * - cgv-body.html: 정적 버튼 클래스 업데이트
 * - cgv-app.js: 동적 버튼 HTML 문자열 업데이트
 */
const fs = require('fs');
const path = require('path');

// ────────────────────────────────────────────────
// 1. cgv.css — C-2 디자인 시스템 CSS 추가
// ────────────────────────────────────────────────
const cssPath = path.join(__dirname, '..', 'public', 'cgv.css');
let css = fs.readFileSync(cssPath, 'utf8');

// :root 변수 업데이트 (C-2 팔레트)
const oldRoot = `:root {
            --cgv-red: #e71a0f;
            --cgv-orange: #FF6B00;
            --cgv-dark: #1e293b;
            --cgv-gray: #64748b;
            --cgv-light: #f8fafc;
        }`;
const newRoot = `:root {
            --cgv-red: #991b1b;
            --cgv-red-light: #fef2f2;
            --cgv-orange: #9a3412;
            --cgv-dark: #0f172a;
            --cgv-gray: #64748b;
            --cgv-light: #f8fafc;
            --cgv-blue: #1e40af;
            --cgv-green: #14532d;
        }`;

if (css.includes(oldRoot)) {
    css = css.replace(oldRoot, newRoot);
    console.log('1. :root 변수 업데이트: OK');
} else {
    console.log('1. :root 마커 없음 (스킵)');
}

// chip.selected 색상 C-2 로 변경
const oldChipSel = '.chip.selected { background-color: #e71a0f; color: white; border-color: #e71a0f; transform: translateY(-1.5px); box-shadow: 0 4px 10px rgba(231,26,15,0.25); }';
const newChipSel = '.chip.selected { background-color: #991b1b; color: white; border-color: #991b1b; transform: translateY(-1.5px); box-shadow: inset 0 1px 0 rgba(255,255,255,0.2), 0 4px 10px rgba(153,27,27,0.28); }';
if (css.includes(oldChipSel)) {
    css = css.replace(oldChipSel, newChipSel);
    console.log('2. chip.selected 색상: OK');
} else {
    console.log('2. chip.selected 마커 없음 (스킵)');
}

// tab-btn.active 색상 C-2 로 변경
const oldTabActive = '.tab-btn.active { background-color: #e71a0f; color: white; font-weight: 900; }';
const newTabActive = '.tab-btn.active { background-color: #991b1b; color: white; font-weight: 900; box-shadow: inset 0 1px 0 rgba(255,255,255,0.2), 0 2px 8px rgba(153,27,27,0.25); border-radius: 10px; }';
if (css.includes(oldTabActive)) {
    css = css.replace(oldTabActive, newTabActive);
    console.log('3. tab-btn.active 색상: OK');
} else {
    console.log('3. tab-btn.active 마커 없음 (스킵)');
}

// C-2 디자인 시스템 클래스 블록 추가 (파일 끝에)
const c2Block = `
/* ═══════════════════════════════════════════════
   C-2 Light Glassmorphism Design System v1.0
   CGV Dongducheon Staff App
═══════════════════════════════════════════════ */

/* Body background gradient */
body { background: linear-gradient(150deg, #f8fafc 0%, #f1f5f9 100%) !important; min-height: 100vh; }

/* ── Base button class ── */
.btn-c2 {
    display: inline-flex; align-items: center; justify-content: center;
    font-weight: 900; letter-spacing: -0.02em; cursor: pointer;
    transition: all 0.18s cubic-bezier(0.4,0,0.2,1);
}
.btn-c2:active { transform: scale(0.97) !important; }

/* Primary (Deep Red) */
.btn-c2-primary {
    background: #991b1b !important;
    color: #fff !important;
    border: 1px solid rgba(255,255,255,0.3) !important;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.25), 0 2px 12px rgba(153,27,27,0.28) !important;
}
.btn-c2-primary:hover { background: #7f1d1d !important; }
.btn-c2-primary:active { box-shadow: inset 0 1px 0 rgba(255,255,255,0.15), 0 1px 4px rgba(153,27,27,0.2) !important; }

/* Dark (Slate/Navy) */
.btn-c2-dark {
    background: #0f172a !important;
    color: #fff !important;
    border: 1px solid rgba(255,255,255,0.12) !important;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.12), 0 2px 10px rgba(15,23,42,0.22) !important;
}
.btn-c2-dark:hover { background: #1e293b !important; }

/* Ghost (White/Transparent) */
.btn-c2-ghost {
    background: rgba(255,255,255,0.85) !important;
    color: #334155 !important;
    border: 1.5px solid #e2e8f0 !important;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06) !important;
}
.btn-c2-ghost:hover { background: #fff !important; border-color: #cbd5e1 !important; }

/* Danger (Soft Red) */
.btn-c2-danger {
    background: rgba(255,241,242,0.9) !important;
    color: #991b1b !important;
    border: 1.5px solid #fecdd3 !important;
}
.btn-c2-danger:hover { background: #fff1f2 !important; }

/* Blue (Support/Action) */
.btn-c2-blue {
    background: #1e40af !important;
    color: #fff !important;
    border: 1px solid rgba(255,255,255,0.2) !important;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.2), 0 2px 12px rgba(30,64,175,0.28) !important;
}
.btn-c2-blue:hover { background: #1d3a9e !important; }

/* Green (Accept) */
.btn-c2-green {
    background: #166534 !important;
    color: #fff !important;
    border: 1px solid rgba(255,255,255,0.15) !important;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.15), 0 2px 10px rgba(22,101,52,0.28) !important;
}

/* Orange (Sub trade) */
.btn-c2-orange {
    background: #9a3412 !important;
    color: #fff !important;
    border: 1px solid rgba(255,255,255,0.2) !important;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.15), 0 2px 10px rgba(154,52,18,0.28) !important;
}

/* ── Status Badges (dot + text) ── */
.badge-c2-open  { background: #dcfce7; color: #15803d; border: 1.5px solid #86efac; }
.badge-c2-nego  { background: #dbeafe; color: #1d4ed8; border: 1.5px solid #93c5fd; }
.badge-c2-wait  { background: #fef9c3; color: #a16207; border: 1.5px solid #fde047; }
.badge-c2-done  { background: #f1f5f9; color: #475569; border: 1.5px solid #cbd5e1; }
.badge-c2-expired { background: #fef2f2; color: #b91c1c; border: 1.5px solid #fca5a5; }

/* ── Card glass effect ── */
.card-c2 {
    background: rgba(255,255,255,0.85);
    backdrop-filter: blur(8px);
    border: 1.5px solid rgba(226,232,240,0.8);
    border-radius: 24px;
}

/* ── Type toggle (맞교대/대타) active ── */
#type-swap-btn.active-type {
    background: #0f172a !important;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.12), 0 2px 8px rgba(15,23,42,0.2) !important;
}

/* ── Header accent ── */
header { background: rgba(255,255,255,0.92) !important; backdrop-filter: blur(12px) !important; border-bottom: 1.5px solid #e2e8f0 !important; }

/* ── Section top-border (공고 등록) ── */
.section-accent-top { border-top: 5px solid #991b1b !important; }

/* ── Filter chip active ── */
#filter-bar .filter-chip.active,
#flt-all.active { background: #0f172a !important; color: #fff !important; }
`;

if (!css.includes('C-2 Light Glassmorphism Design System')) {
    css = css + c2Block;
    console.log('4. C-2 디자인 시스템 CSS 블록 추가: OK');
} else {
    console.log('4. C-2 블록 이미 존재 (스킵)');
}

fs.writeFileSync(cssPath, css, 'utf8');
console.log('cgv.css 저장 완료');

// ────────────────────────────────────────────────
// 2. cgv-body.html — 정적 버튼 클래스 업데이트
// ────────────────────────────────────────────────
const bodyPath = path.join(__dirname, '..', 'public', 'cgv-body.html');
let body = fs.readFileSync(bodyPath, 'utf8');

// 공고 등록 하기 버튼
const oldSubmitBtn = 'class="w-full bg-slate-900 hover:bg-slate-800 text-white py-5 rounded-[28px] font-black text-xl shadow-xl active:scale-95 transition-all border-2 border-slate-800"';
const newSubmitBtn = 'class="w-full btn-c2 btn-c2-dark py-5 rounded-[28px] font-black text-xl active:scale-95 transition-all"';
if (body.includes(oldSubmitBtn)) {
    body = body.replace(oldSubmitBtn, newSubmitBtn);
    console.log('5. 공고 등록 하기 버튼: OK');
} else {
    console.log('5. 공고 등록 하기 버튼 마커 없음 (스킵)');
}

// 조건 확인 후 지원 버튼 (지원 모달)
const oldSupportBtn = 'class="w-full bg-blue-600 text-white py-6 rounded-[32px] font-black text-xl shadow-xl active:scale-95 transition-all border-2 border-blue-700"';
const newSupportBtn = 'class="w-full btn-c2 btn-c2-blue py-6 rounded-[32px] font-black text-xl active:scale-95 transition-all"';
if (body.includes(oldSupportBtn)) {
    body = body.replace(oldSupportBtn, newSupportBtn);
    console.log('6. 조건 확인 후 지원 버튼: OK');
} else {
    console.log('6. 조건 확인 후 지원 버튼 마커 없음 (스킵)');
}

// 관리자 로그인 버튼
const oldAdminLoginBtn = 'class="w-full py-3.5 text-slate-500 font-black text-sm border-2 border-slate-200 rounded-2xl bg-slate-50 active:scale-95 transition-all"';
const newAdminLoginBtn = 'class="w-full btn-c2 btn-c2-ghost py-3.5 rounded-2xl text-sm active:scale-95 transition-all"';
if (body.includes(oldAdminLoginBtn)) {
    body = body.replace(oldAdminLoginBtn, newAdminLoginBtn);
    console.log('7. 관리자 로그인 버튼: OK');
} else {
    console.log('7. 관리자 로그인 버튼 마커 없음 (스킵)');
}

// 맞교대 타입 버튼 (active state)
const oldSwapBtn = 'class="flex-1 py-4 rounded-[18px] font-black text-[15px] bg-slate-900 text-white shadow-md transition-all"';
const newSwapBtn = 'class="flex-1 py-4 rounded-[18px] font-black text-[15px] btn-c2 btn-c2-dark transition-all"';
if (body.includes(oldSwapBtn)) {
    body = body.replace(oldSwapBtn, newSwapBtn);
    console.log('8. 맞교대 버튼 (active): OK');
} else {
    console.log('8. 맞교대 버튼 마커 없음 (스킵)');
}

// 단순 대타 타입 버튼 (inactive)
const oldSubBtn = 'class="flex-1 py-4 rounded-[18px] font-black text-[15px] bg-white text-slate-500 hover:bg-slate-100 transition-all"';
const newSubBtn = 'class="flex-1 py-4 rounded-[18px] font-black text-[15px] btn-c2 btn-c2-ghost transition-all"';
if (body.includes(oldSubBtn)) {
    body = body.replace(oldSubBtn, newSubBtn);
    console.log('9. 단순 대타 버튼 (inactive): OK');
} else {
    console.log('9. 단순 대타 버튼 마커 없음 (스킵)');
}

// admin 패널 미소지기 추가 버튼
const oldMisoAddBtn = 'class="bg-slate-900 text-white text-xs font-black px-4 py-2 rounded-xl hover:bg-slate-700 transition-all"';
const newMisoAddBtn = 'class="btn-c2 btn-c2-dark text-xs font-black px-4 py-2 rounded-xl"';
if (body.includes(oldMisoAddBtn)) {
    body = body.replace(oldMisoAddBtn, newMisoAddBtn);
    console.log('10. 미소지기 추가 버튼: OK');
} else {
    console.log('10. 미소지기 추가 버튼 마커 없음 (스킵)');
}

// admin 패널 추가 폼 submit 버튼
const oldMisoSubmitBtn = 'class="flex-1 bg-slate-900 text-white text-sm font-black py-2 rounded-xl hover:bg-slate-700 transition-all"';
const newMisoSubmitBtn = 'class="flex-1 btn-c2 btn-c2-dark text-sm font-black py-2 rounded-xl"';
if (body.includes(oldMisoSubmitBtn)) {
    body = body.replace(oldMisoSubmitBtn, newMisoSubmitBtn);
    console.log('11. 미소지기 추가 폼 submit: OK');
} else {
    console.log('11. 미소지기 추가 폼 submit 마커 없음 (스킵)');
}

// 7일 만료 삭제 버튼
const oldCleanupBtn = 'class="w-full bg-slate-100 text-slate-500 py-4 rounded-2xl font-black border-2 border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all text-sm"';
const newCleanupBtn = 'class="w-full btn-c2 btn-c2-ghost py-4 rounded-2xl font-black text-sm hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all"';
if (body.includes(oldCleanupBtn)) {
    body = body.replace(oldCleanupBtn, newCleanupBtn);
    console.log('12. 7일 만료 삭제 버튼: OK');
} else {
    console.log('12. 7일 만료 삭제 버튼 마커 없음 (스킵)');
}

// 내 알림 테스트 버튼
const oldTestPushBtn = 'class="w-full bg-blue-50 text-blue-600 py-4 rounded-2xl font-black border-2 border-blue-200 hover:bg-blue-100 transition-all text-sm"';
const newTestPushBtn = 'class="w-full btn-c2 btn-c2-ghost py-4 rounded-2xl font-black text-sm text-blue-600 border-blue-200 hover:bg-blue-50 transition-all"';
if (body.includes(oldTestPushBtn)) {
    body = body.replace(oldTestPushBtn, newTestPushBtn);
    console.log('13. 내 알림 테스트 버튼: OK');
} else {
    console.log('13. 내 알림 테스트 버튼 마커 없음 (스킵)');
}

// 공고 등록 섹션 상단 테두리 클래스 추가
const oldSectionClass = 'class="bg-white rounded-[32px] p-5 card-shadow border-2 border-slate-100 border-t-[6px] border-t-red-600"';
const newSectionClass = 'class="bg-white rounded-[32px] p-5 card-shadow border-2 border-slate-100 section-accent-top"';
if (body.includes(oldSectionClass)) {
    body = body.replace(oldSectionClass, newSectionClass);
    console.log('14. 공고 등록 섹션 top border: OK');
} else {
    console.log('14. 공고 등록 섹션 마커 없음 (스킵)');
}

fs.writeFileSync(bodyPath, body, 'utf8');
console.log('cgv-body.html 저장 완료');

// ────────────────────────────────────────────────
// 3. cgv-app.js — 동적 버튼 HTML 문자열 업데이트
// ────────────────────────────────────────────────
const appPath = path.join(__dirname, '..', 'public', 'cgv-app.js');
let app = fs.readFileSync(appPath, 'utf8');

// 지원하기 버튼 (isSub 분기)
const oldSupportCardBtn = '"+(isSub?"bg-orange-500 hover:bg-orange-600":"bg-blue-600 hover:bg-blue-700")+" text-white py-4 rounded-2xl font-black transition-all shadow-md\'>지원하기</button>"';
const newSupportCardBtn = '"+(isSub?"btn-c2 btn-c2-orange":"btn-c2 btn-c2-blue")+" py-4 rounded-2xl font-black\'>지원하기</button>"';
if (app.includes(oldSupportCardBtn)) {
    app = app.replace(oldSupportCardBtn, newSupportCardBtn);
    console.log('15. 지원하기 버튼 (카드): OK');
} else {
    console.log('15. 지원하기 버튼 마커 없음 (스킵)');
}

// 수락 버튼
const oldAgreeBtn = "class='flex-1 bg-green-600 text-white py-4 rounded-2xl font-black shadow-md'>수락</button>";
const newAgreeBtn = "class='flex-1 btn-c2 btn-c2-green py-4 rounded-2xl font-black'>수락</button>";
if (app.includes(oldAgreeBtn)) {
    app = app.replace(oldAgreeBtn, newAgreeBtn);
    console.log('16. 수락 버튼: OK');
} else {
    console.log('16. 수락 버튼 마커 없음 (스킵)');
}

// 거절 버튼
const oldRejectBtn = "class='flex-1 bg-slate-800 text-white py-4 rounded-2xl font-black shadow-md'>거절</button>";
const newRejectBtn = "class='flex-1 btn-c2 btn-c2-ghost py-4 rounded-2xl font-black'>거절</button>";
if (app.includes(oldRejectBtn)) {
    app = app.replace(oldRejectBtn, newRejectBtn);
    console.log('17. 거절 버튼: OK');
} else {
    console.log('17. 거절 버튼 마커 없음 (스킵)');
}

// 관리자 최종 승인 버튼
const oldAdminApproveBtn = "class='flex-1 bg-slate-900 text-white py-5 rounded-2xl font-black shadow-md'>최종 승인</button>";
const newAdminApproveBtn = "class='flex-1 btn-c2 btn-c2-dark py-5 rounded-2xl font-black'>최종 승인</button>";
if (app.includes(oldAdminApproveBtn)) {
    app = app.replace(oldAdminApproveBtn, newAdminApproveBtn);
    console.log('18. 최종 승인 버튼: OK');
} else {
    console.log('18. 최종 승인 버튼 마커 없음 (스킵)');
}

// 관리자 반려 버튼
const oldAdminRejectBtn = "class='flex-1 bg-red-600 text-white py-5 rounded-2xl font-black shadow-md'>반려</button>";
const newAdminRejectBtn = "class='flex-1 btn-c2 btn-c2-primary py-5 rounded-2xl font-black'>반려</button>";
if (app.includes(oldAdminRejectBtn)) {
    app = app.replace(oldAdminRejectBtn, newAdminRejectBtn);
    console.log('19. 반려 버튼: OK');
} else {
    console.log('19. 반려 버튼 마커 없음 (스킵)');
}

// 관리자 공고 취소 버튼
const oldAdminCancelBtn = "class='w-full mt-2 bg-white text-slate-400 border border-slate-200 py-3 rounded-2xl font-black text-sm'>공고 취소 (관리자)</button>";
const newAdminCancelBtn = "class='w-full mt-2 btn-c2 btn-c2-ghost py-3 rounded-2xl font-black text-sm'>공고 취소 (관리자)</button>";
if (app.includes(oldAdminCancelBtn)) {
    app = app.replace(oldAdminCancelBtn, newAdminCancelBtn);
    console.log('20. 공고 취소(관리자) 버튼: OK');
} else {
    console.log('20. 공고 취소(관리자) 버튼 마커 없음 (스킵)');
}

// 소규모 취소 버튼 (카드 내 inline)
const oldSmallCancelBtn = "class='text-[11px] bg-white text-red-400 border border-red-200 px-3 py-1.5 rounded-lg active:scale-95 font-black shadow-sm'>취소</button>";
const newSmallCancelBtn = "class='text-[11px] btn-c2 btn-c2-danger px-3 py-1.5 rounded-lg active:scale-95 font-black'>취소</button>";
if (app.includes(oldSmallCancelBtn)) {
    app = app.replace(oldSmallCancelBtn, newSmallCancelBtn);
    console.log('21. 소규모 취소 버튼: OK');
} else {
    console.log('21. 소규모 취소 버튼 마커 없음 (스킵)');
}

// 관리자 삭제 버튼 (소규모, 실시간현황)
const oldAdminDeleteBtn = "class='text-[11px] bg-white text-slate-400 border border-slate-200 px-3 py-1.5 rounded-lg active:scale-95 font-black shadow-sm'>삭제</button>";
const newAdminDeleteBtn = "class='text-[11px] btn-c2 btn-c2-ghost px-3 py-1.5 rounded-lg active:scale-95 font-black'>삭제</button>";
if (app.includes(oldAdminDeleteBtn)) {
    app = app.replace(oldAdminDeleteBtn, newAdminDeleteBtn);
    console.log('22. 관리자 삭제 버튼: OK');
} else {
    console.log('22. 관리자 삭제 버튼 마커 없음 (스킵)');
}

// 인라인 취소 버튼 (모집중 카드 상단 소형)
const oldInlineCancelBtn = "class='ml-auto text-[10px] bg-white text-red-400 border border-red-200 px-2 py-0.5 rounded-md font-black'>취소</button>";
const newInlineCancelBtn = "class='ml-auto text-[10px] btn-c2 btn-c2-danger px-2 py-0.5 rounded-md font-black'>취소</button>";
if (app.includes(oldInlineCancelBtn)) {
    app = app.replace(oldInlineCancelBtn, newInlineCancelBtn);
    console.log('23. 인라인 취소 버튼: OK');
} else {
    console.log('23. 인라인 취소 버튼 마커 없음 (스킵)');
}

fs.writeFileSync(appPath, app, 'utf8');
console.log('\ncgv-app.js 저장 완료');

// 문법 검사
try { new Function(app); console.log('JS 문법 OK'); }
catch(e) { console.log('JS 문법 에러:', e.message); }

console.log('\n✅ C-2 디자인 시스템 패치 완료');
