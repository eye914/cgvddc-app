

        var KAKAO_URL = "https://open.kakao.com/o/gGsMiRli";
        var DEPLOY_URL = "https://tinyurl.com/y7enzns9";
        var KAKAO_DEEPLINK = "kakaotalk://open/chat/gGsMiRli";
        // ── PIN 인증 설정 ──
        var PIN_LENGTH_STAFF = 5;
        var PIN_LENGTH_ADMIN = 5;
        var authSelectedName = "";
        var authIsAdmin = false;
        var pendingAdminTab = false;
        var MISO_DATA = []; // 앱 로드 시 미소지기DB에서 동적으로 채움
        var FULL_HOUR_NAMES = []; // 5.5h 미소지기 이름 목록
        var MALE_NAMES = ["\uae40\ud55c\uc194","\uc2e0\uc7ac\uc6a9","\uc870\ub3d9\uc6b0","\uc815\ud0dc\ubbfc","\uc190\uc815\ud604"];
        var currentFilter = "all"; // all / mine / open / nego / wait

        function getGenderEmoji(name) {
            return MALE_NAMES.indexOf(name) > -1 ? "\uD83D\uDE4B\u200D\u2642\uFE0F" : "\uD83D\uDE4B\u200D\u2640\uFE0F";
        }

        function setFilter(f) {
            currentFilter = f;
            var ids = ["flt-all","flt-mine","flt-open","flt-nego","flt-wait"];
            ids.forEach(function(id){
                var btn = document.getElementById(id);
                if (!btn) return;
                btn.className = "filter-chip flex-shrink-0 px-4 py-2 rounded-full text-[12px] font-black shadow-sm " +
                    (id === "flt-"+f.replace("all","all").replace("mine","mine").replace("open","open").replace("nego","nego").replace("wait","wait")
                     ? "bg-slate-900 text-white" : "bg-white text-slate-500 border border-slate-200");
            });
            var activeId = "flt-"+f;
            var activeBtn = document.getElementById(activeId);
            if (activeBtn) activeBtn.className = "filter-chip flex-shrink-0 px-4 py-2 rounded-full text-[12px] font-black shadow-sm bg-slate-900 text-white";
            renderList();
        }
        var SHIFT_CODES = {
            "D": [{code:"D1",time:"09:00-14:30(13:30)"},{code:"D2",time:"09:30-15:00(14:00)"},{code:"D3",time:"10:00-15:30(14:30)"},{code:"D4",time:"10:30-16:00(15:00)"}],
            "M": [{code:"M1",time:"11:30-17:00(16:00)"},{code:"M2",time:"12:30-18:00(17:00)"},{code:"M3",time:"13:00-18:30(17:30)"},{code:"M4",time:"13:30-19:00(18:00)"},{code:"M5",time:"14:00-19:30(18:30)"},{code:"M6",time:"14:30-20:00(19:00)"},{code:"M7",time:"15:30-21:00(20:00)"},{code:"M8",time:"16:30-22:00(21:00)"}],
            "N": [{code:"N1",time:"18:00(19:00)-23:30"},{code:"N2",time:"19:00(20:00)-24:30"}]
        };

        // 시간 표시 파싱: "09:00-14:30(13:30)" → {main:"09:00-14:30", sub:"4.5h:13:30"}
        //                 "18:00(19:00)-23:30"  → {main:"18:00-23:30",  sub:"4.5h:19:00↑"}
        function parseTimeDisplay(timeStr) {
            var main, sub;
            if (timeStr.indexOf("(") === -1) {
                return { main: timeStr, sub: "" };
            }
            // N타입: "18:00(19:00)-23:30"
            var nMatch = timeStr.match(/^(\d{2}:\d{2})\((\d{2}:\d{2})\)-(.+)$/);
            if (nMatch) {
                main = nMatch[1]+"-"+nMatch[3];
                sub = "4.5h ↑"+nMatch[2];
                return { main: main, sub: sub };
            }
            // D/M타입: "09:00-14:30(13:30)"
            var dmMatch = timeStr.match(/^(.+)\((\d{2}:\d{2})\)$/);
            if (dmMatch) {
                main = dmMatch[1];
                sub = "4.5h ↓"+dmMatch[2];
                return { main: main, sub: sub };
            }
            return { main: timeStr, sub: "" };
        }

        var DAYS = ["\uC77C","\uC6D4","\uD654","\uC218","\uBAA9","\uAE08","\uD1A0"];
        var trades = [];
        var isAdmin = false;
        var selectedTradeId = null;
        var currentUser = "";
        var currentUserPos = [];
        var attendanceData = {};
        var currentStatsDate = new Date();
        var wishData = {};
        var currentSupportOptions = [];
        var kakaoOpened = false;
        var pendingShareText = "";

        function getLocalYYYYMMDD(d) {
            var y = d.getFullYear();
            var m = String(d.getMonth()+1).padStart(2,"0");
            var dd = String(d.getDate()).padStart(2,"0");
            return y+"-"+m+"-"+dd;
        }

        // ── 인증: 이름 그리드 빌드 ──
        function buildAuthNameGrid() {
            var grid = document.getElementById('auth-name-grid');
            if (!grid) return;
            if (!MISO_DATA.length) {
                grid.innerHTML = '<div class="col-span-3 text-center py-4 text-red-500 text-xs font-bold">로드 실패. 새로고침해주세요.</div>';
                return;
            }
            grid.innerHTML = MISO_DATA.map(function(m) {
                return '<button onclick="selectAuthName(\'' + m.name + '\')" class="p-3 rounded-2xl border-2 border-slate-200 font-black text-slate-700 text-sm bg-white active:bg-red-50 active:border-red-400 transition-all active:scale-95">' + m.name + '</button>';
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
            var val = (i.value || '').replace(/\D/g,'').substring(0, len);
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
                return '<button onclick="'+pressFunc+'(\''+k+'\')" class="py-4 rounded-2xl font-black text-xl active:scale-95 transition-all ' + (k==='x'?'bg-slate-200 text-slate-600':'bg-slate-50 border-2 border-slate-200 text-slate-800') + '">' + label + '</button>';
            }).join('');
        }
        function submitPin() {
            var i = document.getElementById('auth-pin-input'); if (!i) return;
            var pin = (i.value||'').replace(/\D/g,'');
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
                isAdmin = true;
                sessionStorage.setItem('cgv_admin','true');
                sessionStorage.setItem('cgv_admin_name', r.name || '관리자');
            } else {
                sessionStorage.setItem('cgv_currentUser', authSelectedName);
                sessionStorage.setItem('cgv_locked_user', authSelectedName); // PIN 로그인 이름 고정
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
            var val = (i.value||'').replace(/\D/g,'').substring(0,PIN_LENGTH_ADMIN);
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
            var pin = (i.value||'').replace(/\D/g,'');
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

        function showKakaoModal(text, forced) {
            pendingShareText = text;
            kakaoOpened = false;
            var ta = document.getElementById("kakao-copy-textarea");
            if (ta) ta.value = text;
            var isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
            var hint = document.getElementById("kakao-copy-hint");
            if (hint) hint.style.display = isMobile ? "none" : "block";
            var btn = document.getElementById("kakao-done-btn");
            btn.disabled = true;
            btn.className = "w-full bg-slate-100 text-slate-400 py-4 rounded-2xl font-black text-sm border-2 border-slate-200 cursor-not-allowed";
            btn.innerText = "\uACF5\uC720 \uC644\uB8CC\uD588\uC5B4\uC694 (\uCE74\uD1A1\uBC29 \uC5F4\uAE30 \uD6C4 \uD65C\uC131\uD654)";
            // 강제 공유(지원 완료)면 X 버튼 숨김
            var xBtn = document.getElementById("kakao-close-btn");
            if (xBtn) xBtn.style.display = forced ? "none" : "block";
            var forceMsg = document.getElementById("kakao-force-msg");
            if (forceMsg) forceMsg.style.display = forced ? "block" : "none";
            silentCopy(text);
            document.getElementById("kakao-modal").style.display = "flex";
        }

        function doKakaoOpen() {
            silentCopy(pendingShareText);
            var ta = document.getElementById("kakao-copy-textarea");
            if (ta) { ta.select(); ta.setSelectionRange(0, 99999); }
            var isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
            if (isMobile) {
                window.location.href = KAKAO_DEEPLINK;
                setTimeout(function(){ window.open(KAKAO_URL, "_blank"); }, 600);
            } else {
                window.open(KAKAO_URL, "_blank");
            }
            kakaoOpened = true;
            var btn = document.getElementById("kakao-done-btn");
            btn.disabled = false;
            btn.className = "w-full bg-green-500 text-white py-4 rounded-2xl font-black text-sm border-2 border-green-600 active:scale-95 hover:bg-green-600";
            btn.innerText = "\uACF5\uC720 \uC644\uB8CC\uD588\uC5B4\uC694";
        }

        function closeKakaoModal() {
            if (!kakaoOpened) return;
            document.getElementById("kakao-modal").style.display = "none";
        }

        function silentCopy(text) {
            try {
                if (navigator.clipboard && window.isSecureContext) {
                    navigator.clipboard.writeText(text).catch(function(){ legacyCopy(text); });
                } else { legacyCopy(text); }
            } catch(e) { legacyCopy(text); }
        }

        function legacyCopy(text) {
            var ta = document.createElement("textarea");
            ta.value = text;
            ta.style.position = "fixed"; ta.style.left = "-9999px";
            document.body.appendChild(ta); ta.select();
            try { document.execCommand("copy"); } catch(e) {}
            document.body.removeChild(ta);
        }

        window.copyToClipboard = function(text) {
            if (!currentUser) { alert("\uC774\uB984\uC744 \uBA3C\uC800 \uC120\uD0DD\uD574 \uC8FC\uC138\uC694!"); return; }
            silentCopy(text);
            var isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
            if (isMobile) {
                window.location.href = KAKAO_DEEPLINK;
                setTimeout(function(){ window.open(KAKAO_URL,"_blank"); }, 600);
            } else {
                window.open(KAKAO_URL,"_blank");
            }
            setTimeout(function(){ alert("\uBCF5\uC0AC \uC644\uB8CC! \uCE74\uD1A1\uBC29\uC5D0 \uBD99\uC5EC\uB123\uAE30 \uD574\uC8FC\uC138\uC694."); }, 700);
        };

        // 관리자 전용 - 이름 선택 불필요
        window.adminCopyToClipboard = function(text) {
            silentCopy(text);
            var isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
            if (isMobile) {
                window.location.href = KAKAO_DEEPLINK;
                setTimeout(function(){ window.open(KAKAO_URL,"_blank"); }, 600);
            } else {
                window.open(KAKAO_URL,"_blank");
            }
            setTimeout(function(){ alert("\uBCF5\uC0AC \uC644\uB8CC! \uCE74\uD1A1\uBC29\uC5D0 \uBD99\uC5EC\uB123\uAE30 \uD574\uC8FC\uC138\uC694."); }, 700);
        };
        function updateHeaderDatetime() {
            var el = document.getElementById("header-datetime");
            if (!el) return;
            var now = new Date();
            var days = ["\uc77c","\uc6d4","\ud654","\uc218","\ubaa9","\uae08","\ud1a0"];
            var mm = String(now.getMonth()+1).padStart(2,"0");
            var dd = String(now.getDate()).padStart(2,"0");
            var day = days[now.getDay()];
            var hh = String(now.getHours()).padStart(2,"0");
            var mi = String(now.getMinutes()).padStart(2,"0");
            el.innerText = mm+"/"+dd+"("+day+") "+hh+":"+mi;
        }

        window.onload = function() {
            updateHeaderDatetime();
            setInterval(updateHeaderDatetime, 60000);
            var now = new Date();
            var tmr = new Date(now); tmr.setDate(now.getDate()+1);
            var ri = document.getElementById("req-date-input");
            if (ri) ri.min = getLocalYYYYMMDD(tmr);
            // GAS 환경이 아닌 경우(미리보기/로컬) 자동 인증 처리
            // 이미 인증된 세션이면 바로 진입
            if (sessionStorage.getItem("cgv_auth") === "true") {
                document.getElementById("auth-overlay").style.display = "none";
                if (sessionStorage.getItem("cgv_admin") === "true") isAdmin = true;
                var saved = sessionStorage.getItem("cgv_currentUser");
                if (saved) selectUser(saved);
                fetchData();
            } else {
                // 미소지기 목록 먼저 로드 후 이름 그리드 표시
                loadMisoForAuth();
            }
            // Pull-to-refresh
            var ptrStart = 0; var ptrActive = false;
            document.addEventListener("touchstart", function(e){ ptrStart = e.touches[0].clientY; }, {passive:true});
            document.addEventListener("touchend", function(e){
                var dist = e.changedTouches[0].clientY - ptrStart;
                if (dist > 80 && window.scrollY === 0 && !ptrActive) {
                    ptrActive = true;
                    sessionStorage.removeItem("cgv_miso");
                    fetchData();
                    setTimeout(function(){ ptrActive = false; }, 2000);
                }
            }, {passive:true});
        };

        function showLoader(show, msg) {
            msg = msg || "Syncing...";
            var l = document.getElementById("loader");
            var m = document.getElementById("loader-msg");
            if (l) { if (m) m.innerText = msg; l.style.display = show ? "flex" : "none"; }
        }

        function isTodayOrPast(dateStr) {
            if (!dateStr) return true;
            var now = new Date();
            var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            var clean = String(dateStr).split("(")[0].trim();
            var parts = clean.split("-");
            if (parts.length < 3) return true;
            var target = new Date(parts[0], parts[1]-1, parts[2]);
            if (isNaN(target.getTime())) return true;
            return target <= today;
        }

        // 교대 전날 22:00 이후부터 만료
        function isExpired(shiftDateStr) {
            if (!shiftDateStr) return false;
            var clean = String(shiftDateStr).split("(")[0].split("/")[0].trim();
            var parts = clean.split("-");
            if (parts.length < 3) return false;
            var shiftDay = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]), 0, 0, 0);
            if (isNaN(shiftDay.getTime())) return false;
            // 전날 23:00 = 교대일 00:00 - 1시간
            var expireAt = new Date(shiftDay.getTime() - 1 * 60 * 60 * 1000);
            return new Date() >= expireAt;
        }

        function getWeekKey(dateStr) {
            if (!dateStr) return "\uBBF8\uC815 \uC8FC\uAC04";
            var clean = String(dateStr).split("(")[0].trim();
            var d = new Date(clean);
            if (isNaN(d.getTime())) return "\uBBF8\uC815 \uC8FC\uAC04";
            var day = d.getDay();
            var diff = d.getDate() - day + (day === 0 ? -6 : 1);
            var mon = new Date(d.setDate(diff));
            var sun = new Date(mon); sun.setDate(mon.getDate()+6);
            return mon.getFullYear()+"\uB144 "+(mon.getMonth()+1)+"/"+mon.getDate()+"(\uC6D4) ~ "+(sun.getMonth()+1)+"/"+sun.getDate()+"(\uC77C) \uC8FC\uAC04";
        }

        function parseWeekStart(key) {
            var m = key.match(/(\d{4})[^\d]+(\d+)\/(\d+)/);
            if (!m) return new Date(0);
            return new Date(parseInt(m[1]), parseInt(m[2])-1, parseInt(m[3]));
        }

        function sortWeekKeys(keys) {
            var now = new Date(); now.setHours(0,0,0,0);
            var nowMs = now.getTime(); var wkMs = 7*24*60*60*1000;
            return keys.sort(function(a,b){
                var da = parseWeekStart(a).getTime(), db = parseWeekStart(b).getTime();
                var aC = da <= nowMs && nowMs < da+wkMs;
                var bC = db <= nowMs && nowMs < db+wkMs;
                if (aC && !bC) return -1;
                if (!aC && bC) return 1;
                var aF = da > nowMs, bF = db > nowMs;
                if (aF && !bF) return -1;
                if (!aF && bF) return 1;
                if (aF && bF) return da - db;
                return db - da;
            });
        }

        function buildUserGrid() {
            var container = document.getElementById("user-grid-container");
            if (!container) return;
            container.innerHTML = "";
            var cats = [
                {id:"\uD1B5\uD569", title:"\uD1B5\uD569"},
                {id:"\uB9E4\uC810", title:"\uB9E4\uC810"},
                {id:"\uB9E4\uC810\uB9C8\uAC10", title:"\uB9E4\uC810\uB9C8\uAC10"},
                {id:"\uD50C\uB85C\uC5B4", title:"\uD50C\uB85C\uC5B4"}
            ];
            cats.forEach(function(cat) {
                var members = MISO_DATA.filter(function(m){ return m.pos.indexOf(cat.id) > -1; })
                    .sort(function(a,b){ return a.name.localeCompare(b.name); });
                if (!members.length) return;
                var catDiv = document.createElement("div");
                catDiv.className = "mb-6";
                catDiv.innerHTML = "<p class='text-[14px] font-black text-slate-500 mb-3 border-b-2 border-slate-100 pb-2 uppercase'>"+cat.title+"</p>";
                var grid = document.createElement("div");
                grid.className = "grid grid-cols-3 gap-3";
                members.forEach(function(m) {
                    var btn = document.createElement("button");
                    var isFull = FULL_HOUR_NAMES.indexOf(m.name) > -1;
                    btn.className = "py-3.5 bg-white border-2 rounded-[16px] font-bold text-[15px] shadow-sm active:scale-95 " + (isFull ? "border-red-400 text-red-800" : "border-blue-300 text-blue-800");
                    btn.innerText = m.name;
                    btn.onclick = function(){ selectUser(m.name); };
                    grid.appendChild(btn);
                });
                catDiv.appendChild(grid);
                container.appendChild(catDiv);
            });
        }

        function openUserSelectModal(){
            // PIN 로그인 후 이름 변경 차단
            if (sessionStorage.getItem('cgv_locked_user')) {
                alert('PIN 로그인 후에는 본인 계정만 사용 가능합니다.');
                return;
            }
            // 미리보기/로컬 환경에서 MISO_DATA가 비어있으면 fallback 채움
            if (!MISO_DATA.length) {
                var defaults = [
                    {name:"\uAE40\uD55C\uC194",pos:["\uD1B5\uD569"],hours:"5.5"},
                    {name:"\uC2E0\uC7AC\uC6A9",pos:["\uD1B5\uD569"],hours:"5.5"},
                    {name:"\uBC29\uD68C\uC724",pos:["\uD1B5\uD569"],hours:"4.5"},
                    {name:"\uD64D\uC131\uD604",pos:["\uD1B5\uD569"],hours:"4.5"},
                    {name:"\uD64D\uBBFC\uACBD",pos:["\uD1B5\uD569"],hours:"4.5"},
                    {name:"\uAE40\uB098\uC740",pos:["\uD1B5\uD569"],hours:"4.5"},
                    {name:"\uC815\uD0DC\uBBFC",pos:["\uD1B5\uD569"],hours:"4.5"},
                    {name:"\uC2E0\uBBFC\uACBD",pos:["\uD1B5\uD569"],hours:"5.5"},
                    {name:"\uC870\uB3D9\uC6B0",pos:["\uD1B5\uD569"],hours:"5.5"},
                    {name:"\uC774\uC9C4\uC544",pos:["\uD1B5\uD569"],hours:"4.5"},
                    {name:"\uC774\uC608\uBE48",pos:["\uD1B5\uD569"],hours:"5.5"},
                    {name:"\uC724\uC18C\uC740",pos:["\uD1B5\uD569"],hours:"4.5"},
                    {name:"\uC190\uC815\uD604",pos:["\uB9E4\uC810","\uD50C\uB85C\uC5B4"],hours:"4.5"},
                    {name:"\uC774\uD558\uC728",pos:["\uB9E4\uC810","\uD50C\uB85C\uC5B4"],hours:"4.5"},
                    {name:"\uC1A1\uD574\uC778",pos:["\uB9E4\uC810","\uD50C\uB85C\uC5B4"],hours:"4.5"},
                    {name:"\uCD5C\uC7AC\uC740",pos:["\uD50C\uB85C\uC5B4"],hours:"4.5"}
                ];
                MISO_DATA = defaults;
                FULL_HOUR_NAMES = defaults.filter(function(m){ return m.hours==="5.5"; }).map(function(m){ return m.name; });
                buildUserGrid();
            }
            document.getElementById("user-select-modal").style.display = "flex";
        }
        function closeUserSelectModal(){ document.getElementById("user-select-modal").style.display = "none"; }

        function selectUser(name) {
            currentUser = name;
            var person = MISO_DATA.find(function(m){ return m.name === name; });
            currentUserPos = person ? person.pos : [];
            sessionStorage.setItem("cgv_currentUser", name);
            var btn = document.getElementById("user-display-btn");
            btn.innerHTML = "<span class='text-slate-900 font-black text-xl'>"+name+" <span class='text-[15px] text-slate-500 font-semibold'>("+currentUserPos.join(", ")+")</span></span><span class='bg-slate-800 text-white px-3 py-1.5 rounded-lg font-black tracking-widest uppercase shadow-md'>\uBCC0\uACBD</span>";
            clearReqData(); clearWishData(); updatePosButtonLock();
            var um = document.getElementById("user-select-modal");
            if (um && um.style.display !== "none") closeUserSelectModal();
            renderList();
        }

        function clearReqData() {
            document.querySelectorAll(".req-time-group").forEach(function(g){ g.classList.remove("selected","all-selected"); });
            document.querySelectorAll(".req-pos-chip").forEach(function(c){ c.classList.remove("pos-selected"); });
            document.querySelectorAll(".req-day-chip").forEach(function(c){ c.classList.remove("selected"); });
            var g = document.getElementById("req-code-grid");
            if (g){ g.innerHTML = ""; g.classList.add("hidden"); }
            ["req-selected-pos","req-selected-code","req-selected-day"].forEach(function(id){
                var el = document.getElementById(id); if (el) el.value = "";
            });
            var ri = document.getElementById("req-date-input"); if (ri) ri.value = "";
            var rs = document.getElementById("reason-select"); if (rs) rs.value = "";
        }

        function updatePosButtonLock() {
            if (!currentUser) return;
            var isTotal = currentUserPos.indexOf("\uD1B5\uD569") > -1;
            var canMeajumMagam = isTotal || currentUserPos.indexOf("\uB9E4\uC810\uB9C8\uAC10") > -1 || currentUserPos.indexOf("\uB9E4\uC810") > -1;
            ["\uD1B5\uD569","\uB9E4\uC810","\uB9E4\uC810\uB9C8\uAC10","\uD50C\uB85C\uC5B4"].forEach(function(p) {
                var btn = document.getElementById("req-pos-"+p);
                if (!btn) return;
                var capable = isTotal || currentUserPos.indexOf(p) > -1 || (p === "\uB9E4\uC810\uB9C8\uAC10" && canMeajumMagam);
                if (capable) btn.classList.remove("locked");
                else btn.classList.add("locked");
            });
            clearWishData();
        }

        function setTradeType(type) {
            document.getElementById("trade-type-input").value = type;
            var isSwap = type === "swap";
            document.getElementById("type-swap-btn").className = isSwap
                ? "flex-1 py-4 rounded-[18px] font-black bg-slate-900 text-white shadow-md transition-all"
                : "flex-1 py-4 rounded-[18px] font-black bg-white border text-slate-500";
            document.getElementById("type-sub-btn").className = !isSwap
                ? "flex-1 py-4 rounded-[18px] font-black bg-orange-500 text-white shadow-md transition-all"
                : "flex-1 py-4 rounded-[18px] font-black bg-white border text-slate-500";
            document.getElementById("wish-section").classList.toggle("hidden", !isSwap);
            document.getElementById("sub-warning-section").classList.toggle("hidden", isSwap);
            if (isSwap) clearWishData();
        }

        function clearTimeSelection(type) {
            document.querySelectorAll("."+type+"-time-group").forEach(function(g){ g.classList.remove("selected","all-selected"); });
            var grid = document.getElementById(type+"-code-grid");
            if (grid){ grid.innerHTML = ""; grid.classList.add("hidden"); }
            var sc = document.getElementById(type+"-selected-code"); if (sc) sc.value = "";
        }

        function setDayAndAutoDate(dayName, type) {
            if (type !== "req") return;
            document.querySelectorAll("."+type+"-day-chip").forEach(function(c){
                c.classList.toggle("selected", c.innerText === dayName);
            });
            var now = new Date();
            var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            // idx: DAYS = [일,월,화,수,목,금,토]
            var idx = DAYS.indexOf(dayName);
            // 월요일 기준 오프셋 (일=6, 월=0, 화=1 ... 토=5)
            var dayOffset = idx === 0 ? 6 : idx - 1;
            // 이번 주 월요일
            var todayDay = today.getDay();
            var mondayDiff = todayDay === 0 ? -6 : 1 - todayDay;
            var thisMonday = new Date(today); thisMonday.setDate(today.getDate() + mondayDiff);
            // 이번 주 해당 요일
            var date1 = new Date(thisMonday); date1.setDate(thisMonday.getDate() + dayOffset);
            // 다음 주 해당 요일
            var date2 = new Date(thisMonday); date2.setDate(thisMonday.getDate() + dayOffset + 7);
            // 이번 주 날짜가 오늘 이전이면 다음주/다다음주로 밀기
            if (date1 <= today) {
                date1 = date2;
                date2 = new Date(date1); date2.setDate(date1.getDate() + 7);
            }
            var d1 = getLocalYYYYMMDD(date1);
            var d2 = getLocalYYYYMMDD(date2);
            var choice = confirm(dayName+"\uC694\uC77C \uB0A0\uC9DC\uB97C \uC120\uD0DD\uD558\uC138\uC694.\n\n[\uD655\uC778] "+d1+"("+dayName+")\n[\uCDE8\uC18C] "+d2+"("+dayName+")");
            var selected = choice ? d1 : d2;
            var inp = document.getElementById(type+"-date-input"); if (inp) inp.value = selected;
            var rd = document.getElementById(type+"-selected-day"); if (rd) rd.value = dayName;
            clearTimeSelection(type);
            clearWishData();
        }

        function updateDayFromDate(type) {
            if (type !== "req") return;
            var inp = document.getElementById(type+"-date-input");
            if (!inp || !inp.value) return;
            var day = DAYS[new Date(inp.value).getDay()];
            document.querySelectorAll("."+type+"-day-chip").forEach(function(c){
                c.classList.toggle("selected", c.innerText === day);
            });
            var rd = document.getElementById(type+"-selected-day"); if (rd) rd.value = day;
            clearTimeSelection(type);
            clearWishData();
        }

        function getWeekRange(dateStr) {
            var d = new Date(dateStr);
            if (isNaN(d)) return null;
            var day = d.getDay();
            var mondayOffset = day === 0 ? -6 : 1 - day;
            var mon = new Date(d); mon.setDate(d.getDate() + mondayOffset);
            var sun = new Date(mon); sun.setDate(mon.getDate() + 6);
            return { mon: mon, sun: sun };
        }

        function toggleWishDay(dayName) {
            var outDateVal = document.getElementById("req-date-input").value;
            if (!outDateVal) {
                alert("보낼 근무(OUT) 날짜를 먼저 선택해 주세요.");
                return;
            }
            var range = getWeekRange(outDateVal);
            if (!range) return;
            // OUT 주차의 해당 요일 날짜 자동 계산
            var idx = DAYS.indexOf(dayName);
            var dayOffset = idx === 0 ? 6 : idx - 1;
            var targetDate = new Date(range.mon); targetDate.setDate(range.mon.getDate() + dayOffset);
            var dateStr = getLocalYYYYMMDD(targetDate)+"("+dayName+")";
            // 이미 선택된 날짜면 해제
            if (wishData[dateStr]) { delete wishData[dateStr]; updateWishUI(); return; }
            if (Object.keys(wishData).length >= 2) { alert("희망 날짜는 최대 2일까지만 선택할 수 있습니다."); return; }
            wishData[dateStr] = { timeGroups:[], codes:[], positions:[] };
            updateWishUI();
        }

                function clearWishData(){ wishData = {}; updateWishUI(); }

        function updateWishUI() {
            document.querySelectorAll(".wish-day-chip").forEach(function(c){
                var found = Object.keys(wishData).some(function(d){ return d.indexOf("("+c.innerText+")") > -1; });
                c.classList.toggle("wish-selected", found);
            });
            var container = document.getElementById("wish-details-container");
            var dates = Object.keys(wishData).sort();
            if (!dates.length) {
                container.innerHTML = "<div class='w-full p-4 bg-white border-2 border-slate-300 rounded-[22px] min-h-[64px] flex items-center justify-center shadow-sm font-black text-slate-400 text-[13px]'>\uC704\uC5D0\uC11C \uC6D0\uD558\uB294 \uC694\uC77C\uC744 \uBA3C\uC800 \uB20C\uB7EC\uC8FC\uC138\uC694.</div>";
                return;
            }
            var html = "";
            dates.forEach(function(dStr, idx) {
                var data = wishData[dStr];
                var tgHtml = ["ALL","D","M","N"].map(function(g){
                    var isSel = g === "ALL" ? data.timeGroups.indexOf("ALL") > -1 : data.timeGroups.indexOf(g) > -1;
                    var cls = isSel ? (g === "ALL" ? "all-selected border-green-400" : "bg-slate-800 text-white border-slate-800") : "bg-white text-slate-400 border-slate-200";
                    var name = g === "ALL" ? "\uC804\uCCB4\uBB34\uAD00" : g === "D" ? "\uC624\uD508(D)" : g === "M" ? "\uBBF8\uB4E4(M)" : "\uB9C8\uAC10(N)";
                    return "<button onclick=\"toggleWishTimeGroup('"+dStr+"','"+g+"')\" class='chip py-4 rounded-2xl font-black text-[11px] transition-all shadow-sm border-2 "+cls+"'>"+name+"</button>";
                }).join("");

                var codeGridHtml = "";
                if (data.timeGroups.indexOf("ALL") > -1) {
                    codeGridHtml = "<div class='col-span-2'><p class='text-green-700 font-black py-4 px-2 w-full text-center bg-green-50 rounded-xl border border-green-200 text-[13px]'>\uD574\uB2F9 \uC694\uC77C \uC804\uCCB4 \uC2DC\uAC04\uB300 (\uC544\uBB34\uB54C\uB098 \uAC00\uB2A5)</p></div>";
                } else if (data.timeGroups.length > 0) {
                    var sorted = data.timeGroups.slice().sort(function(a,b){ return ({D:1,M:2,N:3}[a]||0) - ({D:1,M:2,N:3}[b]||0); });
                    var allPoss = [];
                    sorted.forEach(function(g){ SHIFT_CODES[g].forEach(function(i){ allPoss.push(i.code+" ("+i.time+")"); }); });
                    var isAllSel = allPoss.length > 0 && allPoss.every(function(c){ return data.codes.indexOf(c) > -1; });
                    codeGridHtml += "<button onclick=\"toggleAllCodes('"+dStr+"')\" class='col-span-3 mb-2 py-3 w-full rounded-xl font-black text-[13px] transition-all shadow-sm border-2 "+(isAllSel ? "bg-slate-800 text-white border-slate-800" : "bg-blue-50 text-blue-600 border-blue-200")+"'>"+(isAllSel ? "\uC804\uCCB4 \uC120\uD0DD \uD574\uC81C" : "\uB098\uD0C0\uB09C \uC2DC\uAC04\uB300 \uBAA8\uB450 \uC120\uD0DD")+"</button>";
                    sorted.forEach(function(g){
                        var codes = g === "N" ? getAvailableNCodes(dStr) : SHIFT_CODES[g];
                        codes.forEach(function(i){
                            var cStr = i.code+" ("+i.time+")";
                            var isSel = data.codes.indexOf(cStr) > -1;
                            var cls = isSel ? "bg-blue-600 text-white border-blue-600 shadow-md" : "bg-white text-slate-500 border-slate-100";
                            var timeParts = parseTimeDisplay(i.time);
                            codeGridHtml += "<div onclick=\"toggleWishCode('"+dStr+"','"+cStr+"')\" class='chip flex flex-col items-center justify-center p-2 rounded-xl border-2 shadow-sm font-black transition-all "+cls+"'><span class='text-[14px] font-black leading-tight'>"+i.code+"</span><span class='text-[9px] font-bold opacity-80 leading-tight'>"+timeParts.main+"</span><span class='text-[8px] font-bold text-blue-500 leading-tight'>"+timeParts.sub+"</span></div>";
                        });
                    });
                }
                var isAllSelected = data.timeGroups.indexOf("ALL") > -1;
                var posHtml = ["\uD1B5\uD569","\uB9E4\uC810","\uB9E4\uC810\uB9C8\uAC10","\uD50C\uB85C\uC5B4"].map(function(p){
                    var isSel = data.positions.indexOf(p) > -1;
                    var cls = isSel ? "bg-slate-600 text-white border-slate-600" : "bg-white text-slate-600 border-slate-200";
                    return "<div onclick=\"toggleWishPos('"+dStr+"','"+p+"')\" class='chip py-3 px-4 rounded-xl font-black text-xs transition-all border-2 shadow-sm "+cls+"'>"+p+"</div>";
                }).join("");

                html += "<div class='bg-blue-50/40 p-6 rounded-[28px] border-2 border-blue-200 shadow-sm space-y-5 relative'>"
                    + "<div class='absolute -top-3 left-4 bg-blue-600 text-white px-3 py-1 rounded-full text-[11px] font-black shadow-sm'>\uC635\uC158 "+(idx+1)+"</div>"
                    + "<div class='font-black text-xl text-slate-800 mt-1'>"+dStr+"</div>"
                    + "<div class='space-y-3'><label class='text-[10px] text-slate-500 font-black'>\uC2DC\uAC04\uB300 \uADF8\uB8F9 \uC120\uD0DD (\uCD5C\uB300 2\uAC1C)</label>"
                    + "<div class='grid grid-cols-4 gap-2'>"+tgHtml+"</div></div>"
                    + "<div class='grid grid-cols-3 gap-2 pt-2'>"+codeGridHtml+"</div>"
                    + (isAllSelected ? "" : "<div class='pt-5 border-t-2 border-blue-100 space-y-3'><label class='text-[10px] text-blue-600 font-black block'>\uAD50\uD658 \uBC1B\uC744 \uD3EC\uC9C0\uC158 (\uB2E4\uC911\uC120\uD0DD)</label><div class='flex flex-wrap gap-2'>"+posHtml+"</div></div>")
                    + "</div>";
            });
            container.innerHTML = html;
        }

        // 날짜 문자열에서 요일 추출 → 주중/주말 판단
        function isWeekendDate(dateStr) {
            var m = dateStr.match(/\(([\uC6D4\uD654\uC218\uBAA9\uAE08\uD1A0\uC77C])\)/);
            if (!m) return false;
            return ["\uAE08","\uD1A0","\uC77C"].indexOf(m[1]) > -1;
        }
        // 요일에 따른 N 코드 반환 (주중: N1만, 주말: N1+N2)
        function getAvailableNCodes(dateStr) {
            if (isWeekendDate(dateStr)) return SHIFT_CODES["N"];
            return SHIFT_CODES["N"].filter(function(i){ return i.code === "N1"; });
        }
        // N 선택 여부에 따른 매점마감 자동 처리
        function syncMaejumMagam(data, hasN) {
            var canMM = currentUserPos.indexOf("\uD1B5\uD569") > -1 || currentUserPos.indexOf("\uB9E4\uC810") > -1;
            if (!canMM) return;
            if (hasN) {
                if (data.positions.indexOf("\uB9E4\uC810\uB9C8\uAC10") === -1) data.positions.push("\uB9E4\uC810\uB9C8\uAC10");
            } else {
                data.positions = data.positions.filter(function(p){ return p !== "\uB9E4\uC810\uB9C8\uAC10"; });
            }
        }

        function toggleWishTimeGroup(dateStr, group) {
            var data = wishData[dateStr];
            if (group === "ALL") {
                if (currentUserPos.indexOf("\uD1B5\uD569") === -1) { alert("\uC804\uCCB4 \uC2DC\uAC04 \uBB34\uAD00\uC740 \uD1B5\uD569 \uC778\uC6D0 \uC804\uC6A9\uC785\uB2C8\uB2E4."); return; }
                data.timeGroups = ["ALL"]; data.codes = []; data.positions = [];
            } else {
                if (data.timeGroups.indexOf("ALL") > -1){ data.timeGroups = []; data.codes = []; }
                var idx = data.timeGroups.indexOf(group);
                if (idx > -1) {
                    data.timeGroups.splice(idx, 1);
                    data.codes = data.codes.filter(function(c){ return !c.startsWith(group); });
                } else {
                    if (data.timeGroups.length >= 2){ alert("\uC2DC\uAC04\uB300 \uADF8\uB8F9\uC740 \uCD5C\uB300 2\uAC1C\uAE4C\uC9C0\uB9CC \uC120\uD0DD \uAC00\uB2A5\uD569\uB2C8\uB2E4."); return; }
                    data.timeGroups.push(group);
                }
                // N 포함 여부에 따라 매점마감 자동 연동 + 매점 단독 자동 해제
                var hasN = data.timeGroups.indexOf("N") > -1;
                if (hasN) {
                    // N 시간대 추가 시 매점 단독 포지션 자동 해제
                    data.positions = data.positions.filter(function(p){ return p !== "\uB9E4\uC810"; });
                } else {
                    // N 시간대 제거 시 매점마감 포지션 자동 해제
                    data.positions = data.positions.filter(function(p){ return p !== "\uB9E4\uC810\uB9C8\uAC10"; });
                }
                syncMaejumMagam(data, hasN);
            }
            updateWishUI();
        }

        function toggleAllCodes(dateStr) {
            var data = wishData[dateStr];
            var allPoss = [];
            data.timeGroups.forEach(function(g){ if (g !== "ALL"){ var codes = g === "N" ? getAvailableNCodes(dateStr) : SHIFT_CODES[g]; codes.forEach(function(i){ allPoss.push(i.code+" ("+i.time+")"); }); } });
            var isAllSel = allPoss.length > 0 && allPoss.every(function(c){ return data.codes.indexOf(c) > -1; });
            if (isAllSel) { data.codes = []; }
            else {
                data.codes = allPoss.slice();
            }
            updateWishUI();
        }

        function toggleWishCode(dateStr, codeStr) {
            var data = wishData[dateStr];
            if (data.timeGroups.indexOf("ALL") > -1) return;
            var idx = data.codes.indexOf(codeStr);
            if (idx > -1) data.codes.splice(idx,1); else data.codes.push(codeStr);
            updateWishUI();
        }

        function toggleWishPos(dateStr, pos) {
            var isTotal = currentUserPos.indexOf("\uD1B5\uD569") > -1;
            var canMaejumMagam = pos === "\uB9E4\uC810\uB9C8\uAC10" && (currentUserPos.indexOf("\uB9E4\uC810") > -1 || isTotal);
            if (!isTotal && !canMaejumMagam && currentUserPos.indexOf(pos) === -1) { alert("\uBCF8\uC778 \uC5ED\uB7C9 \uBC16\uC758 \uD3EC\uC9C0\uC158\uC785\uB2C8\uB2E4."); return; }
            var data = wishData[dateStr];
            var hasN = data.timeGroups.indexOf("N") > -1;
            var isAll = data.timeGroups.indexOf("ALL") > -1;

            // N 시간대 포함 시 매점 단독 선택 불가
            if (hasN && pos === "\uB9E4\uC810") {
                alert("\uB9C8\uAC10(N) \uC2DC\uAC04\uB300\uC5D0\uB294 \uB9E4\uC810 \uB2E8\uB3C5 \uC120\uD0DD\uC774 \uBD88\uAC00\uD569\uB2C8\uB2E4. \uB9E4\uC810\uB9C8\uAC10\uC744 \uC120\uD0DD\uD574 \uC8FC\uC138\uC694."); return;
            }
            // N 시간대 아닐 때 매점마감 선택 불가
            if (!hasN && !isAll && pos === "\uB9E4\uC810\uB9C8\uAC10") {
                alert("\uB9E4\uC810\uB9C8\uAC10\uC740 \uB9C8\uAC10(N) \uC2DC\uAC04\uB300\uC5D0\uC11C\uB9CC \uC120\uD0DD \uAC00\uB2A5\uD569\uB2C8\uB2E4."); return;
            }

            // 전체무관(ALL)일 때 매점 선택 → 매점마감 자동 연동
            if (isAll && pos === "\uB9E4\uC810") {
                var hasMaejum = data.positions.indexOf("\uB9E4\uC810") > -1;
                if (hasMaejum) {
                    data.positions = data.positions.filter(function(p){ return p !== "\uB9E4\uC810" && p !== "\uB9E4\uC810\uB9C8\uAC10"; });
                } else {
                    if (data.positions.length >= 3) { alert("\uD3EC\uC9C0\uC158\uC740 \uCD5C\uB300 3\uAC1C\uAE4C\uC9C0\uB9CC \uC120\uD0DD \uAC00\uB2A5\uD569\uB2C8\uB2E4."); return; }
                    if (data.positions.indexOf("\uB9E4\uC810") === -1) data.positions.push("\uB9E4\uC810");
                    if (data.positions.indexOf("\uB9E4\uC810\uB9C8\uAC10") === -1) data.positions.push("\uB9E4\uC810\uB9C8\uAC10");
                }
                updateWishUI(); return;
            }
            var idx = data.positions.indexOf(pos);
            if (idx > -1) data.positions.splice(idx,1);
            else {
                if (data.positions.length >= 3){ alert("\uD3EC\uC9C0\uC158\uC740 \uCD5C\uB300 3\uAC1C\uAE4C\uC9C0\uB9CC \uC120\uD0DD \uAC00\uB2A5\uD569\uB2C8\uB2E4."); return; }
                data.positions.push(pos);
            }
            updateWishUI();
        }

        function setTimeGroup(group, type) {
            if (type !== "req") return;
            if (!document.getElementById("req-selected-day").value){ alert("\uC694\uC77C\uC744 \uBA3C\uC800 \uC120\uD0DD\uD574 \uC8FC\uC138\uC694."); return; }

            // Rule 2: 매점마감 포지션 선택 중이면 N 시간대만 허용
            var curPos = document.getElementById("req-selected-pos").value;
            if (curPos === "\uB9E4\uC810\uB9C8\uAC10" && group !== "N") {
                alert("\uB9E4\uC810\uB9C8\uAC10 \uD3EC\uC9C0\uC158\uC740 \uB9C8\uAC10(N) \uC2DC\uAC04\uB300\uB9CC \uC120\uD0DD \uAC00\uB2A5\uD569\uB2C8\uB2E4."); return;
            }
            // Rule 3: 매점 포지션 선택 중이면 N 시간대 비활성
            if (curPos === "\uB9E4\uC810" && group === "N") {
                alert("\uB9E4\uC810 \uD3EC\uC9C0\uC158\uC740 \uB9C8\uAC10(N) \uC2DC\uAC04\uB300\uB97C \uC120\uD0DD\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4."); return;
            }

            document.querySelectorAll("."+type+"-time-group").forEach(function(g){
                g.classList.toggle("selected", g.id === type+"-group-"+group);
            });
            var grid = document.getElementById(type+"-code-grid");
            if (!grid) return;
            grid.innerHTML = ""; grid.classList.remove("hidden");
            var reqDateStr = document.getElementById("req-date-input").value;
            var reqDayStr = document.getElementById("req-selected-day").value;
            var reqFullDate = reqDateStr ? reqDateStr+"("+reqDayStr+")" : "";
            var codes = group === "N" ? getAvailableNCodes(reqFullDate) : SHIFT_CODES[group];
            codes.forEach(function(i) {
                var b = document.createElement("div");
                b.className = "code-chip chip flex flex-col items-center justify-center bg-white border-2 border-slate-200 shadow-sm font-black transition-all";
                var timeParts = parseTimeDisplay(i.time);
                b.innerHTML = "<span class='text-[14px] font-black leading-tight'>"+i.code+"</span><span class='text-[9px] font-bold opacity-80 leading-tight'>"+timeParts.main+"</span><span class='text-[8px] font-bold text-blue-500 leading-tight'>"+timeParts.sub+"</span>";
                b.onclick = function() {
                    grid.querySelectorAll(".code-chip").forEach(function(c){ c.classList.remove("selected"); });
                    b.classList.add("selected");
                    document.getElementById(type+"-selected-code").value = i.code+" ("+i.time+")";
                    updateReqPosLocked();
                    // Rule 1: N 아닌 코드 선택 시 매점마감 포지션 해제
                    if (!i.code.startsWith("N")) {
                        var cp = document.getElementById("req-selected-pos").value;
                        if (cp === "\uB9E4\uC810\uB9C8\uAC10") {
                            document.querySelectorAll(".req-pos-chip").forEach(function(c){ c.classList.remove("pos-selected"); });
                            document.getElementById("req-selected-pos").value = "";
                            alert("\uB9C8\uAC10(N) \uC2DC\uAC04\uB300\uAC00 \uC544\uB2C8\uBA74 \uB9E4\uC810\uB9C8\uAC10\uC744 \uC120\uD0DD\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
                        }
                    }
                    // 기존: N 선택 시 매점 포지션 해제
                    if (i.code.startsWith("N")) {
                        var cp = document.getElementById("req-selected-pos").value;
                        if (cp === "\uB9E4\uC810") {
                            document.querySelectorAll(".req-pos-chip").forEach(function(c){ c.classList.remove("pos-selected"); });
                            document.getElementById("req-selected-pos").value = "";
                            alert("\uB9C8\uAC10(N) \uC2DC\uAC04\uB300\uC5D0\uB294 \uC77C\uBC18 \uB9E4\uC810\uC744 \uC120\uD0DD\uD560 \uC218 \uC5C6\uC5B4 \uD3EC\uC9C0\uC158\uC774 \uCD08\uAE30\uD654\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uB9E4\uC810\uB9C8\uAC10 \uB4F1\uC744 \uB2E4\uC2DC \uC120\uD0DD\uD574 \uC8FC\uC138\uC694.");
                        }
                    }
                };
                grid.appendChild(b);
            });
        }

        function setReqPosition(pos) {
            var isTotal = currentUserPos.indexOf("\uD1B5\uD569") > -1;
            if (!isTotal && currentUserPos.indexOf(pos) === -1){ alert("\uBCF8\uC778 \uC5ED\uB7C9 \uBC16\uC758 \uD3EC\uC9C0\uC158\uC785\uB2C8\uB2E4."); return; }
            var rc = document.getElementById("req-selected-code").value;
            var grp = document.getElementById("req-selected-group") ? document.getElementById("req-selected-group").value : "";
            var curGroup = document.querySelector(".req-time-group.selected");
            var isN = rc.startsWith("N") || (curGroup && curGroup.id === "req-group-N");

            // Rule 1: N 아닌 시간대에서 매점마감 선택 불가
            if (pos === "\uB9E4\uC810\uB9C8\uAC10" && !isN) {
                alert("\uB9E4\uC810\uB9C8\uAC10\uC740 \uB9C8\uAC10(N) \uC2DC\uAC04\uB300\uC5D0\uC11C\uB9CC \uC120\uD0DD \uAC00\uB2A5\uD569\uB2C8\uB2E4."); return;
            }
            // Rule 3: 매점 선택 시 N 코드 선택 불가 (이미 선택된 경우 해제)
            if (pos === "\uB9E4\uC810" && rc.startsWith("N")) {
                alert("\uB9C8\uAC10(N) \uC2DC\uAC04\uB300\uB294 \uB9E4\uC810 \uB300\uC2E0 \uB9E4\uC810\uB9C8\uAC10, \uD1B5\uD569, \uD50C\uB85C\uC5B4\uB9CC \uC120\uD0DD \uAC00\uB2A5\uD569\uB2C8\uB2E4."); return;
            }
            document.querySelectorAll(".req-pos-chip").forEach(function(c){ c.classList.remove("pos-selected"); });
            document.getElementById("req-pos-"+pos).classList.add("pos-selected");
            document.getElementById("req-selected-pos").value = pos;
        }

        function updateReqPosLocked() {
            var rc = document.getElementById("req-selected-code").value;
            var isN = rc.startsWith("N");
            var canMeajumMagam = currentUserPos.indexOf("\uD1B5\uD569") > -1
                || currentUserPos.indexOf("\uB9E4\uC810\uB9C8\uAC10") > -1
                || currentUserPos.indexOf("\uB9E4\uC810") > -1;
            var mmChip = document.getElementById("req-pos-\uB9E4\uC810\uB9C8\uAC10");
            if (mmChip) {
                // 매점마감: 역량 있고 + N 시간대일 때만 활성
                if (isN && canMeajumMagam) {
                    mmChip.classList.remove("locked");
                } else {
                    mmChip.classList.add("locked");
                    if (document.getElementById("req-selected-pos").value === "\uB9E4\uC810\uB9C8\uAC10") {
                        mmChip.classList.remove("pos-selected");
                        document.getElementById("req-selected-pos").value = "";
                    }
                }
            }
        }

        function setSupportPositionSilently(pos) {
            var isTotal = currentUserPos.indexOf("\uD1B5\uD569") > -1;
            if (!isTotal && currentUserPos.indexOf(pos) === -1) return;
            document.querySelectorAll(".support-pos-chip").forEach(function(c){ c.classList.remove("pos-selected"); });
            var el = document.getElementById("support-pos-"+pos);
            if (el) el.classList.add("pos-selected");
            document.getElementById("support-selected-pos").value = pos;
        }

        function setSupportPosition(pos) {
            var t = trades.find(function(tr){ return tr.id === selectedTradeId; });
            var isTotal = currentUserPos.indexOf("\uD1B5\uD569") > -1;
            // 통합은 모든 포지션 가능, 매점마감은 매점 공고도 지원 가능
            var canMM = pos === "\uB9E4\uC810\uB9C8\uAC10" && currentUserPos.indexOf("\uB9E4\uC810") > -1;
            var isCapable = isTotal || canMM || currentUserPos.indexOf(pos) > -1;
            if (!isCapable){ alert("\uBCF8\uC778 \uC5ED\uB7C9 \uBC16\uC758 \uD3EC\uC9C0\uC158\uC785\uB2C8\uB2E4."); return; }
            document.querySelectorAll(".support-pos-chip").forEach(function(c){ c.classList.remove("pos-selected"); });
            document.getElementById("support-pos-"+pos).classList.add("pos-selected");
            document.getElementById("support-selected-pos").value = pos;
        }

        function checkPenaltyStatus(name) {
            var now = new Date();
            var curr = getWeekKey(getLocalYYYYMMDD(now));
            var prev = new Date(now); prev.setDate(now.getDate()-7);
            var prevW = getWeekKey(getLocalYYYYMMDD(prev));
            var data = attendanceData[name]; if (!data) return false;
            if (data[curr] && data[curr].late >= 1) return true;
            if (data[curr] && data[curr].absent >= 1) return true;
            if (data[prevW] && data[prevW].absent >= 1) return true;
            return false;
        }

        function submitNewTrade() {
            if (!currentUser){ alert("\uC0C1\uB2E8\uC5D0\uC11C \uBCF8\uC778 \uC774\uB984\uC744 \uBA3C\uC800 \uC120\uD0DD\uD574 \uC8FC\uC138\uC694!"); return; }
            if (checkPenaltyStatus(currentUser)){ alert("\uADFC\uD0DC \uD398\uB110\uD2F0 \uC801\uC6A9 - \uD604\uC7AC \uC2DC\uC2A4\uD15C \uC774\uC6A9 \uAD8C\uD55C\uC774 \uC815\uC9C0\uB41C \uC0C1\uD0DC\uC785\uB2C8\uB2E4."); return; }
            var type = document.getElementById("trade-type-input").value;
            var rDate = document.getElementById("req-date-input").value;
            var rCode = document.getElementById("req-selected-code").value;
            var rPos = document.getElementById("req-selected-pos").value;
            var reas = document.getElementById("reason-select").value;
            var rDay = document.getElementById("req-selected-day").value || (rDate ? DAYS[new Date(rDate).getDay()] : "");
            if (!rDate||!rCode||!rPos||!reas){ alert("\uBCF4\uB0BC \uADFC\uBB34(OUT) \uBC0F \uC0AC\uC720\uC758 \uBAA8\uB4E0 \uD544\uC218 \uD56D\uBAA9\uC744 \uC120\uD0DD\uD574 \uC8FC\uC138\uC694!"); return; }
            if (isTodayOrPast(rDate)){ alert("\uB2F9\uC77C/\uACFC\uAC70 \uADFC\uBB34\uB294 \uC2E0\uCCAD\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4."); return; }
            if (isExpired(rDate)){ alert("전날 23시 이후에는 신청할 수 없습니다."); return; }
            if (rCode.startsWith("N") && rPos === "\uB9E4\uC810"){ alert("\uB9C8\uAC10(N) \uC2DC\uAC04\uB300(OUT)\uC5D0\uB294 \uC77C\uBC18 \uB9E4\uC810\uC744 \uC120\uD0DD\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4."); return; }

            var dShiftData = "";
            if (type === "swap") {
                var dates = Object.keys(wishData).sort();
                if (!dates.length){ alert("\uBC1B\uACE0 \uC2F6\uC740 \uADFC\uBB34 \uB0A0\uC9DC(IN)\uB97C \uD558\uB098 \uC774\uC0C1 \uC120\uD0DD\uD574 \uC8FC\uC138\uC694!"); return; }
                var lines = [];
                for (var i = 0; i < dates.length; i++) {
                    var d = dates[i]; var data = wishData[d];
                    if (!data.timeGroups.length){ alert("["+d+"]\uC758 \uC2DC\uAC04\uB300\uB97C \uC120\uD0DD\uD574 \uC8FC\uC138\uC694!"); return; }
                    if (data.timeGroups.indexOf("ALL") === -1 && !data.positions.length){ alert("["+d+"]\uC758 \uD76C\uB9DD \uD3EC\uC9C0\uC158\uC744 \uC120\uD0DD\uD574 \uC8FC\uC138\uC694!"); return; }
                    var timeText = "";
                    if (data.timeGroups.indexOf("ALL") > -1) {
                        timeText = "\uC804\uCCB4 \uC2DC\uAC04 \uBB34\uAD00 (ALL)";
                    } else if (!data.codes.length) {
                        alert("["+d+"]\uC758 \uC138\uBD80 \uC2DC\uAC04\uC744 1\uAC1C \uC774\uC0C1 \uC120\uD0DD\uD558\uAC70\uB098 \uC804\uCCB4 \uC120\uD0DD\uC744 \uB20C\uB7EC\uC8FC\uC138\uC694!"); return;
                    } else {
                        var allPoss = [];
                        data.timeGroups.forEach(function(g){ var codes = g === "N" ? getAvailableNCodes(d) : SHIFT_CODES[g]; codes.forEach(function(ii){ allPoss.push(ii.code+" ("+ii.time+")"); }); });
                        if (data.codes.length === allPoss.length) {
                            var gNames = data.timeGroups.map(function(g){ return g==="D"?"\uC624\uD508(D)":g==="M"?"\uBBF8\uB4E4(M)":"\uB9C8\uAC10(N)"; });
                            timeText = gNames.join(", ")+" \uC804\uCCB4\uAC00\uB2A5";
                        } else {
                            timeText = data.codes.map(function(c){ return c.split(" ")[0]; }).join(", ");
                        }
                    }
                    var posTag = data.positions.length ? " ["+data.positions.join("/")+"]" : "";
                    lines.push(d+" / "+timeText+posTag);
                }
                dShiftData = lines.join("\n");
            } else { dShiftData = "\uB300\uD0C0 \uC694\uCCAD"; }

            var nT = {
                id: "TRD-"+rDate.replace(/-/g,"").substring(4)+"-"+String(Date.now()).slice(-4),
                reqName: currentUser, subName: "\uBAA8\uC9D1\uC911",
                shiftDate: rDate+"("+rDay+") / "+rCode,
                reqPos: rPos, desiredShift: dShiftData,
                reason: reas, status: "\uBAA8\uC9D1\uC911", tradeType: type
            };
            var shareText = "\uD83C\uDFAC "+(type==="sub"?"\uD83D\uDD04 \uB300\uD0C0 \uC694\uCCAD":"\uD83E\uDD1D \uB9DE\uAD50\uB300 \uACF5\uACE0")+"\n"
                + "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n"
                + getGenderEmoji(currentUser)+" \uC2E0\uCCAD\uC790  "+currentUser+"\n"
                + "\uD83D\uDCE4 OUT  "+rDate+"("+rDay+") / "+rCode+" ["+rPos+"]\n"
                + (type==="sub"
                    ? "\uD83D\uDCE2 \uB300\uC2E0 \uADFC\uBB34\uD574\uC8FC\uC2E4 \uBD84 \uAD6C\uD569\uB2C8\uB2E4!"
                    : "\uD83D\uDCE5 IN  "+dShiftData)
                + "\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n";

            showLoader(true, "\uB4F1\uB85D \uC911...");
            if (typeof google !== "undefined" && google.script) {
                google.script.run
                    .withSuccessHandler(function(){
                        showLoader(false);
                        fetchData(); clearReqData(); clearWishData();
                        showKakaoModal(shareText);
                        setTimeout(function(){
                            var el = document.getElementById("main-list-board");
                            if (el) el.scrollIntoView({ behavior:"smooth", block:"start" });
                        }, 800);
                    })
                    .withFailureHandler(function(e){
                        showLoader(false);
                        alert("\uB4F1\uB85D \uC911 \uC624\uB958: "+e.message);
                    })
                    .saveTradeToDB(nT);
            } else {
                trades.unshift(nT);
                showLoader(false);
                fetchData(); clearReqData(); clearWishData();
                showKakaoModal(shareText);
            }
        }

        function openSupportModal(id) {
            try {
                selectedTradeId = id;
                var t = trades.find(function(tr){ return tr.id === id; });
                if (!t){ alert("\uACF5\uACE0 \uC815\uBCF4 \uC5C6\uC74C"); return; }
                if (!currentUser){ alert("\uBCF8\uC778 \uD655\uC778 \uD544\uC218"); return; }
                if (currentUser === t.reqName){ alert("\uBCF8\uC778 \uAE00 \uC9C0\uC6D0 \uBD88\uAC00"); return; }
                if (checkPenaltyStatus(currentUser)){ alert("\uD604\uC7AC \uADFC\uD0DC \uD398\uB110\uD2F0 \uCC28\uB2E8 \uAE30\uAC04\uC785\uB2C8\uB2E4."); return; }
                var isTotal = currentUserPos.indexOf("\uD1B5\uD569") > -1;
                var isCapable = isTotal || currentUserPos.indexOf(t.reqPos) > -1
                    || (currentUserPos.indexOf("\uB9E4\uC810\uB9C8\uAC10") > -1 && t.reqPos === "\uB9E4\uC810")
                    || (currentUserPos.indexOf("\uB9E4\uC810") > -1 && t.reqPos === "\uB9E4\uC810\uB9C8\uAC10");
                if (!isCapable){ alert("\uAD8C\uD55C \uBD80\uC871 (["+t.reqPos+"] \uD544\uC694)"); return; }

                var shiftParts = (t.shiftDate||"\uB0B4\uC6A9 \uC5C6\uC74C").split(" / ");
                document.getElementById("modal-target-shift").innerHTML = shiftParts.length > 1
                    ? "<span class='block'>"+shiftParts[0]+"</span><span class='block text-blue-600'>"+shiftParts.slice(1).join(" / ")+"</span>"
                    : t.shiftDate||"\uB0B4\uC6A9 \uC5C6\uC74C";
                document.getElementById("modal-target-pos").innerText = "\uC694\uAD6C \uD3EC\uC9C0\uC158: "+(t.reqPos||"\uBB34\uAD00");
                var safe = t.desiredShift ? String(t.desiredShift) : "\uB0B4\uC6A9 \uC5C6\uC74C";
                var lines = safe.split("\n").map(function(l){ return l.trim(); }).filter(function(l){ return l; });
                document.getElementById("modal-target-wish").innerHTML = safe === "\uB300\uD0C0 \uC694\uCCAD" ? safe : lines.map(function(l){ return "<div>"+l+"</div>"; }).join("");

                var dc = document.getElementById("support-day-chips"); dc.innerHTML = "";
                document.getElementById("support-selected-target-date").value = "";
                document.getElementById("support-selected-code").value = "";
                document.getElementById("support-selected-pos").value = "";
                document.getElementById("supporter-time-section").classList.add("hidden");
                document.getElementById("support-code-grid").innerHTML = "";

                if (safe !== "\uB300\uD0C0 \uC694\uCCAD" && safe !== "\uB0B4\uC6A9 \uC5C6\uC74C") {
                    currentSupportOptions = [];
                    lines.forEach(function(opt){
                        var parts = opt.split(" / ");
                        if (parts.length >= 2) {
                            var timeStr = parts[1]; var posStr = "";
                            if (timeStr.indexOf("[") > -1) {
                            posStr = timeStr.split("[")[1].split("]")[0].trim();
                                timeStr = timeStr.split("[")[0].trim();
                            }
                            currentSupportOptions.push({ date:parts[0].trim(), time:timeStr, pos:posStr });
                        }
                    });
                    currentSupportOptions.forEach(function(opt, idx){
                        var btn = document.createElement("button");
                        btn.className = "w-full py-4 px-3 rounded-2xl border-2 border-blue-200 bg-white text-blue-800 font-black transition-all shadow-sm text-left";
                        btn.innerHTML = "<span class='bg-blue-100 text-blue-700 px-2 py-1 rounded-md text-[10px] mr-2'>\uC635\uC158 "+(idx+1)+"</span> "+opt.date;
                        if (currentSupportOptions.length === 1) {
                            btn.classList.replace("bg-white","bg-blue-50");
                            document.getElementById("support-selected-target-date").value = opt.date;
                            renderSupportDetails(opt);
                        }
                        btn.onclick = function(){
                            document.querySelectorAll("#support-day-chips button").forEach(function(b){ b.classList.replace("bg-blue-50","bg-white"); });
                            btn.classList.replace("bg-white","bg-blue-50");
                            document.getElementById("support-selected-target-date").value = opt.date;
                            renderSupportDetails(opt);
                        };
                        dc.appendChild(btn);
                    });
                }

                document.querySelectorAll(".support-pos-chip").forEach(function(c){ c.classList.remove("pos-selected"); });

                // 본인 역량 밖 포지션 잠금 처리
                var isTotal = currentUserPos.indexOf("\uD1B5\uD569") > -1;
                document.querySelectorAll(".support-pos-chip").forEach(function(c){
                    var posName = c.innerText.trim();
                    var canDo = isTotal
                        || currentUserPos.indexOf(posName) > -1
                        || (posName === "\uB9E4\uC810\uB9C8\uAC10" && currentUserPos.indexOf("\uB9E4\uC810") > -1);
                    if (canDo) c.classList.remove("locked");
                    else c.classList.add("locked");
                });

                // 라벨 업데이트: 본인 가능 포지션 명시
                var myPosLabel = document.querySelector("label[for='support-selected-pos'], .support-pos-label");
                var posLabelEl = document.querySelector("#support-pos-container").previousElementSibling;
                if (posLabelEl) posLabelEl.innerText = "\uD22C\uC785 \uD3EC\uC9C0\uC158 \uC120\uD0DD (\uB098\uC758 \uC5ED\uB7C9: "+currentUserPos.join("/")+")";

                if (t.reqPos) setSupportPositionSilently(t.reqPos);

                var timeS = document.getElementById("supporter-time-section");
                if (safe.indexOf("\uBB34\uAD00") > -1 || safe.indexOf("ALL") > -1 || safe.indexOf(",") > -1 || safe.indexOf("\uC804\uCCB4\uAC00\uB2A5") > -1) {
                    timeS.classList.remove("hidden");
                    document.getElementById("support-day-section").classList.remove("hidden");
                } else {
                    timeS.classList.add("hidden");
                    document.getElementById("support-day-section").classList.toggle("hidden", currentSupportOptions.length <= 1);
                }
                document.getElementById("support-modal").style.display = "flex";
            } catch(e) {
                console.error(e);
                alert("\uC9C0\uC6D0 \uCC3D\uC744 \uC5EC\uB294 \uC911 \uBB38\uC81C\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4. \uD654\uBA74\uC744 \uC0C8\uB85C\uACE0\uCE68 \uD574\uC8FC\uC138\uC694.");
            }
        }

        function renderSupportDetails(opt) {
            var timeS = document.getElementById("supporter-time-section");
            var codeGrid = document.getElementById("support-code-grid");
            var posContainer = document.getElementById("support-pos-container");
            document.getElementById("support-selected-code").value = "";
            timeS.classList.remove("hidden");
            codeGrid.innerHTML = ""; codeGrid.classList.remove("hidden");

            // 주중(월~목): D1/D2 제외, N2 제외 / 주말(금~일): 전체
            var isWeekend = isWeekendDate(opt.date);
            function filterByDay(list) {
                return list.filter(function(c){
                    if (!isWeekend && (c.code === "D1" || c.code === "D2")) return false;
                    if (!isWeekend && c.code === "N2") return false;
                    return true;
                });
            }

            var allowed = [];
            if (opt.time.indexOf("ALL") > -1 || opt.time.indexOf("\uC804\uCCB4\uAC00\uB2A5") > -1) {
                ["D","M","N"].forEach(function(g){ filterByDay(SHIFT_CODES[g]).forEach(function(c){ allowed.push(c); }); });
            } else if (opt.time.indexOf("\uBB34\uAD00") > -1) {
                if (opt.time.indexOf("\uC624\uD508(D)") > -1) filterByDay(SHIFT_CODES["D"]).forEach(function(c){ allowed.push(c); });
                if (opt.time.indexOf("\uBBF8\uB4E4(M)") > -1) filterByDay(SHIFT_CODES["M"]).forEach(function(c){ allowed.push(c); });
                if (opt.time.indexOf("\uB9C8\uAC10(N)") > -1) filterByDay(SHIFT_CODES["N"]).forEach(function(c){ allowed.push(c); });
            } else {
                var specific = opt.time.split(", ");
                ["D","M","N"].forEach(function(g){ filterByDay(SHIFT_CODES[g]).forEach(function(c){ if (specific.indexOf(c.code) > -1) allowed.push(c); }); });
            }
            allowed.forEach(function(i){
                var cStr = i.code+" ("+i.time+")";
                var b = document.createElement("div");
                b.className = "support-code-chip code-chip chip flex flex-col items-center justify-center bg-white border-2 border-slate-200 shadow-sm font-black transition-all";
                var timeParts = parseTimeDisplay(i.time);
                b.innerHTML = "<span class='text-[14px] font-black leading-tight'>"+i.code+"</span><span class='text-[9px] font-bold opacity-80 leading-tight'>"+timeParts.main+"</span><span class='text-[8px] font-bold text-blue-500 leading-tight'>"+timeParts.sub+"</span>";
                b.onclick = function(){
                    var curPos = document.getElementById("support-selected-pos").value;
                    // 매점 포지션 → N 코드 선택 불가
                    if (curPos === "\uB9E4\uC810" && i.code.startsWith("N")) {
                        alert("\uB9E4\uC810 \uD3EC\uC9C0\uC158\uC740 \uB9C8\uAC10(N) \uC2DC\uAC04\uB300\uB97C \uC120\uD0DD\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4."); return;
                    }
                    // 매점마감 포지션 → D/M 코드 선택 불가
                    if (curPos === "\uB9E4\uC810\uB9C8\uAC10" && !i.code.startsWith("N")) {
                        alert("\uB9E4\uC810\uB9C8\uAC10 \uD3EC\uC9C0\uC158\uC740 \uB9C8\uAC10(N) \uC2DC\uAC04\uB300\uB9CC \uC120\uD0DD \uAC00\uB2A5\uD569\uB2C8\uB2E4."); return;
                    }
                    codeGrid.querySelectorAll(".support-code-chip").forEach(function(c){ c.classList.remove("selected","bg-blue-100","border-blue-400"); });
                    b.classList.add("selected","bg-blue-100","border-blue-400");
                    document.getElementById("support-selected-code").value = cStr;
                    // N 선택 시 매점 포지션 해제
                    if (i.code.startsWith("N")) {
                        var cp = document.getElementById("support-selected-pos").value;
                        if (cp === "\uB9E4\uC810") {
                            posContainer.querySelectorAll(".support-pos-chip").forEach(function(c){ c.classList.remove("pos-selected"); });
                            document.getElementById("support-selected-pos").value = "";
                            alert("\uB9C8\uAC10(N) \uC2DC\uAC04\uB300\uC5D0\uB294 \uB9E4\uC810\uC744 \uC120\uD0DD\uD560 \uC218 \uC5C6\uC5B4 \uD3EC\uC9C0\uC158\uC774 \uCD08\uAE30\uD654\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
                        }
                    }
                    // D/M 선택 시 매점마감 포지션 해제
                    if (!i.code.startsWith("N")) {
                        var cp = document.getElementById("support-selected-pos").value;
                        if (cp === "\uB9E4\uC810\uB9C8\uAC10") {
                            posContainer.querySelectorAll(".support-pos-chip").forEach(function(c){ c.classList.remove("pos-selected"); });
                            document.getElementById("support-selected-pos").value = "";
                            alert("\uB9C8\uAC10(N) \uC2DC\uAC04\uB300\uAC00 \uC544\uB2C8\uBA74 \uB9E4\uC810\uB9C8\uAC10\uC744 \uC120\uD0DD\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
                        }
                    }
                };
                codeGrid.appendChild(b);
            });

            posContainer.innerHTML = "";
            var allowedPos = opt.pos ? opt.pos.split("/") : ["\uD1B5\uD569","\uB9E4\uC810","\uB9E4\uC810\uB9C8\uAC10","\uD50C\uB85C\uC5B4"];
            allowedPos.forEach(function(p){
                var b = document.createElement("div");
                var isTotal = currentUserPos.indexOf("\uD1B5\uD569") > -1;
                var canDo = isTotal
                    || currentUserPos.indexOf(p) > -1
                    || (p === "\uB9E4\uC810\uB9C8\uAC10" && currentUserPos.indexOf("\uB9E4\uC810") > -1);
                b.className = "support-pos-chip chip py-3 px-4 rounded-xl font-black text-xs text-slate-700 transition-all border shadow-sm bg-white border-slate-200" + (canDo ? "" : " locked");
                b.innerHTML = p;
                b.onclick = function(){
                    var isTotal = currentUserPos.indexOf("\uD1B5\uD569") > -1;
                    var canMM = currentUserPos.indexOf("\uB9E4\uC810") > -1 || isTotal;
                    if (!isTotal && currentUserPos.indexOf(p) === -1 && !(p === "\uB9E4\uC810\uB9C8\uAC10" && canMM)){ alert("\uBCF8\uC778 \uC5ED\uB7C9 \uBC16\uC758 \uD3EC\uC9C0\uC158\uC785\uB2C8\uB2E4."); return; }
                    var sc = document.getElementById("support-selected-code").value;
                    // 매점 → N 코드 선택된 경우 차단
                    if (p === "\uB9E4\uC810" && sc.startsWith("N")) {
                        alert("\uB9C8\uAC10(N) \uC2DC\uAC04\uB300\uB294 \uB9E4\uC810 \uB300\uC2E0 \uB9E4\uC810\uB9C8\uAC10, \uD1B5\uD569, \uD50C\uB85C\uC5B4\uB9CC \uC120\uD0DD \uAC00\uB2A5\uD569\uB2C8\uB2E4."); return;
                    }
                    // 매점마감 → D/M 코드 선택된 경우 차단
                    if (p === "\uB9E4\uC810\uB9C8\uAC10" && sc && !sc.startsWith("N")) {
                        alert("\uB9E4\uC810\uB9C8\uAC10\uC740 \uB9C8\uAC10(N) \uC2DC\uAC04\uB300\uC5D0\uC11C\uB9CC \uC120\uD0DD \uAC00\uB2A5\uD569\uB2C8\uB2E4."); return;
                    }
                    posContainer.querySelectorAll(".support-pos-chip").forEach(function(c){ c.classList.remove("pos-selected","bg-slate-800","text-white"); });
                    b.classList.add("pos-selected","bg-slate-800","text-white");
                    document.getElementById("support-selected-pos").value = p;
                };
                posContainer.appendChild(b);
            });
        }

        function confirmSupport() {
            var t = trades.find(function(tr){ return tr.id === selectedTradeId; });
            var sPos = document.getElementById("support-selected-pos").value;
            var targetDate = document.getElementById("support-selected-target-date").value;
            var sCode = document.getElementById("support-selected-code").value;
            if (!sPos){ alert("\uD22C\uC785\uB420 \uD3EC\uC9C0\uC158\uC744 \uD655\uC2E4\uD788 \uC120\uD0DD\uD574 \uC8FC\uC138\uC694."); return; }
            var fD = t.desiredShift;
            if (t.tradeType !== "sub") {
                if (!targetDate){ alert("\uB0B4\uAC00 \uB4E4\uC5B4\uAC08 \uC815\uD655\uD55C \uB0A0\uC9DC(\uC635\uC158)\uB97C \uC704\uC5D0\uC11C \uD558\uB098 \uC120\uD0DD\uD574 \uC8FC\uC138\uC694."); return; }
                var safe = t.desiredShift ? String(t.desiredShift) : "";
                var opts = safe.split("\n").map(function(l){ return l.trim(); }).filter(function(l){ return l; });
                var selLine = opts.find(function(l){ return l.startsWith(targetDate); });
                if (!selLine){ alert("\uC120\uD0DD\uD55C \uB0A0\uC9DC\uC758 \uC0C1\uC138 \uC815\uBCF4\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4."); return; }
                var parts = selLine.split(" / ");
                var tps = parts[1]||"";
                if (tps.indexOf("\uBB34\uAD00") > -1 || tps.indexOf("ALL") > -1 || tps.indexOf(",") > -1 || tps.indexOf("\uC804\uCCB4\uAC00\uB2A5") > -1) {
                    if (!sCode){ alert("\uB0B4 \uC2E4\uC81C \uADFC\uBB34 \uC2DC\uAC04 \uC81C\uC548\uC744 \uB2EC\uB825 \uC544\uB798\uC5D0\uC11C \uD558\uB098 \uC120\uD0DD\uD574 \uC8FC\uC138\uC694."); return; }
                    fD = targetDate+" / "+sCode.split(" ")[0]+" ["+sPos+"] (\uC2DC\uAC04/\uD3EC\uC9C0\uC158 \uACE0\uC815)";
                } else {
                    fD = targetDate+" / "+tps.split(" [")[0].trim()+" ["+sPos+"] (\uC2DC\uAC04/\uD3EC\uC9C0\uC158 \uACE0\uC815)";
                }
            }
            var shareText = "\uD83C\uDFAC \uD83E\uDD1D \uAD50\uB300 \uC9C0\uC6D0 \uC54C\uB9BC\n"
                + "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n"
                + getGenderEmoji(currentUser)+" \uC9C0\uC6D0\uC790  "+currentUser+"\n"
                + "\uD83D\uDCE4 OUT  "+t.shiftDate+"\n"
                + "\uD83D\uDCE5 IN   "+fD.split(" (\uC2DC\uAC04")[0]+"\n"
                + "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n"
                + "\uD83D\uDCE2 @ "+t.reqName+" \uB2D8\uAED8 \uC9C0\uC6D0\uD588\uC2B5\uB2C8\uB2E4!\n"
                + "\u2705 \uC2DC\uC2A4\uD15C \uC811\uC18D \uD6C4 \uC218\uB77D/\uAC70\uC808 \uB2F5\uB3C4 \uBD80\uD0C0\uB4DC\uB9BD\uB2C8\uB2E4.\n";
            showLoader(true, "\uC81C\uCD9C \uC911...");
            if (typeof google !== "undefined" && google.script) {
                google.script.run
                    .withSuccessHandler(function(){
                        showLoader(false); fetchData(); closeModal();
                        showKakaoModal(shareText, true);
                    })
                    .withFailureHandler(function(e){ showLoader(false); alert("\uC624\uB958: "+e.message); })
                    .updateTradeInDB(selectedTradeId, { subName:currentUser, subPos:sPos, status:"\uD611\uC758\uC911", desiredShift:fD });
            } else {
                showLoader(false); closeModal(); showKakaoModal(shareText, true);
            }
        }

        function closeModal(){ document.getElementById("support-modal").style.display = "none"; }

        function fetchData() {
            showLoader(true, "\uB370\uC774\uD130 \uB3D9\uAE30\uD654 \uC911...");
            if (typeof google !== "undefined" && google.script) {
                var loaded = 0;
                var total = 3; // 미소지기DB + 교대DB + 출결DB 병렬
                function onAllLoaded() {
                    loaded++;
                    if (loaded >= total) { showLoader(false); buildUserGrid(); renderList(); }
                }

                // 미소지기DB: 세션 캐시 활용 (자주 안 바뀌므로)
                var cachedMiso = sessionStorage.getItem("cgv_miso");
                if (cachedMiso) {
                    try {
                        var parsed = JSON.parse(cachedMiso);
                        if (parsed && parsed.length) {
                            MISO_DATA = parsed;
                            FULL_HOUR_NAMES = parsed.filter(function(m){ return m.hours === "5.5"; }).map(function(m){ return m.name; });
                        }
                    } catch(e) {}
                    onAllLoaded(); // 캐시 있으면 바로 카운트
                } else {
                    google.script.run
                        .withSuccessHandler(function(misoList){
                            if (misoList && misoList.length) {
                                MISO_DATA = misoList;
                                FULL_HOUR_NAMES = misoList.filter(function(m){ return m.hours === "5.5"; }).map(function(m){ return m.name; });
                                sessionStorage.setItem("cgv_miso", JSON.stringify(misoList));
                            }
                            onAllLoaded();
                        })
                        .withFailureHandler(function(){ onAllLoaded(); })
                        .getMisojigiFromDB();
                }

                // 교대DB 병렬 호출
                google.script.run
                    .withSuccessHandler(function(data){
                        trades = (data||[]).filter(function(t){ return t.id && t.reqName && String(t.id).startsWith("TRD"); });
                        onAllLoaded();
                    })
                    .withFailureHandler(function(e){
                        alert("\uB370\uC774\uD130 \uB85C\uB4DC \uC2E4\uD328: " + (e && e.message ? e.message : "\uC54C \uC218 \uC5C6\uB294 \uC624\uB958"));
                        onAllLoaded();
                    })
                    .getTradesFromDB();

                // 출결DB 병렬 호출
                google.script.run
                    .withSuccessHandler(function(attData){
                        if (attData) attendanceData = attData;
                        onAllLoaded();
                    })
                    .withFailureHandler(function(){ onAllLoaded(); })
                    .getAttendanceFromDB();

            } else {
                // 로컬/미리보기 환경: 기본 미소지기 데이터로 채움
                var defaults = [
                    {name:"\uAE40\uD55C\uC194",pos:["\uD1B5\uD569"],hours:"5.5"},
                    {name:"\uC2E0\uC7AC\uC6A9",pos:["\uD1B5\uD569"],hours:"5.5"},
                    {name:"\uBC29\uD68C\uC724",pos:["\uD1B5\uD569"],hours:"4.5"},
                    {name:"\uD64D\uC131\uD604",pos:["\uD1B5\uD569"],hours:"4.5"},
                    {name:"\uD64D\uBBFC\uACBD",pos:["\uD1B5\uD569"],hours:"4.5"},
                    {name:"\uAE40\uB098\uC740",pos:["\uD1B5\uD569"],hours:"4.5"},
                    {name:"\uC815\uD0DC\uBBFC",pos:["\uD1B5\uD569"],hours:"4.5"},
                    {name:"\uC2E0\uBBFC\uACBD",pos:["\uD1B5\uD569"],hours:"5.5"},
                    {name:"\uC870\uB3D9\uC6B0",pos:["\uD1B5\uD569"],hours:"5.5"},
                    {name:"\uC774\uC9C4\uC544",pos:["\uD1B5\uD569"],hours:"4.5"},
                    {name:"\uC774\uC608\uBE48",pos:["\uD1B5\uD569"],hours:"5.5"},
                    {name:"\uC724\uC18C\uC740",pos:["\uD1B5\uD569"],hours:"4.5"},
                    {name:"\uC190\uC815\uD604",pos:["\uB9E4\uC810","\uD50C\uB85C\uC5B4"],hours:"4.5"},
                    {name:"\uC774\uD558\uC728",pos:["\uB9E4\uC810","\uD50C\uB85C\uC5B4"],hours:"4.5"},
                    {name:"\uC1A1\uD574\uC778",pos:["\uB9E4\uC810","\uD50C\uB85C\uC5B4"],hours:"4.5"},
                    {name:"\uCD5C\uC7AC\uC740",pos:["\uD50C\uB85C\uC5B4"],hours:"4.5"}
                ];
                if (!MISO_DATA.length) {
                    MISO_DATA = defaults;
                    FULL_HOUR_NAMES = defaults.filter(function(m){ return m.hours==="5.5"; }).map(function(m){ return m.name; });
                }
                setTimeout(function(){ showLoader(false); buildUserGrid(); renderList(); }, 500);
            }
        }

        function adminApprove(id) {
            if (!confirm("\uD655\uC815\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?")) return;
            showLoader(true);
            google.script.run
                .withSuccessHandler(fetchData)
                .withFailureHandler(function(e){ showLoader(false); alert("\uC2B9\uC778 \uC2E4\uD328: "+e.message); })
                .updateTradeInDB(id, { status:"\uC2B9\uC778\uC644\uB8CC" });
        }

        function adminReject(id) {
            var t = trades.find(function(tr){ return tr.id === id; });
            var reason = prompt("\uBC18\uB824 \uC0AC\uC720\uB97C \uC785\uB825\uD558\uC138\uC694.\n(\uBBF8\uC785\uB825 \uC2DC \uAE30\uBCF8 \uC0AC\uC720\uB85C \uC804\uC1A1)");
            if (reason === null) return;
            var reasonText = reason.trim() || "\uC2A4\uCF00\uC904 \uC870\uC728 \uBD88\uAC00";
            var msg = "\uD83C\uDFAC \uD83D\uDEAB \uC2A4\uCF00\uC904 \uBC18\uB824 \uC548\uB0B4\n"
                +"\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n"
                +getGenderEmoji(t.reqName)+" \uC2E0\uCCAD\uC790  "+t.reqName+"\n"
                +getGenderEmoji(t.subName)+" \uC218\uB77D\uC790  "+t.subName+"\n"
                +"\uD83D\uDCE4 OUT  "+t.shiftDate+"\n"
                +"\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n"
                +"\uD83D\uDEAB \uBC18\uB824 \uC0AC\uC720: "+reasonText+"\n"
                +"\uD83D\uDD04 \uD574\uB2F9 \uACF5\uACE0\uB294 \uB2E4\uC2DC \uBAA8\uC9D1\uC911\uC73C\uB85C \uC804\uD658\uB429\uB2C8\uB2E4.";
            showLoader(true);
            if (typeof google !== "undefined" && google.script) {
                google.script.run
                    .withSuccessHandler(function(){
                        showLoader(false);
                        showKakaoModal(msg, false);
                        fetchData();
                    })
                    .withFailureHandler(function(e){ showLoader(false); alert("\uBC18\uB824 \uC2E4\uD328: "+e.message); })
                    .updateTradeInDB(id, { subName:"\uBAA8\uC9D1\uC911", subPos:"", status:"\uBAA8\uC9D1\uC911", desiredShift:t.desiredShift.replace(" (\uC2DC\uAC04/\uD3EC\uC9C0\uC158 \uACE0\uC815)","") });
            } else {
                showLoader(false);
                showKakaoModal(msg, false);
                fetchData();
            }
        }

        function cancelTrade(id){
            if (!confirm("\uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?")) return;
            showLoader(true);
            google.script.run
                .withSuccessHandler(fetchData)
                .withFailureHandler(function(e){ showLoader(false); alert("\uCDE8\uC18C \uC2E4\uD328: "+e.message); })
                .deleteTradeFromDB(id);
        }

        function handleAgreement(id, action) {
            var t = trades.find(function(i){ return i.id === id; });
            var nS = action === "agree" ? "\uC2B9\uC778\uB300\uAE30" : "\uBC18\uB824\uB428";
            if (action === "reject" && !confirm("\uC815\uB9D0 \uAC70\uC808\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?")) return;

            var shareText = action === "agree"
                ? "\uD83C\uDFAC \u2705 \uAD50\uB300 \uC218\uB77D \uC54C\uB9BC\n"
                  +"\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n"
                  +getGenderEmoji(t.reqName)+" \uC2E0\uCCAD\uC790  "+t.reqName+"\n"
                  +getGenderEmoji(t.subName)+" \uC218\uB77D\uC790  "+t.subName+" ["+(t.subPos||"")+"] \uC218\uB77D!\n"
                  +"\uD83D\uDCE4 OUT  "+t.shiftDate+"\n"
                  +"\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n"
                  +"\uD83D\uDCE2 @ "+t.subName+" \uB2D8 \uC218\uB77D \uAC10\uC0AC\uD569\uB2C8\uB2E4!\n"

                : "\uD83C\uDFAC \u274C \uAD50\uB300 \uAC70\uC808 \uC54C\uB9BC\n"
                  +"\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n"
                  +getGenderEmoji(t.reqName)+" \uC2E0\uCCAD\uC790  "+t.reqName+"\n"
                  +getGenderEmoji(t.subName)+" \uC218\uB77D\uC790  "+t.subName+" \uAC70\uC808\n"
                  +"\uD83D\uDCE4 OUT  "+t.shiftDate+"\n"
                  +"\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n"
                  +"\uD83D\uDCE2 \uD574\uB2F9 \uACF5\uACE0\uB294 \uB2E4\uC2DC \uBAA8\uC9D1\uC911\uC73C\uB85C \uC804\uD658\uB429\uB2C8\uB2E4.\n"
                  ;

            showLoader(true);
            google.script.run
                .withSuccessHandler(function(){
                    showLoader(false);
                    showKakaoModal(shareText, true);
                    fetchData();
                })
                .withFailureHandler(function(e){ showLoader(false); alert("\uCC98\uB9AC \uC2E4\uD328: "+e.message); })
                .updateTradeInDB(id, action==="agree"
                    ? { subName:t.subName, status:nS }
                    : { status:nS });
        }

        function switchTab(tab) {
            if (tab === "manager" && !isAdmin) {
                // 세션에 관리자 인증 저장 여부 확인
                if (sessionStorage.getItem("cgv_admin") === "true") {
                    isAdmin = true;
                } else {
                    // 관리자 PIN 모달 표시
                    pendingAdminTab = true;
                    showAdminPinModal();
                    return;
            }
            document.getElementById("view-trade").classList.toggle("hidden", tab !== "trade");
            document.getElementById("view-manager").classList.toggle("hidden", tab !== "manager");
            document.getElementById("tab-trade-btn").classList.toggle("active", tab === "trade");
            document.getElementById("tab-manager-btn").classList.toggle("active", tab !== "trade");
            renderList();
        }

        function updateAttendance(n, t, a) {
            var now = new Date();
            var wk = getWeekKey(getLocalYYYYMMDD(currentStatsDate));
            if (!attendanceData[n]) attendanceData[n] = {};
            if (!attendanceData[n][wk]) attendanceData[n][wk] = { late:0, absent:0, logs:[] };
            attendanceData[n][wk][t] += a;
            if (attendanceData[n][wk][t] < 0) attendanceData[n][wk][t] = 0;
            var ts = (now.getMonth()+1)+"/"+now.getDate()+" "+now.getHours()+":"+String(now.getMinutes()).padStart(2,"0");
            attendanceData[n][wk].logs.unshift("["+ts+"] "+(t==="late"?"\uC9C0\uAC01":"\uACB0\uADFC")+" "+(a>0?"\uBD80\uC5EC":"\uCC28\uAC10"));
            if (attendanceData[n][wk].logs.length > 5) attendanceData[n][wk].logs.pop();
            // DB에 저장
            if (typeof google !== "undefined" && google.script) {
                var att = attendanceData[n][wk];
                google.script.run
                    .withFailureHandler(function(e){ alert("\uCD9C\uACB0 \uC800\uC7A5 \uC2E4\uD328: "+e.message); })
                    .saveAttendanceToDB(n, wk, att.late, att.absent, att.logs);
            }
            renderStaffStats(); renderList();
        }

        function renderStaffStats() {
            var header = document.getElementById("staff-stats-header");
            var container = document.getElementById("staff-stats-grid");
            if (!container||!header) return;
            var wk = getWeekKey(getLocalYYYYMMDD(currentStatsDate));
            header.innerHTML = "<div class='flex justify-between items-center bg-slate-50 p-3 rounded-2xl border-2 border-slate-200 mb-6 font-black'><button onclick='changeStatsWeek(-1)' class='px-4 py-2.5 bg-white rounded-xl shadow-sm border font-black text-slate-500'>\uC774\uC804 \uC8FC</button><span class='font-black text-lg text-slate-800'>"+wk+"</span><button onclick='changeStatsWeek(1)' class='px-4 py-2.5 bg-white rounded-xl shadow-sm border font-black text-slate-500'>\uB2E4\uC74C \uC8FC</button></div>";
            container.innerHTML = "";
            var statsMap = {};
            MISO_DATA.forEach(function(m){ statsMap[m.name] = { count:0 }; });
            trades.forEach(function(t){
                if (getWeekKey(t.shiftDate) === wk) {
                    if (statsMap[t.reqName]) statsMap[t.reqName].count++;
                    if (t.subName !== "\uBAA8\uC9D1\uC911" && statsMap[t.subName]) statsMap[t.subName].count++;
                }
            });
            MISO_DATA.forEach(function(m){
                if (!attendanceData[m.name]) attendanceData[m.name] = {};
                if (!attendanceData[m.name][wk]) attendanceData[m.name][wk] = { late:0, absent:0, logs:[] };
                var att = attendanceData[m.name][wk];
                var isP = checkPenaltyStatus(m.name);
                var logHtml = att.logs.length
                    ? att.logs.map(function(l){ return "<p class='text-[9px] text-slate-400 font-medium leading-tight mb-1'>- "+l+"</p>"; }).join("")
                    : "<p class='text-[9px] text-slate-300 italic'>\uBCC0\uACBD \uC774\uB825 \uC5C6\uC74C</p>";
                container.innerHTML += "<div class='bg-white rounded-[24px] border-2 shadow-sm flex flex-col justify-between "+(isP?"border-red-400 bg-red-50":"border-slate-200")+" relative overflow-hidden font-black'>"
                    + (isP ? "<div class='bg-red-500 text-white text-[10px] font-black py-1.5 text-center tracking-widest uppercase animate-pulse'>\uC815\uC9C0\uB428</div>" : "")
                    + "<div class='p-5 flex justify-between items-center'>"
                    + "<div><span class='font-black text-lg "+(isP?"text-red-700":"text-slate-900")+"'>"+m.name+"</span><p class='text-[10px] text-slate-400 font-medium'>"+m.pos.join("/")+"</p></div>"
                    + "<span class='text-[10px] bg-slate-100 px-2 py-1 rounded-full font-black text-slate-500'>\uC8FC "+statsMap[m.name].count+"\uAC74</span></div>"
                    + "<div class='border-t-2 border-slate-100 p-4 flex flex-col gap-3'>"
                    + "<div class='flex gap-2'>"
                    + "<div class='flex-1 bg-slate-50 rounded-xl p-2 flex flex-col items-center'><span class='text-[10px] font-black text-slate-500'>\uC9C0\uAC01</span><div class='flex items-center gap-2 mt-1'><button onclick=\"updateAttendance('"+m.name+"','late',-1)\" class='w-6 h-6 bg-white border border-slate-200 rounded-md shadow-sm'>-</button><span class='font-black "+(att.late>0?"text-red-600":"")+"'>"+ att.late+"</span><button onclick=\"updateAttendance('"+m.name+"','late',1)\" class='w-6 h-6 bg-white border border-slate-200 rounded-md shadow-sm'>+</button></div></div>"
                    + "<div class='flex-1 bg-slate-50 rounded-xl p-2 flex flex-col items-center'><span class='text-[10px] font-black text-slate-500'>\uACB0\uADFC</span><div class='flex items-center gap-2 mt-1'><button onclick=\"updateAttendance('"+m.name+"','absent',-1)\" class='w-6 h-6 bg-white border border-slate-200 rounded-md shadow-sm'>-</button><span class='font-black "+(att.absent>0?"text-red-600":"")+"'>"+ att.absent+"</span><button onclick=\"updateAttendance('"+m.name+"','absent',1)\" class='w-6 h-6 bg-white border border-slate-200 rounded-md shadow-sm'>+</button></div></div>"
                    + "</div><div class='bg-gray-100/50 p-3 rounded-lg max-h-[60px] overflow-y-auto'><p class='text-[8px] font-black text-slate-500 uppercase mb-1'>Log</p>"+logHtml+"</div></div></div>";
            });
        }

        function changeStatsWeek(o){ currentStatsDate.setDate(currentStatsDate.getDate()+(o*7)); renderStaffStats(); }

        function rejectAndReopen(id) {
            if (!confirm("\uACF5\uACE0\uB97C \uB2E4\uC2DC \uBAA8\uC9D1\uC911\uC73C\uB85C \uC804\uD658\uD569\uB2C8\uB2E4.\n\uC218\uB77D\uC790 \uC815\uBCF4\uAC00 \uCD08\uAE30\uD654\uB429\uB2C8\uB2E4.")) return;
            showLoader(true);
            google.script.run
                .withSuccessHandler(function(){ showLoader(false); fetchData(); })
                .withFailureHandler(function(e){ showLoader(false); alert("\uC624\uB958: "+e.message); })
                .updateTradeInDB(id, { subName:"\uBAA8\uC9D1\uC911", subPos:"", status:"\uBAA8\uC9D1\uC911" });
        }

        function cleanupOldTrades() {
            if (!confirm("7\uC77C \uC774\uC0C1 \uC9C0\uB09C \uAD50\uB300 \uAE30\uB85D\uC744 DB\uC5D0\uC11C \uC0AD\uC81C\uD569\uB2C8\uB2E4.\n\uC2B9\uC778\uC644\uB8CC \uD3EC\uD568 \uBAA8\uB4E0 \uD574\uB2F9 \uAE30\uB85D\uC774 \uC0AD\uC81C\uB429\uB2C8\uB2E4.\n\uACC4\uC18D\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?")) return;
            showLoader(true, "DB \uC815\uB9AC \uC911...");
            google.script.run
                .withSuccessHandler(function(cnt){
                    showLoader(false);
                    alert(cnt + "\uAC74\uC774 \uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
                    fetchData();
                })
                .withFailureHandler(function(e){ showLoader(false); alert("\uC624\uB958: " + e.message); })
                .deleteOldTrades(7);
        }

        function renderList() {
            var mainBoard = document.getElementById("main-list-board");
            var myBoard = document.getElementById("my-action-list");
            var mgrBoard = document.getElementById("manager-list-board");
            if (!mainBoard||!myBoard||!mgrBoard) return;
            mainBoard.innerHTML = ""; myBoard.innerHTML = ""; mgrBoard.innerHTML = "";
            var active = trades.filter(function(t){ return t.status !== "\uCDE8\uC18C\uB428"; });
            document.getElementById("total-count").innerText = active.length+" \uAC74";

            // 필터 적용
            var filtered = active.filter(function(t){
                if (currentFilter === "mine") return currentUser && (t.reqName === currentUser || t.subName === currentUser);
                if (currentFilter === "open") return t.status === "\uBAA8\uC9D1\uC911";
                if (currentFilter === "nego") return t.status === "\uD611\uC758\uC911";
                if (currentFilter === "wait") return t.status === "\uC2B9\uC778\uB300\uAE30";
                return true;
            });

            // 내 공고를 active 목록 맨 앞으로 정렬 (필터 없을 때만)
            if (currentFilter === "all" && currentUser) {
                filtered.sort(function(a, b){
                    var aM = (a.reqName === currentUser || a.subName === currentUser) ? 0 : 1;
                    var bM = (b.reqName === currentUser || b.subName === currentUser) ? 0 : 1;
                    return aM - bM;
                });
            }

            if (currentUser) {
                var info = MISO_DATA.find(function(m){ return m.name === currentUser; });
                var isP = checkPenaltyStatus(currentUser);
                var pBadge = isP ? "<span class='bg-red-600 text-white px-2 py-0.5 rounded-md ml-2 animate-pulse text-[10px] font-black'>\uC815\uC9C0</span>" : "";
                document.getElementById("name-guide").innerHTML = "<span class='text-blue-600 font-bold'>\uD655\uC778\uB428: "+currentUser+" ("+(info?info.pos.join(", "):"")+") "+pBadge+"</span>";
            }

            var grouped = {};
            var adminGrouped = {};
            for (var ti = 0; ti < filtered.length; ti++) { var t = filtered[ti];
                var isMine = currentUser === t.reqName;
                var isN = t.status === "\uD611\uC758\uC911";
                var isU = t.status === "\uBAA8\uC9D1\uC911";
                var isP2 = t.status === "\uC2B9\uC778\uB300\uAE30";
                var isD = t.status === "\uC2B9\uC778\uC644\uB8CC";
                var isR = t.status === "\uBC18\uB824\uB428";
                var isSub = t.tradeType === "sub";
                var rPL = t.reqPos||"\uBB34\uAD00";
                var safe = t.desiredShift ? String(t.desiredShift) : "\uB0B4\uC6A9 \uC5C6\uC74C";
                var safeDate = t.shiftDate ? String(t.shiftDate) : "\uB0A0\uC9DC \uBBF8\uC815";

                var shareText = "\uD83C\uDFAC "+(isSub?"\uD83D\uDD04 \uB300\uD0C0 \uC694\uCCAD":"\uD83E\uDD1D \uB9DE\uAD50\uB300 \uACF5\uACE0")+"\n"
                    +"\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n"
                    +getGenderEmoji(t.reqName)+" \uC2E0\uCCAD\uC790  "+t.reqName+"\n"
                    +"\uD83D\uDCE4 OUT  "+safeDate+" ["+rPL+"]\n"
                    +(isSub?"\uD83D\uDCE2 \uB300\uC2E0 \uADFC\uBB34\uD574\uC8FC\uC2E4 \uBD84 \uAD6C\uD569\uB2C8\uB2E4!":"\uD83D\uDCE5 IN   "+safe)
                    +"\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n";
                var encText = encodeURIComponent(shareText).replace(/'/g,"%27");

                var outHtml = "<div class='text-slate-800 font-bold mt-1'>"+safeDate+" ["+rPL+"]</div>";
                var inHtml = safe === "\uB300\uD0C0 \uC694\uCCAD" ? "<div class='text-slate-400 italic'>\uB300\uD0C0 \uC694\uCCAD</div>"
                    : safe.split("\n").map(function(l){ return "<div>"+l.trim()+"</div>"; }).join("");

                var isExp = isExpired(safeDate);
                var shiftTs = (function(){ var c=safeDate.split("(")[0].split("/")[0].trim(); var dt=new Date(c); return isNaN(dt.getTime())?999999:dt.getTime(); })();
                var hoursLeft = (shiftTs - new Date().getTime()) / 3600000;
                var isUrgent = isU && hoursLeft > -2 && hoursLeft <= 24;

                // 반려됨 카드 처리
                if (isR) {
                    var rejCardHtml = "<div class='bg-orange-50 rounded-[28px] p-5 border-2 border-orange-300 mb-4 card-shadow'>"
                        + "<div class='flex justify-between items-center mb-3'>"
                        + "<div class='flex items-center gap-2'>"
                        + "<span class='text-[10px] font-black text-orange-600 bg-orange-100 px-3 py-1 rounded-full border border-orange-200'>\uBC18\uB824\uB428</span>"
                        + "<span class='text-[11px] font-black text-slate-700'>"+t.id+"</span></div>"
                        + (isMine ? "<button onclick=\"rejectAndReopen('"+t.id+"')\" class='text-[10px] bg-white text-slate-700 border border-slate-300 px-3 py-1.5 rounded-lg font-black shadow-sm active:scale-95'>\uC7AC\uBAA8\uC9D1 \uD558\uAE30</button>" : "")
                        + "</div>"
                        + "<div class='text-[13px] font-black text-slate-800 mb-1'>"+t.reqName+" \u2192 "+safeDate+"</div>"
                        + "<div class='text-[11px] text-orange-800 font-bold bg-orange-100 px-3 py-2 rounded-xl mt-2'>\uAC70\uC808\uB41C \uC9C0\uC6D0\uC790: "+getGenderEmoji(t.subName)+" "+t.subName+(t.subPos?" ["+t.subPos+"]":"")+"</div>"
                        + (isMine ? "<div class='text-[10px] text-orange-600 font-bold mt-2'>"+"\uC704 \uBC84\uD2BC\uC73C\uB85C \uB2E4\uC2DC \uBAA8\uC9D1\uD558\uAC70\uB098 \uCDE8\uC18C \uBC84\uD2BC\uC73C\uB85C \uCDE8\uC18C\uD558\uC138\uC694.</div>" : "")
                        + (t.subName === currentUser ? "<div class='text-[10px] text-orange-600 font-bold mt-2'>"+"\uC9C0\uC6D0\uC774 \uAC70\uC808\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uB2E4\uB978 \uACF5\uACE0\uC5D0 \uC9C0\uC6D0\uD558\uC138\uC694.</div>" : "")
                        + "</div>";
                    if (isMine || t.subName === currentUser) { myBoard.innerHTML += rejCardHtml; }
                    else {
                        var wkR = getWeekKey(safeDate);
                        if (!grouped[wkR]) grouped[wkR] = [];
                        grouped[wkR].push({ html:rejCardHtml, date:safeDate, pri:99 });
                    }
                    continue;
                }

                // 기간만료 카드: 접기/펴기 형태
                if (isExp && !isD) {
                    var expId = "exp-"+t.id.replace(/[^a-zA-Z0-9]/g,"");
                    var cardHtml = "<details class='mb-4 rounded-[24px] border-2 border-slate-200 bg-slate-50 overflow-hidden opacity-70'>"
                        + "<summary class='flex items-center gap-2 px-4 py-3 cursor-pointer select-none list-none'>"
                        + "<span class='text-[10px] font-black text-slate-400 bg-slate-200 px-2 py-0.5 rounded-md flex-shrink-0'>\uAE30\uAC04\uB9CC\uB8CC</span>"
                        + "<span class='font-black text-slate-600 text-[13px]'>"+t.reqName+"</span>"
                        + "<span class='text-slate-400 text-[12px] ml-1'>\u2192 "+safeDate.split("/")[0].trim()+"</span>"
                        + (isMine ? "<button onclick=\"cancelTrade('"+t.id+"')\" class='ml-auto text-[10px] bg-white text-red-400 border border-red-200 px-2 py-0.5 rounded-md font-black'>\uCDE8\uC18C</button>" : "<span class='ml-auto text-slate-400 text-[10px] flex-shrink-0'>눌러서 보기 ▼</span>")
                        + "</summary>"
                        + "<div class='px-4 pb-4 pt-2 border-t border-slate-200'>"
                        + "<div class='bg-white rounded-2xl p-4 border border-slate-100 space-y-3'>"
                        + "<div><p class='text-[10px] text-red-400 font-black uppercase mb-1'>\uBCF4\uB0BC \uADFC\uBB34(OUT)</p>"+outHtml+"</div>"
                        + "<div class='h-px bg-slate-100'></div>"
                        + "<div><p class='text-[10px] text-blue-400 font-black uppercase mb-1'>"+(isSub?"\uB300\uD0C0":"\uD76C\uB9DD\uADFC\uBB34(IN)")+"</p>"+inHtml+"</div>"
                        + (!isU ? "<div class='text-[11px] text-slate-500 mt-2'>\uC9C0\uC6D0\uC790: "+t.subName+" "+(t.subPos?"["+t.subPos+"]":"")+"</div>" : "")
                        + "</div></div></details>";

                    var wk = getWeekKey(safeDate);
                    if (!grouped[wk]) grouped[wk] = [];
                    grouped[wk].push({ html:cardHtml, date:safeDate });
                    continue;
                }

                // 지원 가능 하이라이트 판단
                var canApply = currentUser && !isMine && isU && !checkPenaltyStatus(currentUser) && (function(){
                    var isTotal = currentUserPos.indexOf("\uD1B5\uD569") > -1;
                    return isTotal || currentUserPos.indexOf(t.reqPos) > -1
                        || (currentUserPos.indexOf("\uB9E4\uC810\uB9C8\uAC10") > -1 && t.reqPos === "\uB9E4\uC810")
                        || (currentUserPos.indexOf("\uB9E4\uC810") > -1 && t.reqPos === "\uB9E4\uC810\uB9C8\uAC10");
                })();
                var isMineCard = currentUser && (t.reqName === currentUser || t.subName === currentUser);
                var cardBorder = canApply ? "border-blue-300 ring-2 ring-blue-100" : isUrgent ? "border-red-400 ring-2 ring-red-100" : isMineCard ? "border-amber-300" : "border-slate-100";
                var cardHtml = "<div class='bg-white rounded-[40px] p-6 sm:p-8 card-shadow border-2 "+cardBorder+" relative overflow-hidden mb-6 "+(isN&&isMine?"my-alert":"")+" transition-all hover:shadow-md'>"
                    + (canApply ? "<div class='absolute top-3 right-4 bg-blue-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm'>\uC9C0\uC6D0\uAC00\uB2A5</div>" : "")
                    + (isUrgent ? "<div class='absolute top-3 right-4 bg-red-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm animate-pulse'>\u26A0\uFE0F \uB9C8\uAC10\uC784\uBC15</div>" : "")
                    + "<div class='absolute top-0 left-0 w-2 h-full "+(isU?(isUrgent?"bg-red-600":"bg-red-500"):isD?"bg-green-500":isP2?"bg-blue-500":"bg-yellow-400")+"'>"+"</div>"
                    + "<div class='flex justify-between items-center mb-6'>"
                    + "<div class='flex items-center gap-2'><span class='px-3 py-1.5 rounded-full text-[11px] font-black "+(isSub?"bg-orange-100 text-orange-600":"bg-slate-800 text-white shadow-sm")+"'>"+(isSub?"\uB300\uD0C0":"\uB9DE\uAD50\uB300")+"</span>"
                    + "<span class='text-[10px] text-slate-400 font-bold bg-slate-50 px-2 py-1 rounded-md border'>"+t.id+"</span></div>"
                    + "<div class='flex items-center gap-2'>"
                    + (isMine ? "<button onclick=\"copyToClipboard(decodeURIComponent('"+encText+"'))\" class='px-3 py-1.5 bg-[#fae100] text-amber-900 rounded-lg text-[10px] font-black border border-yellow-300 shadow-sm active:scale-95'>\uCE74\uD1A1\uACF5\uC720</button>" : "")
                    + "<div class='flex flex-col items-end gap-1'>"
                    + "<span class='status-badge shadow-sm "+(isU?"text-red-600 border-red-200 bg-red-50":isN?"text-yellow-700 border-yellow-200 bg-yellow-50":isP2?"text-blue-700 border-blue-200 bg-blue-50":"text-green-700 border-green-200 bg-green-50")+"'>"+t.status+"</span>"
                    + (isMine&&isU ? "<span class='text-[9px] text-slate-400 font-bold'>\uB0B4 \uACF5\uACE0</span>" : "")
                    + (t.subName===currentUser&&isN ? "<span class='text-[9px] text-blue-500 font-bold'>\uB0B4\uAC00 \uC9C0\uC6D0\uD568</span>" : "")
                    + (isUrgent ? "<span class='text-[9px] text-red-500 font-bold animate-pulse'>D-day \uC784\uBC15</span>" : "")
                    + "</div></div></div>"
                    + "<div class='flex justify-between items-start mb-5'>"
                    + "<div class='flex items-center gap-3'><div class='w-10 h-10 rounded-2xl "+(isSub?"bg-orange-500":"bg-red-600")+" text-white flex items-center justify-center font-black text-[10px] shadow-sm'>\uC2E0\uCCAD</div>"
                    + "<h4 class='text-lg font-black text-slate-800'>"+t.reqName+"</h4></div>"
                    + (isMine&&!isD ? "<button onclick=\"cancelTrade('"+t.id+"')\" class='text-[11px] bg-white text-slate-400 border border-slate-200 px-3 py-1.5 rounded-lg active:scale-95 font-black shadow-sm'>\uCDE8\uC18C</button>" : "")
                    + "</div>"
                    + "<div class='bg-slate-50 p-4 sm:p-5 rounded-[28px] border border-slate-100 space-y-4'>"
                    + "<div><p class='text-[11px] text-red-600 font-black tracking-widest uppercase mb-2'>\uBCF4\uB0BC \uADFC\uBB34 (OUT)</p><div class='bg-white rounded-2xl px-4 py-3 border border-slate-200 shadow-sm'>"+outHtml+"</div></div>"
                    + "<div class='h-px bg-slate-200 w-full'></div>"
                    + "<div><p class='text-[11px] "+(isSub?"text-orange-600":"text-blue-600")+" font-black tracking-widest uppercase mb-2'>"+(isSub?"\uB2E8\uC21C \uB300\uD0C0 \uC694\uCCAD":"\uBC1B\uACE0 \uC2F6\uC740 \uADFC\uBB34 (IN)")+"</p><div class='bg-white rounded-2xl px-4 py-3 border border-slate-200 shadow-sm'>"+inHtml+"</div></div>"
                    + (!isU ? "<div class='mt-4 text-[12px] font-black text-blue-800 bg-blue-100/50 px-4 py-3 rounded-xl border border-blue-200 flex items-center justify-between shadow-inner'><span>\uC9C0\uC6D0\uC790: "+t.subName+" <span class='bg-white px-2 py-0.5 rounded-md shadow-sm border border-blue-100 ml-2 text-[10px] text-blue-600'>"+(t.subPos||"")+"</span></span><span class='text-[9px] bg-blue-600 text-white px-2.5 py-1 rounded-md shadow-sm'>\uB9E4\uCE6D\uB428</span></div>" : "")
                    + "</div>"
                    + "<div class='mt-6 flex gap-3'>"
                    + (isU&&!isMine ? (currentUser ? "<button onclick=\"openSupportModal('"+t.id+"')\" class='w-full "+(isSub?"bg-orange-500 hover:bg-orange-600":"bg-blue-600 hover:bg-blue-700")+" text-white py-4 rounded-2xl font-black transition-all shadow-md'>\uC9C0\uC6D0\uD558\uAE30</button>" : "<div class='w-full bg-slate-100 text-slate-400 py-4 text-center rounded-2xl font-black text-xs uppercase border'>\uC774\uB984 \uC120\uD0DD \uD6C4 \uC9C0\uC6D0 \uAC00\uB2A5</div>") : "")
                    + (isN&&isMine ? "<button onclick=\"handleAgreement('"+t.id+"','agree')\" class='flex-1 bg-green-600 text-white py-4 rounded-2xl font-black shadow-md'>\uC218\uB77D</button><button onclick=\"handleAgreement('"+t.id+"','reject')\" class='flex-1 bg-slate-800 text-white py-4 rounded-2xl font-black shadow-md'>\uAC70\uC808</button>" : "")
                    + "</div></div>";

                if (isN&&isMine) { myBoard.innerHTML += cardHtml; }
                else {
                    var wk = getWeekKey(safeDate);
                    if (!grouped[wk]) grouped[wk] = [];
                    var cardPri = isUrgent?0 : isMine&&isU?1 : isMine?2 : t.subName===currentUser?2 : canApply?3 : isN||isP2?4 : 5;
                    grouped[wk].push({ html:cardHtml, date:safeDate, pri:cardPri });
                }

                if (isP2||isD) {
                    var adminMsg = "\uD83C\uDFAC \u2705 \uAD50\uB300 \uCD5C\uC885 \uD655\uC815!\n"
                        +"\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n"
                        +getGenderEmoji(t.reqName)+" \uC2E0\uCCAD\uC790  "+t.reqName+"\n"
                        +getGenderEmoji(t.subName)+" \uC218\uB77D\uC790  "+t.subName+(t.subPos?" ["+t.subPos+"]":"")+"\n"
                        +"\uD83D\uDCE4 OUT  "+safeDate+" ["+rPL+"]\n"
                        +"\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n"
                        +"\uD83D\uDCE2 \uCD5C\uC885 \uC2B9\uC778 \uC644\uB8CC!\n\u2705 \uC2A4\uCF00\uC904 \uD655\uC815\uB418\uC5C8\uC2B5\uB2C8\uB2E4.";
                    var encAdmin = encodeURIComponent(adminMsg).replace(/'/g,"%27");
                    var aCardHtml = "<div class='bg-white rounded-[40px] p-8 border-4 "+(isD?"border-green-200 bg-green-50/10":"border-blue-100")+" shadow-xl space-y-6'>"
                        + "<span class='text-[10px] font-black "+(isD?"text-green-600":"text-blue-600")+"'>"+(isD?"\uD655\uC815\uC644\uB8CC":"\uC2B9\uC778\uB300\uAE30")+"</span>"
                        + "<div class='bg-slate-50 p-5 rounded-[28px] border border-slate-100'><p class='text-sm font-black text-slate-600 mb-2'>\uC2E0\uCCAD: "+t.reqName+"</p><div class='text-slate-800 font-bold'>"+outHtml+"</div></div>"
                        + "<div class='text-center text-slate-300 text-2xl'>&#8645;</div>"
                        + "<div class='bg-slate-50 p-5 rounded-[28px] border border-slate-100'><p class='text-sm font-black text-slate-600 mb-2'>\uC218\uB77D: "+t.subName+" "+(t.subPos||"")+"</p><div class='text-slate-800 font-bold'>"+inHtml+"</div></div>"
                        + (isD ? "<button onclick=\"adminCopyToClipboard(decodeURIComponent('"+encAdmin+"'))\" class='w-full bg-[#fae100] text-amber-900 py-5 rounded-2xl font-black active:scale-95 shadow-md'>\uCE74\uD1A1 \uACF5\uC720 (\uC2B9\uC778\uC644\uB8CC \uACF5\uC9C0)</button>"
                               : "<div class='flex gap-3'><button onclick=\"adminApprove('"+t.id+"')\" class='flex-1 bg-slate-900 text-white py-5 rounded-2xl font-black shadow-md'>\uCD5C\uC885 \uC2B9\uC778</button><button onclick=\"adminReject('"+t.id+"')\" class='flex-1 bg-red-600 text-white py-5 rounded-2xl font-black shadow-md'>\uBC18\uB824</button></div>")
                        + "</div>";
                    var wkA = getWeekKey(safeDate);
                    if (!adminGrouped[wkA]) adminGrouped[wkA] = [];
                    adminGrouped[wkA].push({ html:aCardHtml, date:safeDate, isDone:isD });
                }
            }

            var currWk = getWeekKey(getLocalYYYYMMDD(new Date()));
            sortWeekKeys(Object.keys(grouped)).forEach(function(key){
                var isThisWk = key === currWk;
                var sec = "<details class='mb-8' "+(isThisWk?"open":"")+">"
                    + "<summary class='flex justify-between items-center bg-white p-4 rounded-[24px] card-shadow border-2 "+(isThisWk?"border-red-200":"border-slate-100")+" cursor-pointer select-none font-black hover:bg-slate-50'>"
                    + "<span class='text-slate-800 text-[15px] leading-snug'>"+key+(isThisWk?"  <span class='text-[10px] text-red-500 font-black'>\uC774\uBC88\uC8FC</span>":"")+"</span>"
                    + "<div class='flex items-center gap-2 flex-shrink-0 ml-2'>"
                    + "<span class='fold-hint'></span>"
                    + "<span class='bg-red-50 text-red-600 text-[11px] px-3 py-1.5 rounded-lg uppercase font-black border border-red-100 shadow-sm'>"+grouped[key].length+"\uAC74</span>"
                    + "</div>"
                    + "</summary><div class='mt-4 px-1'>";
                grouped[key].sort(function(a,b){ return (a.pri||5)-(b.pri||5) || a.date.localeCompare(b.date); }).forEach(function(item){ sec += item.html; });
                sec += "</div></details>";
                mainBoard.innerHTML += sec;
            });

            // 관리자 현황 — 주차별 그룹 접기
            sortWeekKeys(Object.keys(adminGrouped)).forEach(function(key){
                var isThisWkA = key === currWk;
                var doneCount = adminGrouped[key].filter(function(x){ return x.isDone; }).length;
                var waitCount = adminGrouped[key].length - doneCount;
                var secA = "<details class='mb-6' "+(isThisWkA?"open":"")+">"
                    + "<summary class='flex justify-between items-center bg-slate-900 text-white px-5 py-4 rounded-[20px] cursor-pointer select-none font-black'>"
                    + "<span class='text-[13px]'>"+key+(isThisWkA?" <span class='text-red-400 text-[10px]'>\uC774\uBC88\uC8FC</span>":"")+"</span>"
                    + "<div class='flex items-center gap-2'>"
                    + "<span class='fold-hint-dark'></span>"
                    + (waitCount>0?"<span class='bg-blue-500 text-white text-[10px] px-2.5 py-1 rounded-lg font-black'>\uC2B9\uC778\uB300\uAE30 "+waitCount+"</span>":"")
                    + (doneCount>0?"<span class='bg-green-500 text-white text-[10px] px-2.5 py-1 rounded-lg font-black'>\uD655\uC815 "+doneCount+"</span>":"")
                    + "</div></summary>"
                    + "<div class='mt-4 space-y-6 px-1'>";
                adminGrouped[key].sort(function(a,b){ return Number(a.isDone)-Number(b.isDone) || a.date.localeCompare(b.date); }).forEach(function(item){ secA += item.html; });
                secA += "</div></details>";
                mgrBoard.innerHTML += secA;
            });

            renderStaffStats();
            if (!active.length) mainBoard.innerHTML = "<div class='py-24 text-center font-black text-slate-300 uppercase tracking-widest text-xs bg-slate-50 rounded-3xl border border-dashed border-slate-200'>\uB4F1\uB85D\uB41C \uACF5\uACE0\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4</div>";
            if (!mgrBoard.innerHTML) mgrBoard.innerHTML = "<div class='py-24 text-center font-black text-slate-300 uppercase tracking-widest text-xs bg-slate-50 rounded-3xl border border-dashed border-slate-200'>\uB300\uAE30 \uC911\uC778 \uC2B9\uC778 \uC694\uCCAD\uC774 \uC5C6\uC2B5\uB2C8\uB2E4</div>";
        }
    
