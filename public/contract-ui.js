// ═══════════════════════════════════════════════════════════
// 근로계약서 시스템 UI
// 관리자: 발송 + 완료목록 / 미소지기: 서명
// ═══════════════════════════════════════════════════════════
(function() {
  'use strict';

  var _ctrWeeks = [];
  var _ctrSelectedWeek = '';
  var _ctrEmployees = [];
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
    fetch('/api/contracts?mode=list&weekKey=' + encodeURIComponent(weekKey))
      .then(function(r) { return r.json(); })
      .then(function(data) {
        _ctrEmployees = Array.isArray(data) ? data : [];
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
    html += '<div class="grid grid-cols-3 gap-1.5 mb-3">';
    _ctrEmployees.forEach(function(e) {
      var checked = _ctrSelectedNames[e.name] ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-slate-700 border-slate-200';
      html += '<button onclick="ctrToggleName(\'' + e.name + '\')" class="px-2 py-2 rounded-xl border-2 text-xs font-black active:scale-95 transition-all ' + checked + '">' + e.name + '</button>';
    });
    html += '</div>';
    var count = Object.keys(_ctrSelectedNames).filter(function(k) { return _ctrSelectedNames[k]; }).length;
    html += '<button onclick="ctrSendSelected()" class="w-full btn-c2 btn-c2-primary py-3 rounded-2xl font-black text-sm active:scale-95">';
    html += '📨 선택 발송 (' + count + '명)</button>';
    list.innerHTML = html;
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
        if (res.ok) { alert('✅ ' + names.length + '명에게 발송 완료'); }
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
    // ★ 발송된 계약서만 조회 (Supabase 기록 기준)
    fetch('/api/contracts?mode=my&name=' + encodeURIComponent(myName))
      .then(function(r) { return r.json(); })
      .then(function(arr) {
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
      })
      .catch(function(e) {
        list.innerHTML = '<p class="text-red-500 text-sm text-center py-6">오류: ' + e.message + '</p>';
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
    // 미리보기: Google Docs 임베드
    var embedUrl = 'https://docs.google.com/document/d/' + c.docId + '/preview';
    if (preview) preview.src = embedUrl;
    modal.setAttribute('data-docid', c.docId);
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

  // ════════════════════ FAB 자동 표시 ════════════════════
  function updateContractFab() {
    var fab = document.getElementById('my-contracts-fab');
    if (!fab) return;
    var myName = sessionStorage.getItem('cgv_currentUser');
    var isAdmin = sessionStorage.getItem('cgv_admin') === 'true';
    // 미소지기 로그인 상태(관리자 아닌)일 때만 표시
    if (myName && !isAdmin) fab.classList.remove('hidden');
    else fab.classList.add('hidden');
  }
  // 페이지 로드 후 + 주기 체크 (세션 변경 대응)
  setTimeout(updateContractFab, 800);
  setInterval(updateContractFab, 3000);

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
          closeContractSignModal();
          closeMyContractsModal();
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
