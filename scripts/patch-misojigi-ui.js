/**
 * 미소지기 관리 UI - cgv-body.html에 관리자 탭 섹션 추가
 */
const fs = require('fs');
const path = require('path');
const htmlPath = path.join(__dirname, '..', 'public', 'cgv-body.html');
let c = fs.readFileSync(htmlPath, 'utf8');

const marker = '            <div class="max-w-5xl mx-auto px-5">';
const idx = c.indexOf(marker);
if (idx < 0) { console.log('마커 없음'); process.exit(1); }

const misoSection = `            <div class="max-w-3xl mx-auto px-5 mt-2">
                <div class="bg-white rounded-[28px] shadow-xl border-2 border-slate-100 overflow-hidden">
                    <button onclick="toggleMisojigiPanel()" class="w-full flex items-center justify-between px-6 py-4 bg-slate-50 hover:bg-slate-100 transition-all">
                        <span class="font-black text-slate-800 text-base">👤 미소지기 관리</span>
                        <span id="miso-panel-arrow" class="text-slate-400 font-black text-lg">▼</span>
                    </button>
                    <div id="miso-panel" class="hidden px-5 pb-5">
                        <div class="pt-4 pb-2 flex gap-2 flex-wrap">
                            <button onclick="showAddMisojigiForm()" class="bg-slate-900 text-white text-xs font-black px-4 py-2 rounded-xl hover:bg-slate-700 transition-all">+ 미소지기 추가</button>
                            <button onclick="loadMisojigiAdmin()" class="bg-slate-100 text-slate-600 text-xs font-black px-4 py-2 rounded-xl hover:bg-slate-200 transition-all">↺ 새로고침</button>
                        </div>
                        <!-- 추가 폼 (기본 숨김) -->
                        <div id="miso-add-form" class="hidden bg-slate-50 rounded-2xl p-4 mb-4 space-y-3 border-2 border-slate-200">
                            <p class="font-black text-slate-700 text-sm">새 미소지기 추가</p>
                            <input id="miso-add-name" type="text" placeholder="이름" class="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-slate-400" />
                            <div class="flex gap-2 flex-wrap">
                                <label class="flex items-center gap-1 text-sm font-bold cursor-pointer"><input type="checkbox" id="miso-pos-매점" value="매점" class="accent-slate-700"> 매점</label>
                                <label class="flex items-center gap-1 text-sm font-bold cursor-pointer"><input type="checkbox" id="miso-pos-플로어" value="플로어" class="accent-slate-700"> 플로어</label>
                                <label class="flex items-center gap-1 text-sm font-bold cursor-pointer"><input type="checkbox" id="miso-pos-통합" value="통합" class="accent-slate-700"> 통합</label>
                            </div>
                            <div class="flex items-center gap-2">
                                <label class="text-xs font-bold text-slate-500">근무시간</label>
                                <input id="miso-add-hours" type="number" value="5.5" step="0.5" min="1" max="12" class="w-24 border-2 border-slate-200 rounded-xl px-3 py-1 text-sm font-bold outline-none focus:border-slate-400" />
                                <span class="text-xs text-slate-400">시간</span>
                            </div>
                            <div class="flex gap-2">
                                <button onclick="submitAddMisojigi()" class="flex-1 bg-slate-900 text-white text-sm font-black py-2 rounded-xl hover:bg-slate-700 transition-all">추가</button>
                                <button onclick="document.getElementById('miso-add-form').classList.add('hidden')" class="flex-1 bg-slate-100 text-slate-500 text-sm font-black py-2 rounded-xl hover:bg-slate-200 transition-all">취소</button>
                            </div>
                        </div>
                        <div id="miso-admin-list" class="space-y-2 text-sm">
                            <p class="text-slate-400 text-xs text-center py-4">▲ 새로고침을 눌러 불러오세요</p>
                        </div>
                    </div>
                </div>
            </div>
`;

c = c.substring(0, idx) + misoSection + c.substring(idx);
fs.writeFileSync(htmlPath, c, 'utf8');
console.log('미소지기 관리 HTML 추가: OK');
