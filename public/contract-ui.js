// ═══════════════════════════════════════════════════════════
// 근로계약서 시스템 UI
// 관리자: 발송 + 완료목록 / 미소지기: 서명
// ═══════════════════════════════════════════════════════════
(function() {
  'use strict';

  var _ctrWeeks = [];
  var _ctrSelectedWeek = '';
  var _ctrEmployees = [];
  var _ctrSendStatus = {};   // name → { sentBy, sentAt, signedAt }
  var REPLY_DEADLINE_DAYS = 5;
  var _ctrSelectedNames = {};
  var _ctrCompletedTree = [];
  var _ctrCollapsed = {};
  var _ctrMyList = [];

  // 캔버스 상태
  var _padCtx = { name: null, sig: null };
  var _padDrawing = { name: false, sig: false };
  var _padDirty = { name: false, sig: false };

  // ════════════════════ 관리자 패널 토글 ════════════════════
  window.toggleContractPanel = function() {
    var panel = document.getElementById('contract-panel');
    var arrow = document.getElementById('contract-panel-arrow');
    if (!panel) return;
    var isHidden = panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !isHidden);
    if (arrow) arrow.textContent = isHidden ? '▲' : '▼';
    if (isHidden) {
      loadContractWeeks();
      loadCompletedContracts();
    }
  };

  // ════════════════════ 주차 목록 조회 ════════════════════
  function loadContractWeeks() {
    var sel = document.getElementById('contract-week-select');
    if (!sel) return;
    sel.innerHTML = '<option>불러오는 중...</option>';
    fetch('/api/contracts?mode=weeks')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        _ctrWeeks = Array.isArray(data) ? data : [];
        if (_ctrWeeks.length === 0) {
          sel.innerHTML = '<option value="">주차 없음</option>';
          return;
        }
        sel.innerHTML = '<option value="">주차 선택...</option>' +
          _ctrWeeks.map(function(w) {
            return '<option value="' + w.weekKey + '">' + w.weekKey + '</option>';
          }).join('');
      })
      .catch(function(e) {
        sel.innerHTML = '<option value="">불러오기 실패</option>';
        console.error(e);
      });
  }

  // ════════════════════ 주차 선택 시 ════════════════════
  window.onContractWeekChange = function(weekKey) {
    _ctrSelectedWeek = weekKey;
    _ctrSelectedNames = {};
    var list = document.getElementById('contract-emp-list');
    if (!list) return;
    if (!weekKey) {
      list.innerHTML = '';
      return;
    }
    list.innerHTML = '<p class="text-xs text-slate-400 py-3 text-center">불러오는 중...</p>';
    Promise.all([
      fetch('/api/contracts?mode=list&weekKey=' + encodeURIComponent(weekKey)).then(function(r){return r.json();}),
      fetch('/api/contracts?mode=status&weekKey=' + encodeURIComponent(weekKey)).then(function(r){return r.json();}).catch(function(){return [];})
    ]).then(function(arr) {
      _ctrEmployees = Array.isArray(arr[0]) ? arr[0] : [];
      _ctrSendStatus = {};
      (Array.isArray(arr[1]) ? arr[1] : []).forEach(function(s) { _ctrSendStatus[s.name] = s; });
      renderEmployeeList();
    });
  };

  function renderEmployeeList() {
    var list = document.getElementById('contract-emp-list');
    if (!list) return;
    if (_ctrEmployees.length === 0) {
      list.innerHTML = '<p class="text-xs text-slate-400 py-3 text-center">해당 주차에 계약서가 없습니다</p>';
      return;
    }
    var html = '<div class="flex items-center justify-between mb-2">';
    html += '<button onclick="ctrToggleAll(true)" class="text-[11px] font-black text-blue-600 underline">전체선택</button>';
    html += '<button onclick="ctrToggleAll(false)" class="text-[11px] font-black text-slate-400 underline">전체해제</button>';
    html += '</div>';
    // 상태별 카드 리스트
    html += '<div class="space-y-1.5 mb-3">';
    _ctrEmployees.forEach(function(e) {
      var st = _ctrSendStatus[e.name];
      var selected = !!_ctrSelectedNames[e.name];
      var badge = '', meta = '';
      if (!st) {
        badge = '<span style="background:#f1f5f9;color:#64748b;font-size:10px;font-weight:800;padding:2px 8px;border-radius:10px">미발송</span>';
      } else if (st.signedAt) {
        badge = '<span style="background:#dcfce7;color:#15803d;font-size:10px;font-weight:800;padding:2px 8px;border-radius:10px">✅ 서명완료</span>';
        meta = formatSignedMeta(st);
      } else {
        var info = computeDeadline(st.sentAt);
        badge = info.expired
          ? '<span style="background:#fee2e2;color:#b91c1c;font-size:10px;font-weight:800;padding:2px 8px;border-radius:10px">⚠ 기한초과</span>'
          : '<span style="background:#dbeafe;color:#1d4ed8;font-size:10px;font-weight:800;padding:2px 8px;border-radius:10px">📨 발송됨</span>';
        meta = formatPendingMeta(st, info);
      }
      var border = selected ? '#1d4ed8' : '#e2e8f0';
      var bg = selected ? '#eff6ff' : 'white';
      html += '<div onclick="ctrToggleName(\'' + e.name + '\')" style="cursor:pointer;border:2px solid ' + border + ';background:' + bg + ';border-radius:14px;padding:10px 12px;display:flex;align-items:center;justify-content:space-between;gap:10px" class="active:scale-[0.99]">';
      html += '<div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0">';
      html += '<input type="checkbox" ' + (selected ? 'checked' : '') + ' style="width:16px;height:16px;accent-color:#1d4ed8;pointer-events:none;flex-shrink:0">';
      html += '<div style="min-width:0">';
      html += '<div style="font-weight:900;font-size:13px;color:#0f172a">' + e.name + '</div>';
      if (meta) html += '<div style="font-size:10px;color:#64748b;font-weight:600;margin-top:2px">' + meta + '</div>';
      html += '</div></div>';
      html += badge;
      html += '</div>';
    });
    html += '</div>';
    var count = Object.keys(_ctrSelectedNames).filter(function(k) { return _ctrSelectedNames[k]; }).length;
    html += '<button onclick="ctrSendSelected()" class="w-full btn-c2 btn-c2-primary py-3 rounded-2xl font-black text-sm active:scale-95">';
    html += '📨 선택 발송 (' + count + '명)</button>';
    list.innerHTML = html;
  }

  // ── 발송 상태 유틸 ──
  function fmtDateTime(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var m = String(d.getMonth()+1).padStart(2,'0');
    var dd = String(d.getDate()).padStart(2,'0');
    var hh = String(d.getHours()).padStart(2,'0');
    var mi = String(d.getMinutes()).padStart(2,'0');
    return m + '/' + dd + ' ' + hh + ':' + mi;
  }
  function computeDeadline(sentAtIso) {
    var sent = new Date(sentAtIso);
    var deadline = new Date(sent.getTime() + REPLY_DEADLINE_DAYS * 24 * 60 * 60 * 1000);
    var nowMs = Date.now();
    var diffMs = deadline.getTime() - nowMs;
    var expired = diffMs <= 0;
    var days = Math.floor(Math.abs(diffMs) / (24*60*60*1000));
    var hours = Math.floor((Math.abs(diffMs) % (24*60*60*1000)) / (60*60*1000));
    return { expired: expired, days: days, hours: hours, deadline: deadline };
  }
  function formatPendingMeta(st, info) {
    var s = '발송: ' + fmtDateTime(st.sentAt);
    if (st.sentBy) s += ' · ' + st.sentBy;
    s += ' · ';
    if (info.expired) {
      s += '<span style="color:#dc2626;font-weight:800">기한 ' + info.days + '일 ' + info.hours + '시간 초과</span>';
    } else {
      s += '<span style="color:#15803d;font-weight:800">기한 ' + info.days + '일 ' + info.hours + '시간 남음</span>';
    }
    return s;
  }
  function formatSignedMeta(st) {
    return '발송 ' + fmtDateTime(st.sentAt) + (st.sentBy ? ' · ' + st.sentBy : '') + ' → 서명 ' + fmtDateTime(st.signedAt);
  }

  window.ctrToggleName = function(name) {
    _ctrSelectedNames[name] = !_ctrSelectedNames[name];
    renderEmployeeList();
  };

  window.ctrToggleAll = function(on) {
    _ctrSelectedNames = {};
    if (on) _ctrEmployees.forEach(function(e) { _ctrSelectedNames[e.name] = true; });
    renderEmployeeList();
  };

  var _ctrSending = false;
  window.ctrSendSelected = function() {
    if (_ctrSending) return; // ★ 더블클릭/중복 호출 방지
    var names = Object.keys(_ctrSelectedNames).filter(function(k) { return _ctrSelectedNames[k]; });
    if (names.length === 0) { alert('발송할 대상을 선택하세요'); return; }
    if (!confirm(_ctrSelectedWeek + ' 근로계약서를 ' + names.length + '명에게 발송합니다. 진행할까요?')) return;
    _ctrSending = true;
    var requestedBy = sessionStorage.getItem('cgv_admin_name') || '관리자';
    fetch('/api/contracts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'send', weekKey: _ctrSelectedWeek, names: names, requestedBy: requestedBy })
    })
      .then(function(r) { return r.json(); })
      .then(function(res) {
        if (res.ok) {
          // ★ 발송된 수신자들의 캐시 무효화 → 다음 조회 시 최신 반영
          try {
            names.forEach(function(nm){ localStorage.removeItem('cgv_mycontracts_' + nm); });
          } catch(e) {}
          alert('✅ ' + names.length + '명에게 발송 완료');
          // 발송 상태 즉시 새로고침
          if (_ctrSelectedWeek) window.onContractWeekChange(_ctrSelectedWeek);
        }
        else { alert('❌ 발송 실패: ' + (res.error || '알수없음')); }
      })
      .catch(function(e) { alert('❌ 네트워크 오류: ' + e.message); })
      .finally(function() { _ctrSending = false; });
  };

  // ════════════════════ 완료 목록 (월/주차 트리) ════════════════════
  function loadCompletedContracts() {
    var el = document.getElementById('contract-completed-list');
    if (!el) return;
    el.innerHTML = '<p class="text-xs text-slate-400 py-3 text-center">불러오는 중...</p>';
    fetch('/api/contracts?mode=completed')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        _ctrCompletedTree = Array.isArray(data) ? data : [];
        renderCompletedTree();
      });
  }

  window.refreshCompletedContracts = loadCompletedContracts;

  function renderCompletedTree() {
    var el = document.getElementById('contract-completed-list');
    if (!el) return;
    if (_ctrCompletedTree.length === 0) {
      el.innerHTML = '<p class="text-xs text-slate-400 py-3 text-center">완료된 계약서가 없습니다</p>';
      return;
    }
    var html = '';
    _ctrCompletedTree.forEach(function(monthNode) {
      var monthKey = 'm_' + monthNode.month;
      var mOpen = _ctrCollapsed[monthKey] !== false; // 기본 펼침
      var totalCount = monthNode.weeks.reduce(function(s, w) { return s + w.count; }, 0);
      html += '<div class="border-2 border-slate-100 rounded-2xl overflow-hidden mb-2">';
      html += '<button onclick="ctrToggleMonth(\'' + monthNode.month + '\')" class="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 active:bg-slate-100">';
      html += '<span class="font-black text-slate-800 text-sm">📅 ' + monthNode.month + ' <span class="text-slate-400 text-[11px]">(' + totalCount + '건)</span></span>';
      html += '<span class="text-slate-400 font-black">' + (mOpen ? '▲' : '▼') + '</span>';
      html += '</button>';
      if (mOpen) {
        html += '<div class="px-3 py-2 space-y-1.5">';
        monthNode.weeks.forEach(function(weekNode) {
          var wKey = 'w_' + weekNode.weekKey;
          var wOpen = _ctrCollapsed[wKey] !== false;
          html += '<div class="border border-slate-100 rounded-xl overflow-hidden">';
          html += '<button onclick="ctrToggleWeek(\'' + weekNode.weekKey + '\')" class="w-full flex items-center justify-between px-3 py-2 bg-white active:bg-slate-50">';
          html += '<span class="font-black text-slate-700 text-xs">📂 ' + weekNode.weekKey + ' <span class="text-slate-400">(' + weekNode.count + ')</span></span>';
          html += '<span class="text-slate-400 text-xs">' + (wOpen ? '▲' : '▼') + '</span>';
          html += '</button>';
          if (wOpen) {
            html += '<div class="px-3 py-2 grid grid-cols-2 gap-1.5 bg-slate-50/50">';
            weekNode.files.forEach(function(f) {
              html += '<a href="' + f.url + '" target="_blank" class="flex items-center gap-1.5 bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg text-[11px] font-black text-slate-700 active:scale-95">';
              html += '<span>📄</span><span class="truncate">' + f.name + '</span>';
              html += '</a>';
            });
            html += '</div>';
          }
          html += '</div>';
        });
        html += '</div>';
      }
      html += '</div>';
    });
    el.innerHTML = html;
  }

  window.ctrToggleMonth = function(month) {
    var key = 'm_' + month;
    _ctrCollapsed[key] = _ctrCollapsed[key] === false ? true : false;
    renderCompletedTree();
  };
  window.ctrToggleWeek = function(wk) {
    var key = 'w_' + wk;
    _ctrCollapsed[key] = _ctrCollapsed[key] === false ? true : false;
    renderCompletedTree();
  };

  // ════════════════════ 미소지기: 받은 계약서 ════════════════════
  window.openMyContracts = function() {
    var modal = document.getElementById('my-contracts-modal');
    var list = document.getElementById('my-contracts-list');
    if (!modal || !list) return;
    modal.classList.remove('hidden');
    list.innerHTML = '<p class="text-slate-400 text-sm text-center py-6">불러오는 중...</p>';
    var myName = sessionStorage.getItem('cgv_currentUser') || sessionStorage.getItem('cgv_admin_name');
    if (!myName) {
      list.innerHTML = '<p class="text-slate-400 text-sm text-center py-6">로그인 후 이용해주세요</p>';
      return;
    }
    // ★ 캐시(localStorage)에서 즉시 표시 후 백그라운드 갱신
    var cacheKey = 'cgv_mycontracts_' + myName;
    function renderList(arr) {
      if (!Array.isArray(arr) || arr.length === 0) {
        list.innerHTML = '<p class="text-slate-400 text-sm text-center py-6">받은 계약서가 없습니다</p>';
        return;
      }
      _ctrMyList = arr;
      var html = '';
      arr.forEach(function(c, idx) {
        html += '<div class="border-2 border-blue-200 bg-blue-50 rounded-2xl px-4 py-3 flex items-center justify-between gap-2">';
        html += '<div class="min-w-0 flex-1">';
        html += '<p class="font-black text-slate-900 text-sm truncate">📄 ' + c.weekKey + ' 근로계약서</p>';
        html += '<p class="text-[11px] font-bold text-slate-500">서명 후 제출하면 PDF로 보관됩니다</p>';
        html += '</div>';
        html += '<button onclick="openContractSign(' + idx + ')" class="btn-c2 btn-c2-primary px-4 py-2.5 rounded-xl font-black text-xs active:scale-95 flex-shrink-0">서명하기</button>';
        html += '</div>';
      });
      list.innerHTML = html;
    }
    // 1) 캐시 즉시 표시
    try {
      var cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
      if (cached && Array.isArray(cached.data)) renderList(cached.data);
    } catch(e) {}

    // 2) 백그라운드 fetch (15초 타임아웃)
    var controller = new AbortController();
    var timeoutId = setTimeout(function(){ controller.abort(); }, 15000);
    fetch('/api/contracts?mode=my&name=' + encodeURIComponent(myName), { signal: controller.signal })
      .then(function(r) { return r.json(); })
      .then(function(arr) {
        clearTimeout(timeoutId);
        if (arr && arr.error) {
          if (!localStorage.getItem(cacheKey)) list.innerHTML = '<p class="text-red-500 text-sm text-center py-6">오류: ' + arr.error + '</p>';
          return;
        }
        if (!Array.isArray(arr)) return;
        renderList(arr);
        try { localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: arr })); } catch(e) {}
      })
      .catch(function(e) {
        clearTimeout(timeoutId);
        if (!localStorage.getItem(cacheKey)) {
          list.innerHTML = '<p class="text-red-500 text-sm text-center py-6">오류: ' + (e.name === 'AbortError' ? '응답 지연(15초)' : e.message) + '</p>';
        }
      });
  };

  window.closeMyContractsModal = function() {
    var modal = document.getElementById('my-contracts-modal');
    if (modal) modal.classList.add('hidden');
  };

  // ════════════════════ 계약서 서명 모달 ════════════════════
  window.openContractSign = function(idx) {
    var c = _ctrMyList[idx];
    if (!c) return;
    var modal = document.getElementById('contract-sign-modal');
    var title = document.getElementById('contract-sign-title');
    var preview = document.getElementById('contract-sign-preview');
    if (!modal) return;
    modal.classList.remove('hidden');
    if (title) title.textContent = '📄 ' + c.weekKey + ' 근로계약서 서명';
    // ★ 우리 서버 PDF 프록시 사용 → Google 로그인 팝업 없음 + 모바일 PDF 뷰어 핀치-줌 가능
    var pdfUrl = '/api/contracts/preview?docId=' + encodeURIComponent(c.docId);
    if (preview) preview.src = pdfUrl;
    modal.setAttribute('data-docid', c.docId);
    modal.setAttribute('data-pdfurl', pdfUrl);
    modal.setAttribute('data-weektitle', c.weekKey);
    modal.setAttribute('data-name', c.name);
    modal.setAttribute('data-weekkey', c.weekKey);
    // 캔버스 초기화
    setTimeout(function() {
      initPad('name');
      initPad('sig');
    }, 100);
  };

  window.closeContractSignModal = function() {
    var modal = document.getElementById('contract-sign-modal');
    if (modal) modal.classList.add('hidden');
  };

  // ════════════════════ 캔버스 (이름/서명) ════════════════════
  function initPad(which) {
    var cv = document.getElementById('pad-' + which);
    if (!cv) return;
    // 디바이스 픽셀 비율 보정
    var rect = cv.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    cv.width = rect.width * dpr;
    cv.height = rect.height * dpr;
    var ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.lineWidth = which === 'name' ? 2.5 : 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
    _padCtx[which] = ctx;
    _padDirty[which] = false;
    // 이벤트 바인딩 (중복 방지)
    if (!cv.dataset.bound) {
      var getPos = function(e) {
        var r = cv.getBoundingClientRect();
        var t = e.touches ? e.touches[0] : e;
        return { x: t.clientX - r.left, y: t.clientY - r.top };
      };
      var start = function(e) {
        e.preventDefault();
        _padDrawing[which] = true;
        var p = getPos(e);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
      };
      var move = function(e) {
        if (!_padDrawing[which]) return;
        e.preventDefault();
        var p = getPos(e);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        _padDirty[which] = true;
      };
      var end = function() { _padDrawing[which] = false; };
      cv.addEventListener('mousedown', start);
      cv.addEventListener('mousemove', move);
      cv.addEventListener('mouseup', end);
      cv.addEventListener('mouseleave', end);
      cv.addEventListener('touchstart', start, { passive: false });
      cv.addEventListener('touchmove', move, { passive: false });
      cv.addEventListener('touchend', end);
      cv.dataset.bound = '1';
    }
  }

  window.clearPad = function(which) {
    var cv = document.getElementById('pad-' + which);
    if (!cv) return;
    var ctx = _padCtx[which];
    if (ctx) ctx.clearRect(0, 0, cv.width, cv.height);
    _padDirty[which] = false;
  };

  // 캔버스 → 흰 배경 제거(투명) → base64 PNG
  function padToBase64(which) {
    var cv = document.getElementById('pad-' + which);
    if (!cv) return null;
    // 투명 배경으로 그대로 사용 (이미 transparent)
    return cv.toDataURL('image/png');
  }

  // ════════════════════ FAB: 요청받은 계약서 있을 때만 + 카운트 배지 ════════════════════
  function updateContractFab() {
    var fab = document.getElementById('my-contracts-fab');
    var badge = document.getElementById('my-contracts-fab-badge');
    if (!fab) return;
    var myName = sessionStorage.getItem('cgv_currentUser');
    var isAdmin = sessionStorage.getItem('cgv_admin') === 'true';
    if (!myName || isAdmin) { fab.classList.add('hidden'); return; }

    // 1) 캐시 즉시 사용 (체감속도)
    try {
      var cached = JSON.parse(localStorage.getItem('cgv_mycontracts_' + myName) || 'null');
      if (cached && Array.isArray(cached.data)) {
        applyCount(cached.data.length);
      }
    } catch(e) {}

    // 2) 백그라운드 fetch
    fetch('/api/contracts?mode=my&name=' + encodeURIComponent(myName))
      .then(function(r){ return r.json(); })
      .then(function(arr) {
        if (!Array.isArray(arr)) return;
        try { localStorage.setItem('cgv_mycontracts_' + myName, JSON.stringify({ ts: Date.now(), data: arr })); } catch(e) {}
        applyCount(arr.length);
      })
      .catch(function(){});

    function applyCount(n) {
      if (n > 0) {
        fab.classList.remove('hidden');
        if (badge) {
          badge.classList.remove('hidden');
          badge.style.display = 'flex';
          badge.textContent = n > 99 ? '99+' : String(n);
        }
      } else {
        fab.classList.add('hidden');
        if (badge) badge.classList.add('hidden');
      }
    }
  }
  setTimeout(updateContractFab, 800);
  setInterval(updateContractFab, 60000); // 1분마다 갱신 (덜 자주)

  // 전체화면 PDF 뷰어
  window.openContractPdfFullscreen = function() {
    var modal = document.getElementById('contract-sign-modal');
    var fs = document.getElementById('contract-pdf-fullscreen');
    var ifr = document.getElementById('contract-pdf-iframe');
    var title = document.getElementById('contract-pdf-title');
    if (!modal || !fs || !ifr) return;
    var pdfUrl = modal.getAttribute('data-pdfurl') || '';
    var wk = modal.getAttribute('data-weektitle') || '계약서';
    if (title) title.textContent = '📄 ' + wk + ' 근로계약서';
    ifr.src = pdfUrl;
    fs.classList.remove('hidden');
    fs.style.display = 'block';
  };
  window.closeContractPdfFullscreen = function() {
    var fs = document.getElementById('contract-pdf-fullscreen');
    var ifr = document.getElementById('contract-pdf-iframe');
    if (!fs) return;
    fs.classList.add('hidden');
    fs.style.display = 'none';
    if (ifr) ifr.src = '';
  };

  window.submitContractSign = function() {
    var modal = document.getElementById('contract-sign-modal');
    if (!modal) return;
    if (!_padDirty.name) { alert('이름을 작성해주세요'); return; }
    if (!_padDirty.sig)  { alert('서명을 작성해주세요'); return; }
    var docId = modal.getAttribute('data-docid');
    var name = modal.getAttribute('data-name');
    var weekKey = modal.getAttribute('data-weekkey');
    var nameB64 = padToBase64('name');
    var sigB64 = padToBase64('sig');
    if (!docId || !name || !weekKey || !nameB64 || !sigB64) {
      alert('데이터 누락');
      return;
    }
    var btn = document.getElementById('contract-sign-submit-btn');
    if (btn) { btn.disabled = true; btn.textContent = '서명 처리 중...'; }
    fetch('/api/contracts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'sign',
        docId: docId, name: name, weekKey: weekKey,
        nameImage: nameB64, sigImage: sigB64
      })
    })
      .then(function(r) { return r.json(); })
      .then(function(res) {
        if (btn) { btn.disabled = false; btn.textContent = '✅ 서명 제출하기'; }
        if (res && res.ok) {
          alert('✅ 서명 완료! PDF가 저장되었습니다.');
          // 캐시 무효화 + FAB 즉시 갱신
          try { localStorage.removeItem('cgv_mycontracts_' + name); } catch(e) {}
          closeContractSignModal();
          closeMyContractsModal();
          updateContractFab();
        } else {
          alert('❌ 서명 실패: ' + (res && res.error ? res.error : '알수없음'));
        }
      })
      .catch(function(e) {
        if (btn) { btn.disabled = false; btn.textContent = '✅ 서명 제출하기'; }
        alert('❌ 통신 실패: ' + e.message);
      });
  };
})();
