/**
 * 미소지기 관리 JS 함수 추가 - cgv-app.js cleanupOldTrades 다음에 삽입
 */
const fs = require('fs');
const path = require('path');
const appJsPath = path.join(__dirname, '..', 'public', 'cgv-app.js');
let c = fs.readFileSync(appJsPath, 'utf8');

const marker = '        function renderList() {';
const idx = c.indexOf(marker);
if (idx < 0) { console.log('마커 없음'); process.exit(1); }

const misoFunctions = `        // ── 미소지기 관리 ──
        var _misoAdminData = [];

        function toggleMisojigiPanel() {
            var panel = document.getElementById('miso-panel');
            var arrow = document.getElementById('miso-panel-arrow');
            if (!panel) return;
            var isHidden = panel.classList.contains('hidden');
            panel.classList.toggle('hidden', !isHidden);
            if (arrow) arrow.textContent = isHidden ? '▲' : '▼';
            if (isHidden && _misoAdminData.length === 0) loadMisojigiAdmin();
        }

        function loadMisojigiAdmin() {
            var el = document.getElementById('miso-admin-list');
            if (el) el.innerHTML = '<p class="text-slate-400 text-xs text-center py-4">불러오는 중...</p>';
            google.script.run
                .withSuccessHandler(function(list) {
                    _misoAdminData = list || [];
                    renderMisojigiAdmin(_misoAdminData);
                })
                .withFailureHandler(function(e) {
                    if (el) el.innerHTML = '<p class="text-red-500 text-xs text-center py-4">오류: ' + (e && e.message ? e.message : e) + '</p>';
                })
                .getAllMisojigiForAdmin();
        }

        function renderMisojigiAdmin(list) {
            var el = document.getElementById('miso-admin-list');
            if (!el) return;
            if (!list || list.length === 0) {
                el.innerHTML = '<p class="text-slate-400 text-xs text-center py-4">미소지기 없음</p>';
                return;
            }
            var html = '';
            list.forEach(function(m) {
                var posStr = Array.isArray(m.pos) ? m.pos.join(', ') : (m.pos || '없음');
                var activeClass = m.active ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100 opacity-60';
                var statusBadge = m.active
                    ? '<span class="text-green-600 font-black text-xs">● 활성</span>'
                    : '<span class="text-slate-400 font-black text-xs">● 비활성</span>';
                html += '<div class="rounded-2xl border-2 ' + activeClass + ' p-3 flex flex-col gap-2">' +
                    '<div class="flex items-center justify-between">' +
                        '<span class="font-black text-slate-800">' + m.name + '</span>' +
                        statusBadge +
                    '</div>' +
                    '<div class="text-xs text-slate-500 font-bold">포지션: <span class="text-slate-700">' + posStr + '</span></div>' +
                    '<div class="flex gap-1.5 flex-wrap">' +
                        '<button onclick="editMisojigiPos(\'' + m.name + '\', ' + JSON.stringify(Array.isArray(m.pos) ? m.pos : []) + ')" ' +
                            'class="text-xs font-black px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all">✏️ 포지션</button>' +
                        '<button onclick="resetMisojigiPin(\'' + m.name + '\')" ' +
                            'class="text-xs font-black px-3 py-1.5 rounded-xl bg-yellow-50 text-yellow-700 border border-yellow-200 hover:bg-yellow-100 transition-all">🔑 PIN 초기화</button>' +
                        '<button onclick="toggleMisojigiActive(\'' + m.name + '\', ' + m.active + ')" ' +
                            'class="text-xs font-black px-3 py-1.5 rounded-xl ' + (m.active ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100' : 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100') + ' transition-all">' +
                            (m.active ? '퇴사 처리' : '복직 처리') +
                        '</button>' +
                    '</div>' +
                '</div>';
            });
            el.innerHTML = html;
        }

        function showAddMisojigiForm() {
            var form = document.getElementById('miso-add-form');
            if (!form) return;
            form.classList.remove('hidden');
            var nameInput = document.getElementById('miso-add-name');
            if (nameInput) { nameInput.value = ''; nameInput.focus(); }
            ['매점','플로어','통합'].forEach(function(p) {
                var cb = document.getElementById('miso-pos-' + p);
                if (cb) cb.checked = false;
            });
            var h = document.getElementById('miso-add-hours');
            if (h) h.value = '5.5';
        }

        function submitAddMisojigi() {
            var name = (document.getElementById('miso-add-name') || {}).value || '';
            name = name.trim();
            if (!name) { alert('이름을 입력하세요.'); return; }
            var pos = ['매점','플로어','통합'].filter(function(p) {
                var cb = document.getElementById('miso-pos-' + p);
                return cb && cb.checked;
            });
            if (pos.length === 0) { alert('포지션을 하나 이상 선택하세요.'); return; }
            var hours = parseFloat((document.getElementById('miso-add-hours') || {}).value) || 5.5;
            if (!confirm(name + ' 미소지기를 추가합니다.\n포지션: ' + pos.join(', ') + '\n근무시간: ' + hours + '시간\n\n계속하시겠습니까?')) return;
            google.script.run
                .withSuccessHandler(function() {
                    alert(name + ' 추가 완료!');
                    document.getElementById('miso-add-form').classList.add('hidden');
                    loadMisojigiAdmin();
                    sessionStorage.removeItem('cgv_miso');
                })
                .withFailureHandler(function(e) { alert('오류: ' + (e && e.message ? e.message : e)); })
                .addMisojigi(name, pos, hours);
        }

        function editMisojigiPos(name, currentPos) {
            var posOptions = ['매점', '플로어', '통합'];
            var currentStr = Array.isArray(currentPos) ? currentPos.join(', ') : currentPos;
            var input = prompt(name + ' 포지션 수정\n\n사용 가능 포지션: 매점, 플로어, 통합\n현재: ' + (currentStr || '없음') + '\n\n변경할 포지션을 콤마로 입력:\n(예: 매점, 통합)', currentStr || '');
            if (input === null) return;
            var newPos = input.split(',').map(function(p) { return p.trim(); }).filter(function(p) { return posOptions.indexOf(p) >= 0; });
            if (newPos.length === 0) { alert('유효한 포지션이 없습니다.\n(매점, 플로어, 통합 중 선택)'); return; }
            google.script.run
                .withSuccessHandler(function() {
                    alert(name + ' 포지션 변경 완료!');
                    loadMisojigiAdmin();
                    sessionStorage.removeItem('cgv_miso');
                })
                .withFailureHandler(function(e) { alert('오류: ' + (e && e.message ? e.message : e)); })
                .updateMisojigi(name, { pos: newPos });
        }

        function resetMisojigiPin(name) {
            if (!confirm(name + ' PIN을 00000으로 초기화합니다.\n계속하시겠습니까?')) return;
            google.script.run
                .withSuccessHandler(function() { alert(name + ' PIN 초기화 완료 (00000)'); })
                .withFailureHandler(function(e) { alert('오류: ' + (e && e.message ? e.message : e)); })
                .updateMisojigi(name, { pin: '00000' });
        }

        function toggleMisojigiActive(name, isActive) {
            var msg = isActive
                ? name + ' 퇴사 처리합니다.\n로그인 목록에서 제거됩니다.\n계속하시겠습니까?'
                : name + ' 복직 처리합니다.\n로그인 목록에 다시 표시됩니다.\n계속하시겠습니까?';
            if (!confirm(msg)) return;
            if (isActive) {
                google.script.run
                    .withSuccessHandler(function() {
                        alert(name + ' 퇴사 처리 완료');
                        loadMisojigiAdmin();
                        sessionStorage.removeItem('cgv_miso');
                    })
                    .withFailureHandler(function(e) { alert('오류: ' + (e && e.message ? e.message : e)); })
                    .deactivateMisojigi(name);
            } else {
                google.script.run
                    .withSuccessHandler(function() {
                        alert(name + ' 복직 처리 완료');
                        loadMisojigiAdmin();
                        sessionStorage.removeItem('cgv_miso');
                    })
                    .withFailureHandler(function(e) { alert('오류: ' + (e && e.message ? e.message : e)); })
                    .updateMisojigi(name, { active: true });
            }
        }

`;

c = c.substring(0, idx) + misoFunctions + c.substring(idx);
fs.writeFileSync(appJsPath, c, 'utf8');
console.log('미소지기 관리 JS 추가: OK');
try { new Function(c); console.log('문법 OK'); } catch(e) { console.log('문법 에러:', e.message); }
