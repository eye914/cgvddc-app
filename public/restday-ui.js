/* 쉼데이(합의 하 무급휴무) — 관리자 모집·승인 / 미소지기 선착순 신청  → window.RD */
(function () {
  var RD = (window.RD = window.RD || {});
  var POS = ['매점', '플로어', '통합'];

  function tok() { return sessionStorage.getItem('cgv_token') || ''; }
  function isAdmin() { return sessionStorage.getItem('cgv_admin') === 'true'; }
  function me() { return sessionStorage.getItem('cgv_currentUser') || ''; }
  function api(url, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok() }, opts.headers || {});
    return fetch(url, opts).then(function (r) { return r.json(); });
  }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function injectStyle() {
    if (document.getElementById('rd-style')) return;
    var css = '.rd-card{background:#fff;border:1.5px solid #eceff3;border-radius:16px;padding:14px 15px;margin-bottom:10px;box-shadow:0 2px 10px rgba(15,23,42,.05)}'
      + '.rd-top{display:flex;align-items:center;gap:8px;margin-bottom:9px}'
      + '.rd-date{font-size:15.5px;font-weight:900;color:#0f172a}'
      + '.rd-badge{font-size:10px;font-weight:900;padding:3px 9px;border-radius:999px}'
      + '.rd-open{background:#fff1f2;color:#D6001C}.rd-closed{background:#f1f5f9;color:#94a3b8}'
      + '.rd-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}'
      + '.rd-slot{border:1.5px solid #e6eaf0;border-radius:12px;padding:10px 6px;text-align:center;background:#fff}'
      + '.rd-slot.on{border-color:#93c5fd;background:#eff6ff}'
      + '.rd-slot.full{border-color:#eceff3;background:#f7f8fa;opacity:.75}'
      + '.rd-pn{font-size:13px;font-weight:900;color:#1e293b}'
      + '.rd-cnt{font-size:11px;font-weight:800;color:#64748b;margin-top:3px}'
      + '.rd-btn{width:100%;margin-top:8px;padding:9px 0;border:none;border-radius:10px;font-size:11.5px;font-weight:900;cursor:pointer}'
      + '.rd-apply{background:#D6001C;color:#fff;box-shadow:0 2px 8px rgba(214,0,28,.22)}'
      + '.rd-dis{background:#eef0f3;color:#a8b0ba;cursor:default}'
      + '.rd-mine{background:#dbeafe;color:#1d4ed8}'
      + '.rd-names{font-size:11px;font-weight:700;color:#64748b;margin-top:9px;line-height:1.8}'
      + '.rd-chip{display:inline-block;background:#f1f5f9;border-radius:7px;padding:3px 8px;margin:0 4px 4px 0}'
      + '.rd-chip b{color:#1e293b}'
      + '.rd-ok{background:#dcfce7;color:#15803d}.rd-ok b{color:#166534}'
      + '.rd-num{display:flex;align-items:center;gap:6px}'
      + '.rd-num button{width:30px;height:30px;border:1px solid #cbd5e1;background:#fff;border-radius:8px;font-weight:900;font-size:15px;cursor:pointer}'
      + '.rd-num span{min-width:22px;text-align:center;font-weight:900;font-size:14px}';
    var st = document.createElement('style'); st.id = 'rd-style'; st.textContent = css; document.head.appendChild(st);
  }

  /* ═════════ 미소지기: 모집중 목록 + 선착순 신청 ═════════ */
  RD.renderOpen = function (hostId) {
    injectStyle();
    var host = document.getElementById(hostId || 'restday-open');
    if (!host) return;
    if (isAdmin() || !me()) { host.innerHTML = ''; return; }
    api('/api/restday?mode=open').then(function (list) {
      if (!Array.isArray(list) || !list.length) { host.innerHTML = ''; return; }
      host.innerHTML = list.map(cardForStaff).join('');
    }).catch(function () { host.innerHTML = ''; });
  };

  function cardForStaff(p) {
    var mineIn = (p.claims || []).filter(function (c) { return c.name === me(); })[0];
    var slots = POS.map(function (pos) {
      var q = p.quota[pos] || 0;
      if (!q) return '';
      var f = p.filled[pos] || 0;
      var full = f >= q;
      var isMine = mineIn && mineIn.position === pos;
      var btn = isMine
        ? '<button class="rd-btn rd-mine" disabled>신청함</button>'
        : mineIn ? '<button class="rd-btn rd-dis" disabled>-</button>'
          : full ? '<button class="rd-btn rd-dis" disabled>마감</button>'
            : '<button class="rd-btn rd-apply" onclick="RD.claim(\'' + p.id + '\',\'' + pos + '\')">신청</button>';
      return '<div class="rd-slot ' + (isMine ? 'on' : full ? 'full' : '') + '">'
        + '<div class="rd-pn">' + pos + '</div>'
        + '<div class="rd-cnt">' + f + ' / ' + q + '</div>' + btn + '</div>';
    }).join('');
    return '<div class="rd-card" style="border-top:4px solid #D6001C">'
      + '<div class="rd-top"><span class="rd-date">' + esc(p.label) + ' 쉼데이</span>'
      + '<span class="rd-badge rd-open">선착순</span></div>'
      + '<div style="font-size:11px;font-weight:800;color:#94a3b8;margin-bottom:10px">오늘 오전 9시 마감</div>'
      + '<div class="rd-grid">' + slots + '</div></div>';
  }

  RD.claim = function (postId, pos) {
    if (!confirm(pos + ' 쉼데이를 신청할까요?\n선착순이며, 승인 후 확인서 서명이 필요합니다.')) return;
    api('/api/restday', { method: 'POST', body: JSON.stringify({ action: 'claim', postId: postId, position: pos }) })
      .then(function (j) {
        if (j && j.error) { alert(j.error); RD.renderOpen(); return; }
        alert('신청이 완료됐습니다.\n승인되면 알림으로 안내드립니다.');
        RD.renderOpen();
      }).catch(function () { alert('네트워크 오류'); });
  };

  /* ═════════ 관리자: 등록 + 현황 ═════════ */
  var _q = { '매점': 0, '플로어': 0, '통합': 0 };

  RD.renderAdmin = function () {
    injectStyle();
    var host = document.getElementById('restday-admin');
    if (!host) return;
    var today = new Date(); today.setDate(today.getDate() + 1);
    var def = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    var form = '<div class="rd-card">'
      + '<div style="font-size:13px;font-weight:900;color:#0f172a;margin-bottom:10px">🌿 쉼데이 모집 등록</div>'
      + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">'
      +   '<span style="font-size:12px;font-weight:800;color:#475569;min-width:38px">날짜</span>'
      +   '<input type="date" id="rd-date" value="' + def + '" style="flex:1;padding:9px;border:1px solid #cbd5e1;border-radius:9px;font-weight:700;font-size:13px">'
      + '</div>'
      + '<div style="font-size:12px;font-weight:800;color:#475569;margin-bottom:7px">포지션별 정원</div>'
      + POS.map(function (p) {
        return '<div style="display:flex;align-items:center;justify-content:space-between;background:#f8fafc;border-radius:10px;padding:8px 11px;margin-bottom:6px">'
          + '<span style="font-size:13px;font-weight:800;color:#334155">' + p + '</span>'
          + '<div class="rd-num"><button onclick="RD.q(\'' + p + '\',-1)">−</button>'
          + '<span id="rd-q-' + p + '">0</span>'
          + '<button onclick="RD.q(\'' + p + '\',1)">＋</button></div></div>';
      }).join('')
      + '<div style="font-size:11px;font-weight:700;color:#94a3b8;margin:8px 0 10px">마감은 근무 당일 오전 9시로 자동 설정됩니다.</div>'
      + '<button onclick="RD.create()" style="width:100%;padding:13px;background:#D6001C;color:#fff;border:none;border-radius:12px;font-weight:800;font-size:14px">모집 시작 (전체 알림)</button>'
      + '</div>';
    host.innerHTML = form + '<div id="rd-admin-list"><p style="text-align:center;color:#94a3b8;font-size:12px;font-weight:700;padding:14px">불러오는 중…</p></div>';
    POS.forEach(function (p) { _q[p] = 0; });
    RD.loadList();
  };

  RD.q = function (pos, d) {
    _q[pos] = Math.max(0, (_q[pos] || 0) + d);
    var el = document.getElementById('rd-q-' + pos); if (el) el.textContent = _q[pos];
  };

  RD.create = function () {
    var dt = document.getElementById('rd-date');
    if (!dt || !dt.value) { alert('날짜를 선택하세요.'); return; }
    var total = POS.reduce(function (s, p) { return s + (_q[p] || 0); }, 0);
    if (!total) { alert('정원을 1명 이상 설정하세요.'); return; }
    var txt = POS.filter(function (p) { return _q[p] > 0; }).map(function (p) { return p + ' ' + _q[p] + '명'; }).join(' · ');
    if (!confirm(dt.value + '\n' + txt + '\n\n전체 미소지기에게 모집 알림을 보냅니다. 진행할까요?')) return;
    api('/api/restday', { method: 'POST', body: JSON.stringify({ action: 'create', workDate: dt.value, quota: _q }) })
      .then(function (j) {
        if (j && j.error) { alert('오류: ' + j.error); return; }
        alert('모집을 시작했습니다.');
        RD.renderAdmin();
      }).catch(function () { alert('네트워크 오류'); });
  };

  RD.loadList = function () {
    var el = document.getElementById('rd-admin-list'); if (!el) return;
    api('/api/restday?mode=list').then(function (list) {
      if (!Array.isArray(list) || !list.length) {
        el.innerHTML = '<p style="text-align:center;color:#94a3b8;font-size:12px;font-weight:700;padding:14px">등록된 쉼데이가 없습니다.</p>';
        return;
      }
      el.innerHTML = list.map(cardForAdmin).join('') + monthSummary(list);
    }).catch(function () {
      el.innerHTML = '<p style="text-align:center;color:#dc2626;font-size:12px;font-weight:700;padding:14px">불러오기 실패</p>';
    });
  };

  function cardForAdmin(p) {
    var slots = POS.map(function (pos) {
      var q = p.quota[pos] || 0; if (!q) return '';
      var f = p.filled[pos] || 0;
      return '<div class="rd-slot ' + (f >= q ? 'full' : '') + '"><div class="rd-pn">' + pos + '</div>'
        + '<div class="rd-cnt">' + f + ' / ' + q + '</div></div>';
    }).join('');
    var names = (p.claims || []).map(function (c) {
      var ok = c.status === 'approved';
      return '<span class="rd-chip ' + (ok ? 'rd-ok' : '') + '"><b>' + esc(c.name) + '</b> ' + esc(c.position)
        + (ok ? ' ✓' : '') + '</span>';
    }).join('');
    var acts = (p.claims || []).filter(function (c) { return c.status === 'claimed'; }).map(function (c) {
      return '<button onclick="RD.approve(' + c.id + ')" style="margin:0 5px 6px 0;padding:8px 12px;background:#0f172a;color:#fff;border:none;border-radius:10px;font-size:11.5px;font-weight:900">✓ ' + esc(c.name) + ' 승인</button>'
        + '<button onclick="RD.cancelClaim(' + c.id + ',\'' + esc(c.name) + '\')" style="margin:0 8px 6px 0;padding:8px 11px;background:#fff;color:#64748b;border:1.5px solid #e2e8f0;border-radius:10px;font-size:11.5px;font-weight:900">취소</button>';
    }).join('');
    return '<div class="rd-card">'
      + '<div class="rd-top"><span class="rd-date">' + esc(p.label) + '</span>'
      + '<span class="rd-badge ' + (p.status === 'open' && !p.expired ? 'rd-open' : 'rd-closed') + '">'
      + (p.status === 'open' && !p.expired ? '모집중' : '마감') + '</span>'
      + '<span style="margin-left:auto;font-size:10px;color:#94a3b8;font-weight:700">' + esc(p.createdBy || '') + '</span></div>'
      + '<div class="rd-grid">' + slots + '</div>'
      + (names ? '<div class="rd-names">' + names + '</div>' : '<div class="rd-names" style="color:#94a3b8">신청자 없음</div>')
      + (acts ? '<div style="margin-top:9px">' + acts + '</div>' : '')
      + '<button onclick="RD.del(\'' + p.id + '\')" style="width:100%;margin-top:6px;padding:6px;background:transparent;border:none;color:#cbd5e1;font-size:10px;font-weight:900">모집 삭제</button>'
      + '</div>';
  }

  // 이번 달 누적 사용 횟수 (쏠림 확인용)
  function monthSummary(list) {
    var ym = new Date().toISOString().slice(0, 7);
    var cnt = {};
    list.forEach(function (p) {
      if (String(p.workDate).slice(0, 7) !== ym) return;
      (p.claims || []).forEach(function (c) {
        if (c.status === 'canceled') return;
        cnt[c.name] = (cnt[c.name] || 0) + 1;
      });
    });
    var names = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; });
    if (!names.length) return '';
    return '<div class="rd-card" style="background:#f8fafc">'
      + '<div style="font-size:12px;font-weight:900;color:#334155;margin-bottom:7px">이번 달 누적</div>'
      + '<div class="rd-names">' + names.map(function (n) {
        return '<span class="rd-chip"><b>' + esc(n) + '</b> ' + cnt[n] + '회</span>';
      }).join('') + '</div></div>';
  }

  RD.approve = function (claimId) {
    if (!confirm('승인하시겠습니까?\n승인 후 확인서 서명 요청이 발송됩니다.')) return;
    api('/api/restday', { method: 'POST', body: JSON.stringify({ action: 'approve', claimId: claimId }) })
      .then(function (j) { if (j && j.error) { alert(j.error); return; } RD.loadList(); })
      .catch(function () { alert('네트워크 오류'); });
  };
  RD.cancelClaim = function (claimId, name) {
    if (!confirm((name || '') + ' 님의 신청을 취소할까요?')) return;
    api('/api/restday', { method: 'POST', body: JSON.stringify({ action: 'cancelClaim', claimId: claimId }) })
      .then(function (j) { if (j && j.error) { alert(j.error); return; } RD.loadList(); })
      .catch(function () { alert('네트워크 오류'); });
  };
  RD.del = function (postId) {
    if (!confirm('이 모집을 삭제할까요?\n신청 내역도 함께 삭제됩니다.')) return;
    api('/api/restday', { method: 'POST', body: JSON.stringify({ action: 'delete', postId: postId }) })
      .then(function (j) { if (j && j.error) { alert(j.error); return; } RD.loadList(); })
      .catch(function () { alert('네트워크 오류'); });
  };
})();
