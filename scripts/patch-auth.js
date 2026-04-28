/**
 * cgv-app.js PIN 인증 시스템 패치 스크립트
 */
const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, '..', 'public', 'cgv-app.js');
let c = fs.readFileSync(appJsPath, 'utf8');

// ── 1. checkStaffAuth 블록 교체 ──
const startMarker = 'function checkStaffAuth()';
const endMarker = 'function showKakaoModal';
const startIdx = c.indexOf(startMarker);
const endIdx = c.indexOf(endMarker);

if (startIdx < 0 || endIdx < 0) {
  console.error('checkStaffAuth 또는 showKakaoModal 찾기 실패');
  process.exit(1);
}

const oldBlock = c.substring(startIdx, endIdx);
console.log('교체 블록 길이:', oldBlock.length);

const newBlock = `// ── 인증: 이름 그리드 빌드 ──
        function buildAuthNameGrid() {
            var grid = document.getElementById('auth-name-grid');
            if (!grid) return;
            if (!MISO_DATA.length) {
                grid.innerHTML = '<div class="col-span-3 text-center py-4 text-red-500 text-xs font-bold">로드 실패. 새로고침해주세요.</div>';
                return;
            }
            grid.innerHTML = MISO_DATA.map(function(m) {
                return '<button onclick="selectAuthName(\\'' + m.name + '\\')" class="p-3 rounded-2xl border-2 border-slate-200 font-black text-slate-700 text-sm bg-white active:bg-red-50 active:border-red-400 transition-all active:scale-95">' + m.name + '</button>';
            }).join('');
        }
        function loadMisoForAuth() {
            var cached = sessionStorage.getItem('cgv_miso');
            if (cached) {
                try { var p = JSON.parse(cached); if (p && p.length) { MISO_DATA = p; buildAuthNameGrid(); return; } } catch(e) {}
            }
            google.script.run
                .withSuccessHandler(function(list) {
                    if (list && list.length) { MISO_DATA = list; sessionStorage.setItem('cgv_miso', JSON.stringify(list)); }
                    buildAuthNameGrid();
                })
                .withFailureHandler(function() { buildAuthNameGrid(); })
                .getMisojigiFromDB();
        }
        function selectAuthName(name) {
            authSelectedName = name; authIsAdmin = false;
            showPinStep(name + ' 님', PIN_LENGTH_STAFF + '자리 PIN 입력');
        }
        function showAdminLogin() {
            authSelectedName = ''; authIsAdmin = true;
            showPinStep('관리자', PIN_LENGTH_ADMIN + '자리 PIN 입력');
        }
        function backToNameSelect() {
            document.getElementById('auth-step-2').classList.add('hidden');
            document.getElementById('auth-step-1').classList.remove('hidden');
            var i = document.getElementById('auth-pin-input'); if (i) i.value = '';
            renderPinBoxes('', PIN_LENGTH_STAFF);
        }
        function showPinStep(nameText, descText) {
            document.getElementById('auth-step-1').classList.add('hidden');
            document.getElementById('auth-step-2').classList.remove('hidden');
            document.getElementById('auth-pin-name').innerText = nameText;
            document.getElementById('auth-pin-desc').innerText = descText;
            var len = authIsAdmin ? PIN_LENGTH_ADMIN : PIN_LENGTH_STAFF;
            var i = document.getElementById('auth-pin-input');
            if (i) { i.value = ''; i.maxLength = len; }
            renderPinBoxes('', len);
            document.getElementById('auth-pin-error').innerText = '';
            buildNumpad('auth-numpad', len, 'numpadPress');
            setTimeout(function() { var inp = document.getElementById('auth-pin-input'); if (inp) inp.focus(); }, 100);
        }
        function onPinInput() {
            var i = document.getElementById('auth-pin-input');
            var len = authIsAdmin ? PIN_LENGTH_ADMIN : PIN_LENGTH_STAFF;
            var val = (i.value || '').replace(/\\D/g,'').substring(0, len);
            i.value = val; renderPinBoxes(val, len);
            if (val.length === len) submitPin();
        }
        function numpadPress(key) {
            var i = document.getElementById('auth-pin-input');
            var len = authIsAdmin ? PIN_LENGTH_ADMIN : PIN_LENGTH_STAFF;
            if (key === 'x') i.value = i.value.slice(0,-1);
            else if (i.value.length < len) i.value += key;
            renderPinBoxes(i.value, len);
            if (i.value.length === len) submitPin();
        }
        function renderPinBoxes(val, len) {
            var el = document.getElementById('auth-pin-boxes'); if (!el) return;
            el.innerHTML = '';
            for (var i=0; i<len; i++) {
                var f = i < val.length;
                el.innerHTML += '<div class="w-11 h-14 border-2 rounded-2xl flex items-center justify-center transition-all ' + (f?'border-slate-900 bg-slate-900':'border-slate-300 bg-slate-50') + '">' + (f?'<div class="w-3 h-3 bg-white rounded-full"></div>':'') + '</div>';
            }
        }
        function buildNumpad(containerId, pinLen, pressFunc) {
            var pad = document.getElementById(containerId); if (!pad) return;
            var keys = ['1','2','3','4','5','6','7','8','9','','0','x'];
            pad.innerHTML = keys.map(function(k) {
                if (!k) return '<div></div>';
                var label = k === 'x' ? '⌫' : k;
                return '<button onclick="'+pressFunc+'(\\''+k+'\\')" class="py-4 rounded-2xl font-black text-xl active:scale-95 transition-all ' + (k==='x'?'bg-slate-200 text-slate-600':'bg-slate-50 border-2 border-slate-200 text-slate-800') + '">' + label + '</button>';
            }).join('');
        }
        function submitPin() {
            var i = document.getElementById('auth-pin-input'); if (!i) return;
            var pin = (i.value||'').replace(/\\D/g,'');
            var len = authIsAdmin ? PIN_LENGTH_ADMIN : PIN_LENGTH_STAFF;
            if (pin.length < len) return;
            var pad = document.getElementById('auth-numpad'); if (pad) pad.style.pointerEvents = 'none';
            google.script.run
                .withSuccessHandler(function(r) {
                    if (pad) pad.style.pointerEvents = '';
                    if (!r || r.error) { showAuthError(r&&r.error?r.error:'인증 오류'); if(i) i.value=''; renderPinBoxes('',len); return; }
                    authSuccess(r);
                })
                .withFailureHandler(function(e) {
                    if (pad) pad.style.pointerEvents = '';
                    showAuthError(e&&e.message?e.message:'서버 오류');
                    if(i) i.value=''; renderPinBoxes('',len);
                })
                .checkPinAuth(authIsAdmin?'':authSelectedName, pin, authIsAdmin?'admin':'staff');
        }
        function authSuccess(r) {
            var ov = document.getElementById('auth-overlay');
            ov.style.opacity = '0';
            setTimeout(function(){ ov.style.display = 'none'; }, 400);
            sessionStorage.setItem('cgv_auth','true');
            if (r.role === 'admin') {
                isAdmin = true; sessionStorage.setItem('cgv_admin','true');
            } else {
                sessionStorage.setItem('cgv_currentUser', authSelectedName);
                selectUser(authSelectedName);
            }
            fetchData();
        }
        function showAuthError(msg) {
            var err = document.getElementById('auth-pin-error'); if (!err) return;
            err.innerText = msg;
            var boxes = document.getElementById('auth-pin-boxes');
            if (boxes) {
                [8,-8,4,0].forEach(function(x,idx){ setTimeout(function(){ boxes.style.transform='translateX('+x+'px)'; }, idx*80); });
            }
            setTimeout(function(){ err.innerText=''; }, 3000);
        }
        function showAdminPinModal() {
            var modal = document.getElementById('admin-pin-modal'); if (!modal) return;
            var i = document.getElementById('admin-modal-pin-input'); if (i) i.value = '';
            renderAdminModalBoxes('');
            document.getElementById('admin-modal-pin-error').innerText = '';
            buildNumpad('admin-modal-numpad', PIN_LENGTH_ADMIN, 'adminModalNumpad');
            modal.classList.remove('hidden');
            setTimeout(function(){ var inp = document.getElementById('admin-modal-pin-input'); if(inp) inp.focus(); }, 100);
        }
        function closeAdminPinModal() {
            var modal = document.getElementById('admin-pin-modal'); if (modal) modal.classList.add('hidden');
            pendingAdminTab = false;
        }
        function renderAdminModalBoxes(val) {
            var el = document.getElementById('admin-modal-pin-boxes'); if (!el) return;
            el.innerHTML = '';
            for (var i=0; i<PIN_LENGTH_ADMIN; i++) {
                var f = i < val.length;
                el.innerHTML += '<div class="w-11 h-14 border-2 rounded-2xl flex items-center justify-center transition-all ' + (f?'border-slate-900 bg-slate-900':'border-slate-300 bg-slate-50') + '">' + (f?'<div class="w-3 h-3 bg-white rounded-full"></div>':'') + '</div>';
            }
        }
        function onAdminModalPinInput() {
            var i = document.getElementById('admin-modal-pin-input');
            var val = (i.value||'').replace(/\\D/g,'').substring(0,PIN_LENGTH_ADMIN);
            i.value = val; renderAdminModalBoxes(val);
            if (val.length === PIN_LENGTH_ADMIN) submitAdminModalPin();
        }
        function adminModalNumpad(key) {
            var i = document.getElementById('admin-modal-pin-input');
            if (key==='x') i.value = i.value.slice(0,-1);
            else if (i.value.length < PIN_LENGTH_ADMIN) i.value += key;
            renderAdminModalBoxes(i.value);
            if (i.value.length === PIN_LENGTH_ADMIN) submitAdminModalPin();
        }
        function submitAdminModalPin() {
            var i = document.getElementById('admin-modal-pin-input'); if (!i) return;
            var pin = (i.value||'').replace(/\\D/g,'');
            if (pin.length < PIN_LENGTH_ADMIN) return;
            var pad = document.getElementById('admin-modal-numpad'); if (pad) pad.style.pointerEvents = 'none';
            google.script.run
                .withSuccessHandler(function(r) {
                    if (pad) pad.style.pointerEvents = '';
                    if (!r||r.error) {
                        var err = document.getElementById('admin-modal-pin-error');
                        if (err) { err.innerText = r&&r.error?r.error:'PIN 오류'; setTimeout(function(){err.innerText='';},3000); }
                        if(i) i.value=''; renderAdminModalBoxes(''); return;
                    }
                    isAdmin = true; sessionStorage.setItem('cgv_admin','true');
                    closeAdminPinModal();
                    if (pendingAdminTab) { pendingAdminTab=false; switchTab('manager'); }
                })
                .withFailureHandler(function(e) {
                    if (pad) pad.style.pointerEvents = '';
                    var err = document.getElementById('admin-modal-pin-error');
                    if (err) { err.innerText = e&&e.message?e.message:'오류'; setTimeout(function(){err.innerText='';},3000); }
                    if(i) i.value=''; renderAdminModalBoxes('');
                })
                .checkPinAuth('', pin, 'admin');
        }

        `;

c = c.substring(0, startIdx) + newBlock + c.substring(endIdx);
fs.writeFileSync(appJsPath, c, 'utf8');
console.log('완료!');
console.log('buildAuthNameGrid:', c.indexOf('buildAuthNameGrid') > -1 ? 'OK' : 'FAIL');
console.log('submitPin:', c.indexOf('submitPin') > -1 ? 'OK' : 'FAIL');
console.log('showAdminPinModal:', c.indexOf('showAdminPinModal') > -1 ? 'OK' : 'FAIL');
