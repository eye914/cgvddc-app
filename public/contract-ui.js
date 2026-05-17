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
  var _ctrStatusFilter = 'all'; // all | unsent | sent | signed
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
    // 1) 상태별 카운트
    var counts = { all: _ctrEmployees.length, unsent: 0, sent: 0, signed: 0 };
    _ctrEmployees.forEach(function(e) {
      var st = _ctrSendStatus[e.name];
      if (!st) counts.unsent++;
      else if (st.signedAt) counts.signed++;
      else counts.sent++;
    });

    // 2) 필터 칩
    var html = '';
    html += '<div style="display:flex;gap:4px;margin-bottom:8px;overflow-x:auto;-webkit-overflow-scrolling:touch;padding:2px">';
    [
      { k:'all',    label:'전체',   c:counts.all,    color:'#0f172a' },
      { k:'unsent', label:'미발송', c:counts.unsent, color:'#64748b' },
      { k:'sent',   label:'발송됨', c:counts.sent,   color:'#1d4ed8' },
      { k:'signed', label:'완료',   c:counts.signed, color:'#15803d' }
    ].forEach(function(f) {
      var active = _ctrStatusFilter === f.k;
      var bg = active ? f.color : '#f1f5f9';
      var fg = active ? 'white'  : f.color;
      html += '<button onclick="ctrSetStatusFilter(\'' + f.k + '\')" style="flex-shrink:0;padding:6px 12px;border-radius:999px;border:none;background:' + bg + ';color:' + fg + ';font-weight:800;font-size:11px;cursor:pointer">' + f.label + ' ' + f.c + '</button>';
    });
    html += '</div>';

    // 3) 전체선택/해제
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;padding:0 2px">';
    html += '<button onclick="ctrToggleAll(true)" style="font-size:11px;font-weight:800;color:#1d4ed8;text-decoration:underline;background:none;border:none;padding:0;cursor:pointer">전체선택</button>';
    html += '<button onclick="ctrToggleAll(false)" style="font-size:11px;font-weight:800;color:#94a3b8;text-decoration:underline;background:none;border:none;padding:0;cursor:pointer">전체해제</button>';
    html += '</div>';

    // 4) 필터된 명단 (컴팩트 리스트 한 줄 = 38px)
    var filtered = _ctrEmployees.filter(function(e) {
      if (_ctrStatusFilter === 'all') return true;
      var st = _ctrSendStatus[e.name];
      if (_ctrStatusFilter === 'unsent') return !st;
      if (_ctrStatusFilter === 'signed') return st && st.signedAt;
      if (_ctrStatusFilter === 'sent')   return st && !st.signedAt;
      return true;
    });

    html += '<div style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;background:white;margin-bottom:10px">';
    if (filtered.length === 0) {
      html += '<div style="padding:18px;text-align:center;color:#94a3b8;font-size:12px;font-weight:700">해당 상태의 인원이 없습니다</div>';
    } else {
      filtered.forEach(function(e, i) {
        var st = _ctrSendStatus[e.name];
        var selected = !!_ctrSelectedNames[e.name];
        var statusHtml = '', titleTip = '';
        if (!st) {
          statusHtml = '<span style="color:#94a3b8;font-size:10px;font-weight:700">미발송</span>';
        } else if (st.signedAt) {
          var sdt = fmtDateTime(st.signedAt);
          statusHtml = '<span style="color:#15803d;font-size:11px;font-weight:800">✅</span><span style="color:#64748b;font-size:10px;font-weight:700;margin-left:4px">' + sdt + '</span>';
          titleTip = '발송 ' + fmtDateTime(st.sentAt) + (st.sentBy ? ' · ' + st.sentBy : '') + ' → 서명 ' + sdt;
        } else {
          var info = computeDeadline(st.sentAt);
          var color = info.expired ? '#dc2626' : '#1d4ed8';
          var icon = info.expired ? '⚠' : '📨';
          var remain = info.expired ? ('초과 ' + info.days + 'd') : ('D-' + info.days);
          statusHtml = '<span style="color:' + color + ';font-size:11px;font-weight:800">' + icon + '</span><span style="color:' + color + ';font-size:10px;font-weight:800;margin-left:4px">' + remain + '</span>';
          titleTip = '발송 ' + fmtDateTime(st.sentAt) + (st.sentBy ? ' · ' + st.sentBy : '');
        }
        var rowBg = selected ? '#eff6ff' : (i % 2 === 1 ? '#fafbfc' : 'white');
        html += '<div onclick="ctrToggleName(\'' + e.name + '\')" title="' + titleTip + '" ';
        html += 'style="display:flex;align-items:center;gap:10px;padding:9px 12px;border-top:' + (i === 0 ? 'none' : '1px solid #f1f5f9') + ';background:' + rowBg + ';cursor:pointer">';
        html += '<input type="checkbox" ' + (selected ? 'checked' : '') + ' style="width:15px;height:15px;accent-color:#1d4ed8;pointer-events:none;flex-shrink:0">';
        html += '<span style="font-weight:800;font-size:13px;color:#0f172a;flex:1;min-width:0">' + e.name + '</span>';
        html += '<span style="display:flex;align-items:center;gap:2px;flex-shrink:0">' + statusHtml + '</span>';
        html += '</div>';
      });
    }
    html += '</div>';

    var count = Object.keys(_ctrSelectedNames).filter(function(k) { return _ctrSelectedNames[k]; }).length;
    var btnDisabled = count === 0;
    html += '<button onclick="ctrSendSelected()" ' + (btnDisabled ? 'disabled' : '') + ' style="width:100%;padding:14px;border-radius:14px;border:none;font-weight:900;font-size:14px;cursor:' + (btnDisabled ? 'not-allowed' : 'pointer') + ';background:' + (btnDisabled ? '#cbd5e1' : '#e71a0f') + ';color:white;transition:all 0.15s">📨 선택 발송 (' + count + '명)</button>';
    list.innerHTML = html;
  }

  window.ctrSetStatusFilter = function(k) {
    _ctrStatusFilter = k;
    renderEmployeeList();
  };

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

  // Drive 직접 다운로드 URL (link 공유된 파일은 인증 없이 다운로드)
  function ctrDownloadUrl(fileId) {
    return 'https://drive.google.com/uc?export=download&id=' + encodeURIComponent(fileId);
  }

  // 순차 다운로드 (브라우저 팝업 차단 회피)
  function ctrSequentialDownload(files, delayMs) {
    delayMs = delayMs || 400;
    files.forEach(function(f, i) {
      setTimeout(function() {
        var a = document.createElement('a');
        a.href = ctrDownloadUrl(f.fileId);
        a.download = f.name || ('contract_' + (i+1) + '.pdf');
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        setTimeout(function(){ a.remove(); }, 500);
      }, i * delayMs);
    });
  }

  window.ctrDownloadOne = function(fileId, fileName) {
    var a = document.createElement('a');
    a.href = ctrDownloadUrl(fileId);
    a.download = fileName || 'contract.pdf';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    setTimeout(function(){ a.remove(); }, 500);
  };

  window.ctrDownloadWeek = function(weekKey) {
    var found = null;
    _ctrCompletedTree.forEach(function(m) {
      m.weeks.forEach(function(w) { if (w.weekKey === weekKey) found = w; });
    });
    if (!found || !found.files || found.files.length === 0) { alert('다운로드할 계약서가 없습니다'); return; }
    if (!confirm(weekKey + ' 의 계약서 ' + found.files.length + '개를 모두 저장합니다. 진행할까요?')) return;
    ctrSequentialDownload(found.files);
  };

  window.ctrDownloadMonth = function(month) {
    var monthNode = _ctrCompletedTree.find(function(m){ return m.month === month; });
    if (!monthNode) return;
    var allFiles = [];
    monthNode.weeks.forEach(function(w){ (w.files || []).forEach(function(f){ allFiles.push(f); }); });
    if (allFiles.length === 0) { alert('다운로드할 계약서가 없습니다'); return; }
    if (!confirm(month + ' 의 계약서 ' + allFiles.length + '개를 모두 저장합니다. 진행할까요?')) return;
    ctrSequentialDownload(allFiles, 500);
  };

  // 파일명에서 이름만 추출: "[서명완료] 김한솔 5월1주차.pdf" → "김한솔"
  function extractPersonName(fileName) {
    return String(fileName || '')
      .replace(/\.[a-z]+$/i, '')
      .replace(/^\[?서명완료\]?\s*/, '')
      .replace(/\s*\d+주차.*$/, '')
      .replace(/\s*\d+년\d+월.*$/, '')
      .trim();
  }

  function renderCompletedTree() {
    var el = document.getElementById('contract-completed-list');
    if (!el) return;
    if (_ctrCompletedTree.length === 0) {
      el.innerHTML = '<p style="text-align:center;padding:20px;color:#94a3b8;font-size:12px;font-weight:700">완료된 계약서가 없습니다</p>';
      return;
    }
    var html = '';
    _ctrCompletedTree.forEach(function(monthNode) {
      var monthKey = 'm_' + monthNode.month;
      var mOpen = _ctrCollapsed[monthKey] !== false;
      var totalCount = monthNode.weeks.reduce(function(s, w) { return s + w.count; }, 0);

      // 월 헤더 - 한 줄
      html += '<div style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:8px;background:white">';
      html += '<div style="display:flex;align-items:center;background:#f8fafc;height:40px">';
      html += '<button onclick="ctrToggleMonth(\'' + monthNode.month + '\')" style="flex:1;display:flex;align-items:center;justify-content:space-between;padding:0 12px;height:100%;border:none;background:transparent;cursor:pointer">';
      html += '<span style="font-weight:800;color:#0f172a;font-size:13px">' + monthNode.month + ' <span style="color:#94a3b8;font-size:11px;font-weight:700">(' + totalCount + ')</span></span>';
      html += '<span style="color:#94a3b8;font-size:11px">' + (mOpen ? '▲' : '▼') + '</span>';
      html += '</button>';
      html += '<button onclick="ctrDownloadMonth(\'' + monthNode.month + '\')" title="월 전체 저장" style="height:28px;padding:0 10px;margin-right:8px;font-size:11px;font-weight:800;color:white;background:#0ea5e9;border:none;border-radius:8px;cursor:pointer">⬇ 월</button>';
      html += '</div>';

      if (mOpen) {
        html += '<div style="padding:6px 8px">';
        monthNode.weeks.forEach(function(weekNode) {
          var wKey = 'w_' + weekNode.weekKey;
          var wOpen = _ctrCollapsed[wKey] !== false;

          html += '<div style="border:1px solid #f1f5f9;border-radius:10px;overflow:hidden;margin-bottom:4px">';
          // 주차 헤더 - 한 줄
          html += '<div style="display:flex;align-items:center;background:white;height:34px">';
          html += '<button onclick="ctrToggleWeek(\'' + weekNode.weekKey + '\')" style="flex:1;display:flex;align-items:center;justify-content:space-between;padding:0 10px;height:100%;border:none;background:transparent;cursor:pointer">';
          html += '<span style="font-weight:700;color:#334155;font-size:12px">' + weekNode.weekKey + ' <span style="color:#94a3b8;font-weight:600">(' + weekNode.count + ')</span></span>';
          html += '<span style="color:#cbd5e1;font-size:10px">' + (wOpen ? '▲' : '▼') + '</span>';
          html += '</button>';
          html += '<button onclick="ctrDownloadWeek(\'' + weekNode.weekKey + '\')" title="주차 전체 저장" style="height:24px;padding:0 8px;margin-right:6px;font-size:10px;font-weight:800;color:white;background:#22c55e;border:none;border-radius:6px;cursor:pointer">⬇</button>';
          html += '</div>';

          if (wOpen) {
            html += '<div style="background:#fafbfc;border-top:1px solid #f1f5f9">';
            (weekNode.files || []).forEach(function(f, i) {
              var personName = extractPersonName(f.name);
              var safeFileName = (f.name || '').replace(/\\/g, '\\\\').replace(/\'/g, "\\'");
              html += '<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-top:' + (i === 0 ? 'none' : '1px solid #f1f5f9') + '">';
              html += '<a href="' + ctrDownloadUrl(f.fileId) + '" target="_blank" rel="noopener" style="flex:1;min-width:0;font-size:12px;font-weight:700;color:#0f172a;text-decoration:none;display:flex;align-items:center;gap:6px" title="' + f.name + '">';
              html += '<span style="color:#15803d">✅</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + personName + '</span>';
              html += '</a>';
              html += '<button onclick="ctrDownloadOne(\'' + f.fileId + '\', \'' + safeFileName + '\')" title="저장" style="height:24px;width:30px;font-size:11px;font-weight:800;color:#475569;background:white;border:1px solid #cbd5e1;border-radius:6px;cursor:pointer;flex-shrink:0">⬇</button>';
              html += '</div>';
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
      // 미서명 먼저, 서명완료 뒤
      var pending = arr.filter(function(c){ return !c.signedAt; });
      var signed  = arr.filter(function(c){ return !!c.signedAt; });
      var html = '';
      if (pending.length) {
        html += '<p class="text-[11px] font-black text-slate-500 px-1 mb-2">📨 서명 대기 (' + pending.length + ')</p>';
        pending.forEach(function(c) {
          var idx = arr.indexOf(c);
          html += '<div class="border-2 border-blue-300 bg-blue-50 rounded-2xl px-4 py-3 flex items-center justify-between gap-2 mb-2">';
          html += '<div class="min-w-0 flex-1">';
          html += '<p class="font-black text-slate-900 text-sm truncate">📄 ' + c.weekKey + ' 근로계약서</p>';
          html += '<p class="text-[11px] font-bold text-slate-500">서명 후 제출 → PDF 자동 저장</p>';
          html += '</div>';
          html += '<button onclick="openContractSign(' + idx + ')" class="btn-c2 btn-c2-primary px-4 py-2.5 rounded-xl font-black text-xs active:scale-95 flex-shrink-0">서명하기</button>';
          html += '</div>';
        });
      }
      if (signed.length) {
        html += '<p class="text-[11px] font-black text-slate-500 px-1 mt-3 mb-2">✅ 서명 완료 (' + signed.length + ')</p>';
        signed.forEach(function(c) {
          var idx = arr.indexOf(c);
          var sd = new Date(c.signedAt);
          var sdStr = isNaN(sd) ? '' : ((sd.getMonth()+1)+'/'+sd.getDate()+' '+String(sd.getHours()).padStart(2,'0')+':'+String(sd.getMinutes()).padStart(2,'0'));
          html += '<div class="border-2 border-emerald-200 bg-emerald-50 rounded-2xl px-4 py-3 flex items-center justify-between gap-2 mb-2">';
          html += '<div class="min-w-0 flex-1">';
          html += '<p class="font-black text-slate-900 text-sm truncate">📄 ' + c.weekKey + ' 근로계약서</p>';
          html += '<p class="text-[11px] font-bold text-emerald-700">✅ 서명완료 · ' + sdStr + '</p>';
          html += '</div>';
          html += '<button onclick="openSignedPdf(' + idx + ')" class="bg-white text-emerald-700 border-2 border-emerald-300 px-4 py-2.5 rounded-xl font-black text-xs active:scale-95 flex-shrink-0">PDF 보기</button>';
          html += '</div>';
        });
      }
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
        var pc = cached.data.filter(function(c){ return !c.signedAt; }).length;
        applyCount(pc);
      }
    } catch(e) {}

    // 2) 백그라운드 fetch (FAB는 미서명 개수만 카운트)
    fetch('/api/contracts?mode=my&name=' + encodeURIComponent(myName))
      .then(function(r){ return r.json(); })
      .then(function(arr) {
        if (!Array.isArray(arr)) return;
        try { localStorage.setItem('cgv_mycontracts_' + myName, JSON.stringify({ ts: Date.now(), data: arr })); } catch(e) {}
        var pendingCount = arr.filter(function(c){ return !c.signedAt; }).length;
        applyCount(pendingCount);
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

  // 전체화면 PDF 뷰어 (툴바 숨김 + 워터마크)
  window.openContractPdfFullscreen = function() {
    var modal = document.getElementById('contract-sign-modal');
    var fs = document.getElementById('contract-pdf-fullscreen');
    var ifr = document.getElementById('contract-pdf-iframe');
    var title = document.getElementById('contract-pdf-title');
    var wmEl = document.getElementById('contract-pdf-watermark');
    if (!modal || !fs || !ifr) return;
    var pdfUrl = modal.getAttribute('data-pdfurl') || '';
    var wk = modal.getAttribute('data-weektitle') || '계약서';
    if (title) title.textContent = '📄 ' + wk + ' 근로계약서';
    // ★ PDF 뷰어 툴바/네비/스크롤바 숨김 (저장·인쇄 버튼 노출 억제)
    var hashedUrl = pdfUrl + '#toolbar=0&navpanes=0&statusbar=0&messages=0&scrollbar=1';
    ifr.src = hashedUrl;
    // 워터마크 (스크린샷 억제 + 식별)
    if (wmEl) {
      var who = sessionStorage.getItem('cgv_currentUser') || '';
      var now = new Date();
      var stamp = (now.getMonth()+1) + '/' + now.getDate() + ' ' + String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
      var html = '';
      for (var i = 0; i < 18; i++) {
        html += '<div style="transform:rotate(-25deg);font-size:20px;font-weight:900;color:#000;white-space:nowrap;padding:30px">' + who + ' · ' + stamp + ' · CGV동두천</div>';
      }
      wmEl.innerHTML = html;
    }
    fs.classList.remove('hidden');
    fs.style.display = 'block';
  };
  // 서명완료 PDF 보기 (전체화면 모달 재사용)
  window.openSignedPdf = function(idx) {
    var c = _ctrMyList[idx];
    if (!c) return;
    var signModal = document.getElementById('contract-sign-modal');
    // sign 모달 속성에 임시로 데이터 세팅 (전체화면 모달이 거기서 읽음)
    if (signModal) {
      signModal.setAttribute('data-pdfurl', '/api/contracts/preview?docId=' + encodeURIComponent(c.docId));
      signModal.setAttribute('data-weektitle', c.weekKey + ' [서명완료]');
    }
    window.openContractPdfFullscreen();
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
    if (btn) { btn.disabled = true; }
    // 진행 단계 메시지 회전 (체감 대기시간 단축)
    var steps = [
      '🔐 서명 이미지 업로드 중... (1/4)',
      '📄 계약서에 서명 삽입 중... (2/4)',
      '📥 PDF 생성 중... (3/4)',
      '💾 저장 중... (4/4)'
    ];
    var stepIdx = 0;
    if (btn) btn.textContent = steps[0];
    var stepTimer = setInterval(function(){
      stepIdx = Math.min(stepIdx + 1, steps.length - 1);
      if (btn) btn.textContent = steps[stepIdx];
    }, 2200);
    function stopSteps(){ clearInterval(stepTimer); }
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
        stopSteps(); if (btn) { btn.disabled = false; btn.textContent = '✅ 서명 제출하기'; }
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
        stopSteps(); if (btn) { btn.disabled = false; btn.textContent = '✅ 서명 제출하기'; }
        alert('❌ 통신 실패: ' + e.message);
      });
  };
})();
