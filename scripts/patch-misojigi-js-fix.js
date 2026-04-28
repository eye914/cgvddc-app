/**
 * 미소지기 관리 JS 함수 교체 (renderMisojigiAdmin data-attribute 방식으로 수정)
 */
const fs = require('fs');
const path = require('path');
const appJsPath = path.join(__dirname, '..', 'public', 'cgv-app.js');
let c = fs.readFileSync(appJsPath, 'utf8');

const startMarker = '        // ── 미소지기 관리 ──';
const endMarker = '        function renderList() {';
const si = c.indexOf(startMarker);
const ei = c.indexOf(endMarker);
if (si < 0 || ei < 0) { console.log('마커 없음:', si, ei); process.exit(1); }

const newBlock = '        // 미소지기 관리 ──\n' +
'        var _misoAdminData = [];\n' +
'\n' +
'        function toggleMisojigiPanel() {\n' +
'            var panel = document.getElementById(\'miso-panel\');\n' +
'            var arrow = document.getElementById(\'miso-panel-arrow\');\n' +
'            if (!panel) return;\n' +
'            var isHidden = panel.classList.contains(\'hidden\');\n' +
'            panel.classList.toggle(\'hidden\', !isHidden);\n' +
'            if (arrow) arrow.textContent = isHidden ? \'▲\' : \'▼\';\n' +
'            if (isHidden && _misoAdminData.length === 0) loadMisojigiAdmin();\n' +
'        }\n' +
'\n' +
'        function loadMisojigiAdmin() {\n' +
'            var el = document.getElementById(\'miso-admin-list\');\n' +
'            if (el) el.innerHTML = \'<p class="text-slate-400 text-xs text-center py-4">불러오는 중...</p>\';\n' +
'            google.script.run\n' +
'                .withSuccessHandler(function(list) {\n' +
'                    _misoAdminData = list || [];\n' +
'                    renderMisojigiAdmin(_misoAdminData);\n' +
'                })\n' +
'                .withFailureHandler(function(e) {\n' +
'                    if (el) el.innerHTML = \'<p class="text-red-500 text-xs text-center py-4">오류: \' + (e && e.message ? e.message : e) + \'</p>\';\n' +
'                })\n' +
'                .getAllMisojigiForAdmin();\n' +
'        }\n' +
'\n' +
'        function renderMisojigiAdmin(list) {\n' +
'            var el = document.getElementById(\'miso-admin-list\');\n' +
'            if (!el) return;\n' +
'            if (!list || list.length === 0) {\n' +
'                el.innerHTML = \'<p class="text-slate-400 text-xs text-center py-4">미소지기 없음</p>\';\n' +
'                return;\n' +
'            }\n' +
'            var html = \'\';\n' +
'            list.forEach(function(m) {\n' +
'                var posStr = Array.isArray(m.pos) ? m.pos.join(\', \') : (m.pos || \'없음\');\n' +
'                var posJson = JSON.stringify(Array.isArray(m.pos) ? m.pos : []);\n' +
'                var activeClass = m.active ? \'bg-white border-slate-200\' : \'bg-slate-50 border-slate-100 opacity-60\';\n' +
'                var statusBadge = m.active\n' +
'                    ? \'<span class="text-green-600 font-black text-xs">● 활성</span>\'\n' +
'                    : \'<span class="text-slate-400 font-black text-xs">● 비활성</span>\';\n' +
'                var toggleLabel = m.active ? \'퇴사 처리\' : \'복직 처리\';\n' +
'                var toggleClass = m.active\n' +
'                    ? \'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100\'\n' +
'                    : \'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100\';\n' +
'                html += \'<div class="rounded-2xl border-2 \' + activeClass + \' p-3 flex flex-col gap-2">\' +\n' +
'                    \'<div class="flex items-center justify-between">\' +\n' +
'                        \'<span class="font-black text-slate-800">\' + m.name + \'</span>\' +\n' +
'                        statusBadge +\n' +
'                    \'</div>\' +\n' +
'                    \'<div class="text-xs text-slate-500 font-bold">포지션: <span class="text-slate-700">\' + posStr + \'</span></div>\' +\n' +
'                    \'<div class="flex gap-1.5 flex-wrap">\' +\n' +
'                        \'<button data-miso-action="edit-pos" data-miso-name="\' + m.name + \'" data-miso-pos=\\\'\' + posJson + \'\\\' \' +\n' +
'                            \'class="text-xs font-black px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all">✏️ 포지션</button>\' +\n' +
'                        \'<button data-miso-action="reset-pin" data-miso-name="\' + m.name + \'" \' +\n' +
'                            \'class="text-xs font-black px-3 py-1.5 rounded-xl bg-yellow-50 text-yellow-700 border border-yellow-200 hover:bg-yellow-100 transition-all">🔑 PIN 초기화</button>\' +\n' +
'                        \'<button data-miso-action="toggle-active" data-miso-name="\' + m.name + \'" data-miso-active="\' + m.active + \'" \' +\n' +
'                            \'class="text-xs font-black px-3 py-1.5 rounded-xl \' + toggleClass + \' transition-all">\' + toggleLabel + \'</button>\' +\n' +
'                    \'</div>\' +\n' +
'                \'</div>\';\n' +
'            });\n' +
'            el.innerHTML = html;\n' +
'            // 이벤트 위임\n' +
'            el.querySelectorAll(\'[data-miso-action]\').forEach(function(btn) {\n' +
'                btn.addEventListener(\'click\', function() {\n' +
'                    var action = this.getAttribute(\'data-miso-action\');\n' +
'                    var name = this.getAttribute(\'data-miso-name\');\n' +
'                    if (action === \'edit-pos\') {\n' +
'                        var pos = JSON.parse(this.getAttribute(\'data-miso-pos\') || \'[]\');\n' +
'                        editMisojigiPos(name, pos);\n' +
'                    } else if (action === \'reset-pin\') {\n' +
'                        resetMisojigiPin(name);\n' +
'                    } else if (action === \'toggle-active\') {\n' +
'                        var active = this.getAttribute(\'data-miso-active\') === \'true\';\n' +
'                        toggleMisojigiActive(name, active);\n' +
'                    }\n' +
'                });\n' +
'            });\n' +
'        }\n' +
'\n' +
'        function showAddMisojigiForm() {\n' +
'            var form = document.getElementById(\'miso-add-form\');\n' +
'            if (!form) return;\n' +
'            form.classList.remove(\'hidden\');\n' +
'            var nameInput = document.getElementById(\'miso-add-name\');\n' +
'            if (nameInput) { nameInput.value = \'\'; nameInput.focus(); }\n' +
'            [\'매점\', \'플로어\', \'통합\'].forEach(function(p) {\n' +
'                var cb = document.getElementById(\'miso-pos-\' + p);\n' +
'                if (cb) cb.checked = false;\n' +
'            });\n' +
'            var h = document.getElementById(\'miso-add-hours\');\n' +
'            if (h) h.value = \'5.5\';\n' +
'        }\n' +
'\n' +
'        function submitAddMisojigi() {\n' +
'            var name = ((document.getElementById(\'miso-add-name\') || {}).value || \'\').trim();\n' +
'            if (!name) { alert(\'이름을 입력하세요.\'); return; }\n' +
'            var pos = [\'매점\', \'플로어\', \'통합\'].filter(function(p) {\n' +
'                var cb = document.getElementById(\'miso-pos-\' + p);\n' +
'                return cb && cb.checked;\n' +
'            });\n' +
'            if (pos.length === 0) { alert(\'포지션을 하나 이상 선택하세요.\'); return; }\n' +
'            var hours = parseFloat((document.getElementById(\'miso-add-hours\') || {}).value) || 5.5;\n' +
'            if (!confirm(name + \' 미소지기를 추가합니다.\\n포지션: \' + pos.join(\', \') + \'\\n근무시간: \' + hours + \'시간\\n\\n계속하시겠습니까?\')) return;\n' +
'            google.script.run\n' +
'                .withSuccessHandler(function() {\n' +
'                    alert(name + \' 추가 완료!\');\n' +
'                    document.getElementById(\'miso-add-form\').classList.add(\'hidden\');\n' +
'                    loadMisojigiAdmin();\n' +
'                    sessionStorage.removeItem(\'cgv_miso\');\n' +
'                })\n' +
'                .withFailureHandler(function(e) { alert(\'오류: \' + (e && e.message ? e.message : e)); })\n' +
'                .addMisojigi(name, pos, hours);\n' +
'        }\n' +
'\n' +
'        function editMisojigiPos(name, currentPos) {\n' +
'            var posOptions = [\'매점\', \'플로어\', \'통합\'];\n' +
'            var currentStr = Array.isArray(currentPos) ? currentPos.join(\', \') : currentPos;\n' +
'            var input = prompt(name + \' 포지션 수정\\n\\n사용 가능 포지션: 매점, 플로어, 통합\\n현재: \' + (currentStr || \'없음\') + \'\\n\\n변경할 포지션을 콤마로 입력:\\n(예: 매점, 통합)\', currentStr || \'\');\n' +
'            if (input === null) return;\n' +
'            var newPos = input.split(\',\').map(function(p) { return p.trim(); }).filter(function(p) { return posOptions.indexOf(p) >= 0; });\n' +
'            if (newPos.length === 0) { alert(\'유효한 포지션이 없습니다.\\n(매점, 플로어, 통합 중 선택)\'); return; }\n' +
'            google.script.run\n' +
'                .withSuccessHandler(function() {\n' +
'                    alert(name + \' 포지션 변경 완료!\');\n' +
'                    loadMisojigiAdmin();\n' +
'                    sessionStorage.removeItem(\'cgv_miso\');\n' +
'                })\n' +
'                .withFailureHandler(function(e) { alert(\'오류: \' + (e && e.message ? e.message : e)); })\n' +
'                .updateMisojigi(name, { pos: newPos });\n' +
'        }\n' +
'\n' +
'        function resetMisojigiPin(name) {\n' +
'            if (!confirm(name + \' PIN을 00000으로 초기화합니다.\\n계속하시겠습니까?\')) return;\n' +
'            google.script.run\n' +
'                .withSuccessHandler(function() { alert(name + \' PIN 초기화 완료 (00000)\'); })\n' +
'                .withFailureHandler(function(e) { alert(\'오류: \' + (e && e.message ? e.message : e)); })\n' +
'                .updateMisojigi(name, { pin: \'00000\' });\n' +
'        }\n' +
'\n' +
'        function toggleMisojigiActive(name, isActive) {\n' +
'            var msg = isActive\n' +
'                ? name + \' 퇴사 처리합니다.\\n로그인 목록에서 제거됩니다.\\n계속하시겠습니까?\'\n' +
'                : name + \' 복직 처리합니다.\\n로그인 목록에 다시 표시됩니다.\\n계속하시겠습니까?\';\n' +
'            if (!confirm(msg)) return;\n' +
'            if (isActive) {\n' +
'                google.script.run\n' +
'                    .withSuccessHandler(function() {\n' +
'                        alert(name + \' 퇴사 처리 완료\');\n' +
'                        loadMisojigiAdmin();\n' +
'                        sessionStorage.removeItem(\'cgv_miso\');\n' +
'                    })\n' +
'                    .withFailureHandler(function(e) { alert(\'오류: \' + (e && e.message ? e.message : e)); })\n' +
'                    .deactivateMisojigi(name);\n' +
'            } else {\n' +
'                google.script.run\n' +
'                    .withSuccessHandler(function() {\n' +
'                        alert(name + \' 복직 처리 완료\');\n' +
'                        loadMisojigiAdmin();\n' +
'                        sessionStorage.removeItem(\'cgv_miso\');\n' +
'                    })\n' +
'                    .withFailureHandler(function(e) { alert(\'오류: \' + (e && e.message ? e.message : e)); })\n' +
'                    .updateMisojigi(name, { active: true });\n' +
'            }\n' +
'        }\n' +
'\n' +
'        ';

c = c.substring(0, si) + newBlock + c.substring(ei);
fs.writeFileSync(appJsPath, c, 'utf8');
console.log('미소지기 JS 교체: OK');
try { new Function(c); console.log('문법 OK'); } catch(e) { console.log('문법 에러:', e.message); }
