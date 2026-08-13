/* 월말평가 (관리자) — window.EV.open() */
(function () {
  var EV = (window.EV = window.EV || {});
  function tok() { return sessionStorage.getItem('cgv_token') || ''; }
  function me() { return sessionStorage.getItem('cgv_admin_name') || '관리자'; }
  function api(url, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok() }, opts.headers || {});
    return fetch(url, opts).then(function (r) { return r.json(); });
  }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  var LETTERS = ['S', 'A', 'B', 'C', 'D', 'F'];
  var LETTER = { S: 100, A: 90, B: 80, C: 70, D: 60, F: 50 };
  var CRI = [
    { key: 'notice', sub: '이벤트·공지사항 숙지', w: 10, kind: 'notice' },
    { key: 'kakao', sub: '카톡공지 숙지', w: 10, kind: 'letter' },
    { key: 'service', sub: '서비스 태도', w: 20, kind: 'letter' },
    { key: 'active', sub: '적극적 태도', w: 20, kind: 'letter' },
    { key: 'rule', sub: '내부 규정 준수', w: 10, kind: 'letter' },
    { key: 'groom', sub: '유니폼·개인위생', w: 10, kind: 'letter' },
    { key: 'late', sub: '지각', w: 10, kind: 'late' },
    { key: 'absent', sub: '결근', w: 10, kind: 'absent' }
  ];
  function autoS(kind, c) {
    if (kind === 'late') return Math.max(0, 100 - 15 * (c.lateN || 0));
    if (kind === 'absent') return Math.max(0, 100 - 50 * (c.absentN || 0));
    if (kind === 'notice') return (c.noticeReq || 0) <= 0 ? 100 : Math.round((c.noticeSigned || 0) / c.noticeReq * 100);
    return 0;
  }
  // 대타/교대 수락 보너스 — 서버(lib/evalConfig.ts)와 반드시 동일해야 최종 순위와 어긋나지 않음
  var SUB_BONUS_PER = 3, SUB_BONUS_CAP = 12;
  function subBonus(n) { return Math.min((n || 0) * SUB_BONUS_PER, SUB_BONUS_CAP); }
  var _period, _data, _tab = 'targets', _managers = [];

  EV.open = function () {
    if (!_period) { var d = new Date(); _period = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
    var ov = document.getElementById('ev-ov');
    if (!ov) {
      ov = document.createElement('div'); ov.id = 'ev-ov';
      ov.style.cssText = 'position:fixed;inset:0;z-index:99990;background:#f4f5f7;overflow:auto;overscroll-behavior:contain;font-family:Pretendard,-apple-system,\'Malgun Gothic\',sans-serif;color:#1f2937';
      ov.innerHTML = '<div id="ev-root" style="max-width:520px;margin:0 auto;padding:14px 14px 70px"></div>';
      document.body.appendChild(ov); document.body.style.overflow = 'hidden';
    }
    load();
  };
  EV.close = function () { var o = document.getElementById('ev-ov'); if (o) o.remove(); document.body.style.overflow = ''; };
  EV.setPeriod = function (p) { if (p) { _period = p; load(); } };
  EV.tab = function (t) { _tab = t; render(); if (t === 'rank') loadRank(); };

  function load() {
    var root = document.getElementById('ev-root'); if (root) root.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:40px">불러오는 중…</div>';
    Promise.all([api('/api/eval?action=managers'), api('/api/eval?action=overview&period=' + _period)])
      .then(function (r) { _managers = Array.isArray(r[0]) ? r[0] : []; _data = r[1] || {}; _tgtVals = {}; render(); if (_tab === 'rank') loadRank(); })
      .catch(function () { if (root) root.innerHTML = '<div style="color:#dc2626;text-align:center;padding:40px">불러오기 실패</div>'; });
  }

  function header() {
    var st = (_data.period && _data.period.status) || 'none';
    var stBadge = st === 'open' ? '<span style="background:#dcfce7;color:#16a34a;font-size:11px;font-weight:800;padding:3px 10px;border-radius:7px">● 평가중</span>'
      : st === 'closed' ? '<span style="background:#e2e8f0;color:#475569;font-size:11px;font-weight:800;padding:3px 10px;border-radius:7px">● 마감</span>'
        : '<span style="background:#fef9c3;color:#854d0e;font-size:11px;font-weight:800;padding:3px 10px;border-radius:7px">● 미오픈</span>';
    var openBtn = st === 'open'
      ? '<button onclick="EV.close_()" style="flex:1;padding:11px;background:#0f172a;color:#fff;border:none;border-radius:11px;font-weight:800">평가 마감 + 순위 확정</button>'
      : '<button onclick="EV.open_()" style="flex:1;padding:11px;background:#D6001C;color:#fff;border:none;border-radius:11px;font-weight:800">' + (st === 'closed' ? '재오픈' : '평가 오픈 (관리자 알림)') + '</button>';
    var tabBtn = function (id, label) { return '<button onclick="EV.tab(\'' + id + '\')" style="flex:1;padding:9px;border:none;border-radius:9px;font-size:13px;font-weight:800;background:' + (_tab === id ? '#fff' : 'transparent') + ';color:' + (_tab === id ? '#D6001C' : '#8a8a90') + ';box-shadow:' + (_tab === id ? '0 1px 3px rgba(0,0,0,.1)' : 'none') + '">' + label + '</button>'; };
    return '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'
      + '<div style="font-size:18px;font-weight:800">📋 월말평가</div>'
      + '<button onclick="EV.close()" style="border:none;background:#e9e9ee;width:32px;height:32px;border-radius:50%;font-size:17px;color:#64748b">×</button></div>'
      + '<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">'
      + '<input type="month" value="' + _period + '" onchange="EV.setPeriod(this.value)" style="flex:1;padding:9px;border:1px solid #e2e8f0;border-radius:9px;font-size:14px">' + stBadge + '</div>'
      + (_data.isSuper ? '<div style="display:flex;gap:8px;margin-bottom:10px">' + openBtn + '</div>' : '')
      + '<div style="display:flex;gap:6px;background:#ececef;border-radius:11px;padding:3px;margin-bottom:12px">'
      + (_data.isSuper ? (tabBtn('targets', '① 대상선정') + tabBtn('assign', '② 배정') + tabBtn('mine', '③ 평가') + tabBtn('rank', '순위')) : tabBtn('mine', '내 평가')) + '</div>';
  }

  function render() {
    var root = document.getElementById('ev-root'); if (!root) return;
    if (!_data.isSuper && _tab !== 'mine') _tab = 'mine';
    var body = _tab === 'targets' ? targetsView() : _tab === 'assign' ? assignView() : _tab === 'mine' ? mineView() : (progressHtml() + rookieView() + '<div id="ev-rank" style="margin-top:12px">불러오는 중…</div>');
    root.innerHTML = header() + body;
  }

  // ── ① 대상선정 ──
  function targetsView() {
    var roster = _data.roster || [];
    var tset = {}; (_data.targets || []).forEach(function (n) { tset[n] = 1; });
    var rows = roster.map(function (n) {
      return '<label style="display:flex;align-items:center;gap:8px;background:#fff;border:1px solid #eee;border-radius:10px;padding:10px 12px;margin-bottom:7px;font-size:14px;font-weight:700"><input type="checkbox" class="ev-tg" value="' + esc(n) + '" ' + (tset[n] ? 'checked' : '') + '>' + esc(n) + '</label>';
    }).join('');
    return '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><div style="font-size:12px;color:#64748b;font-weight:700">평가할 미소지기 선택 (전체 ' + roster.length + '명)</div>'
      + '<div style="display:flex;gap:6px"><button onclick="EV.tgAll(true)" style="border:1px solid #cbd5e1;background:#fff;border-radius:8px;padding:6px 9px;font-size:11px;font-weight:800">전체</button><button onclick="EV.tgAll(false)" style="border:1px solid #cbd5e1;background:#fff;border-radius:8px;padding:6px 9px;font-size:11px;font-weight:800">해제</button></div></div>'
      + rows
      + '<button onclick="EV.saveTargets()" style="width:100%;margin-top:8px;padding:13px;background:#D6001C;color:#fff;border:none;border-radius:12px;font-weight:800">평가대상 저장 → 배정으로</button>';
  }
  EV.tgAll = function (v) { document.querySelectorAll('.ev-tg').forEach(function (c) { c.checked = v; }); };
  EV.saveTargets = function () {
    var misos = []; document.querySelectorAll('.ev-tg:checked').forEach(function (c) { misos.push(c.value); });
    api('/api/eval', { method: 'POST', body: JSON.stringify({ action: 'setTargets', period: _period, misos: misos }) })
      .then(function (j) { if (j && j.error) { alert(j.error); return; } _tab = 'assign'; load(); });
  };

  // ── ② 배정 (평가자 선택 → 좌우 이동) ──
  var _selManager = '', _tgtVals = {};
  EV.setTgt = function (m, v) { _tgtVals[m] = v; };
  function assignView() {
    if (!_managers.length) return '<div style="background:#fff;border:1px solid #eee;border-radius:12px;padding:16px;color:#dc2626;font-weight:700;font-size:13px">평가자(관리자) 계정이 없습니다. Supabase admins 테이블에 관리자를 추가해주세요.</div>';
    var assignments = _data.assignments || [];
    var byMgr = {}, assignedAll = {};
    assignments.forEach(function (a) { (byMgr[a.manager_name] = byMgr[a.manager_name] || []).push(a.miso_name); assignedAll[a.miso_name] = a.manager_name; });
    if (_selManager && _managers.indexOf(_selManager) < 0) _selManager = '';
    var targets = _data.targets || [];
    if (!targets.length) return '<div style="background:#fff;border:1px solid #eee;border-radius:12px;padding:18px;text-align:center;color:#dc2626;font-weight:700;font-size:13px">먼저 <b>① 대상선정</b>에서 평가할 미소지기를 선택하세요.</div>';

    var mgrRows = _managers.map(function (m, i) {
      var cnt = (byMgr[m] || []).length, on = _selManager === m;
      return '<tr onclick="EV.selManager(\'' + esc(m) + '\')" style="cursor:pointer;background:' + (on ? '#eef2ff' : '#fff') + '">'
        + '<td style="padding:6px;border-bottom:1px solid #eee;text-align:center"><input type="checkbox" class="ev-mgr-chk" value="' + i + '" onclick="event.stopPropagation()"></td>'
        + '<td style="padding:8px 10px;border-bottom:1px solid #eee;font-weight:' + (on ? '800' : '600') + '">' + (on ? '▶ ' : '') + esc(m) + '</td>'
        + '<td style="padding:6px;border-bottom:1px solid #eee;text-align:center;font-size:11px;color:#9aa0a6">현재 ' + cnt + '</td>'
        + '<td style="padding:6px;border-bottom:1px solid #eee;text-align:center"><input type="number" min="0" id="tgt_' + i + '" value="' + (_tgtVals.hasOwnProperty(m) ? _tgtVals[m] : cnt) + '" oninput="EV.setTgt(\'' + esc(m) + '\',this.value)" onclick="event.stopPropagation()" style="width:50px;padding:5px;border:1px solid #cbd5e1;border-radius:6px;text-align:center;font-weight:800"></td></tr>';
    }).join('');
    var top = '<div style="font-size:12px;color:#64748b;font-weight:700;margin-bottom:6px">평가대상 ' + targets.length + '명 · 배정 ' + Object.keys(assignedAll).length + '명</div>'
      + '<div style="font-weight:800;font-size:13px;margin-bottom:6px">평가자 목록 (클릭해 선택 · 배정수 입력)</div>'
      + '<table style="width:100%;border-collapse:collapse;font-size:13px;background:#fff;border-radius:10px;overflow:hidden"><thead><tr style="background:#44546A;color:#fff"><th style="padding:7px;width:34px">균등</th><th style="padding:7px;text-align:left">평가자</th><th style="padding:7px;width:56px">현재</th><th style="padding:7px;width:66px">배정수</th></tr></thead><tbody>' + mgrRows + '</tbody></table>'
      + '<div style="display:flex;gap:8px;margin-top:8px"><button onclick="EV.fillEven()" style="flex:0 0 40%;border:1px solid #cbd5e1;background:#fff;color:#334155;border-radius:9px;padding:9px;font-size:12px;font-weight:800">균등값 채우기</button>'
      + '<button onclick="EV.autoAssign()" style="flex:1;border:none;background:#0f172a;color:#fff;border-radius:9px;padding:9px;font-size:12px;font-weight:800">⚡ 배정수대로 자동배정</button></div>'
      + '<div style="font-size:11px;color:#9aa0a6;margin:6px 0 2px;text-align:center">배정수를 입력하고 자동배정 → 명단 순서대로 그 수만큼 배분</div>';

    if (!_selManager) return top + '<div style="color:#94a3b8;text-align:center;padding:24px;font-weight:700;font-size:13px">위에서 평가자를 선택하면<br>미소지기를 배정할 수 있습니다.</div>';
    var pool = targets.filter(function (n) { return !assignedAll[n]; });
    var mine = byMgr[_selManager] || [];
    var li = function (arr) { return arr.length ? arr.map(function (n) { return '<label style="display:flex;align-items:center;gap:6px;padding:7px 8px;border-bottom:1px solid #f3f3f3;font-size:13px"><input type="checkbox" value="' + esc(n) + '">' + esc(n) + '</label>'; }).join('') : '<div style="color:#b0b0b6;padding:14px;font-size:12px;text-align:center">없음</div>'; };
    var bottom = '<div style="display:flex;gap:6px;margin-top:12px;align-items:stretch">'
      + '<div style="flex:1;background:#fff;border:1px solid #eee;border-radius:10px;overflow:hidden"><div style="background:#f1f5f9;font-size:11px;font-weight:800;padding:6px 8px">미배정 (' + pool.length + ')</div><div id="ev-pool" style="max-height:260px;overflow:auto;overscroll-behavior:contain;touch-action:pan-y">' + li(pool) + '</div></div>'
      + '<div style="display:flex;flex-direction:column;justify-content:center;gap:8px">'
      + '<button onclick="EV.moveRight()" title="배정" style="border:none;background:#D6001C;color:#fff;border-radius:8px;padding:10px 11px;font-weight:900;font-size:15px">›</button>'
      + '<button onclick="EV.moveLeft()" title="해제" style="border:none;background:#64748b;color:#fff;border-radius:8px;padding:10px 11px;font-weight:900;font-size:15px">‹</button></div>'
      + '<div style="flex:1;background:#fff;border:1px solid #eee;border-radius:10px;overflow:hidden"><div style="background:#eef2ff;font-size:11px;font-weight:800;padding:6px 8px">' + esc(_selManager) + ' 배정 (' + mine.length + ')</div><div id="ev-mine" style="max-height:260px;overflow:auto;overscroll-behavior:contain;touch-action:pan-y">' + li(mine) + '</div></div></div>'
      + '<div style="font-size:11px;color:#9aa0a6;margin-top:6px;text-align:center">체크 후 › 배정 / ‹ 해제 · 한 명은 한 평가자에게만</div>';
    return top + bottom;
  }
  EV.selManager = function (m) { _selManager = m; render(); };
  EV.moveRight = function () {
    var names = []; document.querySelectorAll('#ev-pool input:checked').forEach(function (c) { names.push(c.value); });
    if (!names.length) { alert('배정할 미소지기를 선택하세요.'); return; }
    // 배정수 상한 체크
    var cur = (_data.assignments || []).filter(function (a) { return a.manager_name === _selManager; }).length;
    var idx = _managers.indexOf(_selManager);
    var target = parseInt(_tgtVals.hasOwnProperty(_selManager) ? _tgtVals[_selManager] : ((document.getElementById('tgt_' + idx) || {}).value), 10);
    if (isNaN(target)) target = cur;
    var allowed = target - cur;
    if (allowed <= 0) { alert(_selManager + ' 님은 이미 배정수(' + target + '명)를 채웠습니다.\n더 배정하려면 배정수를 늘리세요.'); return; }
    if (names.length > allowed) { alert('배정수 ' + target + '명 초과 — 남은 자리 ' + allowed + '명뿐입니다. ' + allowed + '명만 옮깁니다.'); names = names.slice(0, allowed); }
    // 화면 즉시 반영 (저장은 백그라운드)
    _data.assignments = (_data.assignments || []).filter(function (a) { return names.indexOf(a.miso_name) < 0; });
    names.forEach(function (n) { _data.assignments.push({ miso_name: n, manager_name: _selManager }); });
    render();
    api('/api/eval', { method: 'POST', body: JSON.stringify({ action: 'assign', period: _period, assignments: names.map(function (n) { return { miso_name: n, manager_name: _selManager }; }) }) })
      .then(function (j) { if (j && j.error) { alert('저장 실패: ' + j.error); load(); } });
  };
  EV.moveLeft = function () {
    var names = []; document.querySelectorAll('#ev-mine input:checked').forEach(function (c) { names.push(c.value); });
    if (!names.length) { alert('해제할 미소지기를 선택하세요.'); return; }
    _data.assignments = (_data.assignments || []).filter(function (a) { return names.indexOf(a.miso_name) < 0; });
    render();
    Promise.all(names.map(function (n) { return api('/api/eval', { method: 'DELETE', body: JSON.stringify({ action: 'assign', period: _period, miso: n }) }); }))
      .catch(function () { load(); });
  };
  EV.fillEven = function () {
    var total = (_data.targets || []).length;
    var chosen = []; document.querySelectorAll('.ev-mgr-chk:checked').forEach(function (c) { chosen.push(_managers[+c.value]); });
    if (!chosen.length) chosen = _managers.slice(); // 체크 없으면 전체 균등
    // 나머지 인원 랜덤 분배 → 누를 때마다 다르게
    for (var i = chosen.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = chosen[i]; chosen[i] = chosen[j]; chosen[j] = t; }
    var n = chosen.length, base = Math.floor(total / n), rem = total % n;
    _managers.forEach(function (m) { _tgtVals[m] = 0; });
    chosen.forEach(function (m, k) { _tgtVals[m] = base + (k < rem ? 1 : 0); });
    render();
  };
  EV.autoAssign = function () {
    if (!_managers.length) { alert('평가자가 없습니다.'); return; }
    var roster = _data.targets || [];
    var targets = _managers.map(function (m, i) { var v = _tgtVals.hasOwnProperty(m) ? _tgtVals[m] : ((document.getElementById('tgt_' + i) || {}).value); return Math.max(0, parseInt(v, 10) || 0); });
    var totalT = targets.reduce(function (a, b) { return a + b; }, 0);
    if (!confirm('입력한 배정수대로 자동배정할까요?\n대상 ' + roster.length + '명 / 배정합계 ' + totalT + '명\n(기존 배정은 덮어씁니다)')) return;
    var payload = [], idx = 0;
    _managers.forEach(function (m, i) { for (var k = 0; k < targets[i] && idx < roster.length; k++) payload.push({ miso_name: roster[idx++], manager_name: m }); });
    api('/api/eval', { method: 'POST', body: JSON.stringify({ action: 'assign', period: _period, assignments: payload }) }).then(function (j) { if (j && j.error) { alert(j.error); return; } _selManager = _managers[0]; load(); });
  };

  // ── 내 평가 ──
  function mineView() {
    var st = (_data.period && _data.period.status) || 'none';
    if (!_data.isSuper && st !== 'open' && st !== 'closed') {
      return '<div style="background:#fff;border:1px solid #eee;border-radius:12px;padding:24px;text-align:center;color:#94a3b8;font-weight:700;line-height:1.6">⏳ 아직 평가가 오픈되지 않았습니다.<br><span style="font-size:12px">관리자가 평가를 오픈하면 배정된 미소지기를 평가할 수 있어요.</span></div>';
    }
    var all = _data.assignments || [];
    // 최고관리자는 전체(다른 평가자 배정분 포함) 열람, 일반 평가자는 본인 배정분만
    var mine = _data.isSuper ? all.slice() : all.filter(function (a) { return a.manager_name === _data.me; });
    if (!mine.length) return '<div style="background:#fff;border:1px solid #eee;border-radius:12px;padding:20px;text-align:center;color:#94a3b8;font-weight:700">' + (_data.isSuper ? '배정된 미소지기가 없습니다.' : '나에게 배정된 미소지기가 없습니다.') + '</div>';
    var smap = {}; (_data.scores || []).forEach(function (s) { smap[s.miso_name] = s.grades || {}; });
    if (_data.isSuper) {  // 평가자별로 묶어서 보이도록 정렬
      mine.sort(function (x, y) {
        return String(x.manager_name === _data.me ? '0' : '1' + x.manager_name)
          .localeCompare(String(y.manager_name === _data.me ? '0' : '1' + y.manager_name), 'ko')
          || String(x.miso_name).localeCompare(String(y.miso_name), 'ko');
      });
    }
    var hdr = _data.isSuper
      ? '<div style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:10px;padding:9px 11px;margin-bottom:9px;font-size:11.5px;font-weight:800;color:#3730a3">👑 최고관리자 — 전체 평가자의 배정·점수를 모두 볼 수 있습니다 (총 ' + mine.length + '명)</div>'
      : '';
    var lastMgr = null, out = '';
    mine.forEach(function (a) {
      var done = !!_data.scores.find(function (s) { return s.miso_name === a.miso_name; });
      var ctx = (_data.auto || {})[a.miso_name] || {};
      var tot = calcTotal(smap[a.miso_name] || {}, ctx);
      if (_data.isSuper && a.manager_name !== lastMgr) {   // 평가자 구분 헤더
        lastMgr = a.manager_name;
        out += '<div style="font-size:11px;font-weight:900;color:#64748b;margin:12px 2px 6px">평가자 · ' + esc(a.manager_name || '미배정') + (a.manager_name === _data.me ? ' (나)' : '') + '</div>';
      }
      out += '<div onclick="EV.input(\'' + esc(a.miso_name) + '\')" style="display:flex;justify-content:space-between;align-items:center;background:#fff;border:1px solid #eee;border-radius:12px;padding:12px 14px;margin-bottom:9px;cursor:pointer">'
        + '<div><div style="font-weight:800;font-size:15px">' + esc(a.miso_name) + '</div>'
        + '<div style="font-size:11px;color:#9aa0a6;margin-top:2px">' + (done ? '평가 완료' : '미평가')
        + (ctx.subN ? ' · 대타수락 ' + ctx.subN + '건(+' + subBonus(ctx.subN) + ')' : '')
        + ((ctx.lateN || ctx.absentN) ? ' · <span style="color:#dc2626">지각' + (ctx.lateN || 0) + '/결근' + (ctx.absentN || 0) + '</span>' : '')
        + '</div></div>'
        + '<div style="text-align:right"><div style="font-size:18px;font-weight:900;color:' + (done ? '#D6001C' : '#cbd5e1') + '">' + tot + '<span style="font-size:11px;color:#9aa0a6">점</span></div></div></div>';
    });
    return hdr + out;
  }
  function calcTotal(grades, ctx) {
    var t = 0;
    CRI.forEach(function (c) { var s = c.kind === 'letter' ? (LETTER[grades[c.key]] || 0) : autoS(c.kind, ctx); t += s * c.w / 100; });
    t += subBonus(ctx.subN);               // 대타 수락 보너스(서버와 동일)
    return Math.min(100, Math.round(t));   // 총점 상한 100
  }

  // ── 점수 산정 기준 안내 (모든 평가자에게 동일 노출) ──
  function guideHtml() {
    var letters = LETTERS.map(function (l) { return l + '=' + LETTER[l]; }).join(' · ');
    return '<details style="margin-top:12px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden">'
      + '<summary style="padding:10px 12px;font-size:12px;font-weight:800;color:#334155;cursor:pointer">ℹ️ 점수 산정 기준 (탭하여 보기)</summary>'
      + '<div style="padding:0 12px 12px;font-size:11.5px;line-height:1.65;color:#475569">'
      + '<b>등급 점수</b><br>' + letters + '<br><br>'
      + '<b>가중치 (합계 100%)</b><br>'
      + CRI.map(function (c) { return '· ' + c.sub + ' <b>' + c.w + '%</b>' + (c.kind !== 'letter' ? ' <span style="color:#2563a8">(자동)</span>' : ''); }).join('<br>')
      + '<br><br><b>자동 산정 항목</b><br>'
      + '· 지각: 100 − 15×횟수<br>'
      + '· 결근: 100 − 50×횟수<br>'
      + '· 공지 숙지: 서명수 ÷ 서명필요 공지수 × 100 (해당 월 공지 없으면 100)<br><br>'
      + '<b>가산점</b><br>'
      + '· 대타·교대 <u>수락</u> 1건당 +' + SUB_BONUS_PER + '점 (최대 +' + SUB_BONUS_CAP + '점)<br>'
      + '&nbsp;&nbsp;※ 승인완료된 건 중 해당 월 근무분만 집계<br>'
      + '&nbsp;&nbsp;※ 대타를 <u>요청</u>한 것은 점수에 반영되지 않음<br><br>'
      + '<b>총점</b> = 가중 환산 합계 + 가산점 (상한 100)<br>'
      + '<span style="color:#94a3b8">지각·결근·공지 점수는 저장 후에도 근태 변동에 따라 자동 갱신됩니다.</span>'
      + '</div></details>';
  }

  // ── 평가 입력 시트 (저장하면 잠금 · 지각/결근/공지는 항상 자동 최신) ──
  EV.input = function (miso) {
    var scoreRow = (_data.scores || []).find(function (s) { return s.miso_name === miso; });
    var closed = _data.period && _data.period.status === 'closed';
    var locked = (!!scoreRow && !_data.isSuper) || closed;
    var grades = (scoreRow || {}).grades || {};
    var ctx = (_data.auto || {})[miso] || { lateN: 0, absentN: 0, noticeReq: 0, noticeSigned: 0, subN: 0 };
    var rows = CRI.map(function (c) {
      if (c.kind === 'letter') {
        var sc = LETTER[grades[c.key]] || 0;
        var cell = locked
          ? '<span style="font-weight:900;font-size:14px">' + (grades[c.key] || '-') + '</span>'
          : '<select data-k="' + c.key + '" data-w="' + c.w + '" onchange="EV.calc()" style="border:1px solid #cbd5e1;border-radius:7px;padding:5px 7px;font-weight:800"><option value="">-</option>' + LETTERS.map(function (l) { return '<option ' + (grades[c.key] === l ? 'selected' : '') + '>' + l + '</option>'; }).join('') + '</select>';
        return '<tr><td class="l">' + c.sub + '</td><td>' + cell + '</td><td id="s_' + c.key + '">' + (locked ? sc : 0) + '</td><td>' + c.w + '</td><td id="c_' + c.key + '">' + (locked ? Math.round(sc * c.w / 100) : 0) + '</td></tr>';
      }
      var as = autoS(c.kind, ctx);
      var note = c.kind === 'late' ? ('지각 ' + (ctx.lateN || 0) + '회') : c.kind === 'absent' ? ('결근 ' + (ctx.absentN || 0) + '회') : ('서명 ' + (ctx.noticeSigned || 0) + '/' + (ctx.noticeReq || 0));
      return '<tr><td class="l">' + c.sub + '<div style="font-size:10px;color:#93a">' + note + '</div></td><td style="color:#2563a8;font-weight:800">자동</td><td class="au" data-k="' + c.key + '" data-w="' + c.w + '">' + as + '</td><td>' + c.w + '</td><td class="ac" id="c_' + c.key + '">' + Math.round(as * c.w / 100) + '</td></tr>';
    }).join('');
    var css = '#ev-in table{width:100%;border-collapse:collapse;font-size:13px;background:#fff;border-radius:10px;overflow:hidden}#ev-in th{background:#44546A;color:#fff;padding:8px 4px}#ev-in td{border-bottom:1px solid #eee;padding:8px 5px;text-align:center}#ev-in td.l{text-align:left;font-weight:700}';
    var foot = locked
      ? '<div style="margin-top:12px;text-align:center;font-size:12px;font-weight:800;color:#16a34a">✅ 평가 완료 · 수정 불가' + (closed ? ' (마감)' : '') + '<div style="font-size:11px;color:#9aa0a6;font-weight:600;margin-top:2px">지각·결근·공지 점수는 근태 변동에 따라 자동 갱신됩니다</div></div>'
      : '<button onclick="EV.saveScore(\'' + esc(miso) + '\')" style="width:100%;margin-top:12px;padding:14px;background:#D6001C;color:#fff;border:none;border-radius:12px;font-weight:800;font-size:15px">평가 저장 (저장 후 수정 불가)</button>';
    var html = '<div style="font-size:16px;font-weight:800;margin-bottom:4px">' + esc(miso) + ' 평가' + (locked ? ' <span style="font-size:11px;color:#16a34a">🔒 완료</span>' : '') + '</div>'
      + '<div style="font-size:11px;color:#9aa0a6;margin-bottom:10px">' + _period + ' · 평가자 ' + esc((scoreRow && scoreRow.manager_name) || me()) + '</div>'
      + '<style>' + css + '</style><table><thead><tr><th style="width:36%">소구분</th><th>평가</th><th>점수</th><th>가중</th><th>환산</th></tr></thead><tbody>' + rows
      // 대타/교대 수락 보너스 — 가중치와 무관하게 총점에 가산
      + '<tr style="background:#f0f9ff"><td class="l">대타·교대 수락<div style="font-size:10px;color:#93a">' + (ctx.subN || 0) + '건 · 1건당 +' + SUB_BONUS_PER + '점(최대 +' + SUB_BONUS_CAP + ')</div></td>'
      + '<td style="color:#2563a8;font-weight:800">자동</td><td>-</td><td>가산</td>'
      + '<td id="ev-bonus" style="font-weight:900;color:#2563a8">+' + subBonus(ctx.subN) + '</td></tr>'
      + '<tr style="background:#fdf2f2;font-weight:900;color:#c00000"><td colspan="4" style="text-align:right;padding-right:8px">총점 <span style="font-size:10px;font-weight:700;color:#9aa0a6">(상한 100)</span></td><td id="ev-tot">' + (locked ? calcTotal(grades, ctx) : 0) + '</td></tr></tbody></table>'
      + guideHtml()
      + foot;
    openSheet(html);
    if (!locked) EV.calc();
  };
  EV.calc = function () {
    var box = document.getElementById('ev-in'); if (!box) return;
    var tot = 0;
    box.querySelectorAll('select[data-k]').forEach(function (sel) {
      var sc = sel.value ? LETTER[sel.value] : 0; var w = +sel.getAttribute('data-w');
      document.getElementById('s_' + sel.getAttribute('data-k')).textContent = sc;
      var c = Math.round(sc * w / 100); document.getElementById('c_' + sel.getAttribute('data-k')).textContent = c; tot += c;
    });
    box.querySelectorAll('td.au').forEach(function (td) { var sc = +td.textContent; var w = +td.getAttribute('data-w'); tot += Math.round(sc * w / 100); });
    var bn = document.getElementById('ev-bonus');
    if (bn) tot += (parseInt(bn.textContent.replace(/[^0-9]/g, ''), 10) || 0);  // 대타 보너스 가산
    document.getElementById('ev-tot').textContent = Math.min(100, tot);          // 총점 상한 100
  };
  EV.saveScore = function (miso) {
    var box = document.getElementById('ev-in'); var grades = {};
    box.querySelectorAll('select[data-k]').forEach(function (sel) { if (sel.value) grades[sel.getAttribute('data-k')] = sel.value; });
    api('/api/eval', { method: 'POST', body: JSON.stringify({ action: 'score', period: _period, miso: miso, grades: grades }) })
      .then(function (j) { if (j && j.error) { alert(j.error); return; } closeSheet(); load(); });
  };

  // ── 평가 진행 현황 (관리자별 완료 여부) ──
  function progressHtml() {
    var byMgr = {}, scored = {};
    (_data.assignments || []).forEach(function (a) { (byMgr[a.manager_name] = byMgr[a.manager_name] || []).push(a.miso_name); });
    (_data.scores || []).forEach(function (s) { scored[s.miso_name] = 1; });
    var rows = _managers.map(function (m) {
      var arr = byMgr[m] || [], done = arr.filter(function (n) { return scored[n]; }).length, all = arr.length, ok = all > 0 && done === all;
      return '<div style="display:flex;align-items:center;gap:10px;background:#fff;border:1px solid #eee;border-radius:10px;padding:9px 11px;margin-bottom:6px">'
        + '<span style="width:9px;height:9px;border-radius:50%;background:' + (ok ? '#16a34a' : all === 0 ? '#cbd5e1' : '#f59e0b') + '"></span>'
        + '<span style="flex:1;font-weight:800;font-size:13px">' + esc(m) + '</span>'
        + '<span style="font-size:12px;font-weight:800;color:' + (ok ? '#16a34a' : all === 0 ? '#94a3b8' : '#dc2626') + '">' + done + ' / ' + all + ' ' + (all === 0 ? '배정없음' : ok ? '완료' : '진행중') + '</span></div>';
    }).join('');
    var asg = _data.assignments || [];
    var allDone = asg.length > 0 && asg.every(function (a) { return scored[a.miso_name]; });
    return '<div style="font-size:13px;font-weight:800;color:#0f172a;margin-bottom:7px">📊 평가 진행 현황 ' + (allDone ? '<span style="color:#16a34a">· 전원 완료 ✅</span>' : '<span style="color:#dc2626">· 미완료 있음</span>') + '</div>' + rows;
  }

  // ── 신인왕 후보 선정 (최고관리자) · 후보 중 최고점 자동 신인왕 ──
  function rookieView() {
    if (!_data.isSuper) return '';
    var cand = _data.rookieCandidates || [];
    return '<div style="background:#eef6ff;border:1px solid #d6e6fb;border-radius:12px;padding:11px 12px;margin:10px 0">'
      + '<div style="display:flex;justify-content:space-between;align-items:center"><div style="font-size:12px;font-weight:800;color:#2563a8">🐣 신인왕 후보 ' + cand.length + '명</div>'
      + '<button onclick="EV.editRookies()" style="border:1px solid #93c5fd;background:#fff;color:#2563a8;border-radius:8px;padding:6px 11px;font-size:12px;font-weight:800">후보 편집</button></div>'
      + '<div style="font-size:11px;color:#64748b;margin-top:4px">신입을 후보로 등록하면, 후보 중 최고점이 자동으로 신인왕이 됩니다.</div></div>';
  }
  EV.editRookies = function () {
    var cand = {}; (_data.rookieCandidates || []).forEach(function (n) { cand[n] = 1; });
    var rows = (_data.targets || []).map(function (n) {
      return '<label style="display:flex;align-items:center;gap:8px;background:#fff;border:1px solid #eee;border-radius:10px;padding:10px 12px;margin-bottom:7px;font-size:14px;font-weight:700"><input type="checkbox" class="ev-rk" value="' + esc(n) + '" ' + (cand[n] ? 'checked' : '') + '>' + esc(n) + '</label>';
    }).join('');
    if (!(_data.targets || []).length) rows = '<div style="text-align:center;color:#94a3b8;padding:16px;font-weight:700">먼저 ① 대상선정을 하세요.</div>';
    openSheet('<div style="font-size:16px;font-weight:800;margin-bottom:4px">🐣 신인왕 후보 선정</div><div style="font-size:11px;color:#9aa0a6;margin-bottom:10px">신입 미소지기를 후보로 체크하세요. 후보 중 최고점이 신인왕.</div>' + rows + '<button onclick="EV.saveRookies()" style="width:100%;margin-top:8px;padding:13px;background:#2563a8;color:#fff;border:none;border-radius:12px;font-weight:800">후보 저장</button>');
  };
  EV.saveRookies = function () {
    var misos = []; document.querySelectorAll('.ev-rk:checked').forEach(function (c) { misos.push(c.value); });
    api('/api/eval', { method: 'POST', body: JSON.stringify({ action: 'setRookieCandidates', period: _period, misos: misos }) })
      .then(function (j) { if (j && j.error) { alert(j.error); return; } closeSheet(); load(); });
  };

  // ── 순위/취합 ──
  function loadRank() {
    api('/api/eval?action=result&period=' + _period).then(function (res) {
      var el = document.getElementById('ev-rank'); if (!el) return;
      var rows = (res && res.rows) || [];
      var rookie = res && res.rookie;
      if (!rows.length) { el.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:30px;font-weight:700">배정·평가 내역이 없습니다.</div>'; return; }
      var closed = _data.period && _data.period.status === 'closed';
      var medal = function (r) { return r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : r + '위'; };
      el.innerHTML = '<div style="font-size:12px;color:#64748b;font-weight:700;margin-bottom:8px">' + (closed ? '최종 순위 (마감됨)' : '중간 집계 (마감 전)') + '</div>'
        + (rookie ? '<div style="background:#eef6ff;border:1px solid #d6e6fb;border-radius:10px;padding:9px 12px;margin-bottom:8px;font-size:13px;font-weight:800;color:#2563a8">🐣 신인왕: ' + esc(rookie) + '</div>' : '')
        + rows.map(function (r) {
          return '<div style="display:flex;align-items:center;gap:11px;background:#fff;border:1px solid ' + (r.rank <= 3 && closed ? '#fbbf24' : '#eee') + ';border-radius:12px;padding:11px 13px;margin-bottom:8px">'
            + '<div style="width:38px;text-align:center;font-size:16px;font-weight:900">' + (closed ? medal(r.rank) : r.rank + '위') + '</div>'
            + '<div style="flex:1"><div style="font-weight:800;font-size:15px">' + esc(r.miso) + '</div><div style="font-size:11px;color:#9aa0a6">평가자 ' + esc(r.manager) + (r.scored ? '' : ' · <span style="color:#dc2626">미평가</span>') + '</div></div>'
            + '<div style="font-size:20px;font-weight:900;color:#D6001C">' + r.total + '<span style="font-size:11px;color:#9aa0a6">점</span></div></div>';
        }).join('');
    });
  }

  // 기간 오픈/마감
  EV.open_ = function () {
    var targets = _data.targets || [], assigned = {};
    (_data.assignments || []).forEach(function (a) { assigned[a.miso_name] = 1; });
    if (!targets.length) { alert('먼저 ① 대상선정과 ② 배정을 완료하세요.'); return; }
    var un = targets.filter(function (n) { return !assigned[n]; });
    if (un.length) { alert('미배정 ' + un.length + '명이 있습니다.\n배정을 완료해야 오픈할 수 있습니다.'); return; }
    if (!confirm(_period + ' 평가를 오픈할까요?\n관리자 전원에게 알림이 발송됩니다.')) return;
    api('/api/eval', { method: 'POST', body: JSON.stringify({ action: 'openPeriod', period: _period }) }).then(function (j) { if (j && j.error) { alert(j.error); return; } load(); });
  };
  EV.close_ = function () {
    var scored = {}; (_data.scores || []).forEach(function (s) { scored[s.miso_name] = 1; });
    var un = (_data.assignments || []).filter(function (a) { return !scored[a.miso_name]; });
    var msg = _period + ' 평가를 마감할까요?\n순위가 확정되고 관리자 전원에게 알림이 발송됩니다.';
    if (un.length) msg = '⚠️ 아직 평가 안 된 미소지기 ' + un.length + '명이 있습니다.\n\n' + msg;
    if (!confirm(msg)) return;
    api('/api/eval', { method: 'POST', body: JSON.stringify({ action: 'closePeriod', period: _period }) }).then(function () { load(); });
  };

  // 메인화면 리더보드 + 우수 미소지기(top3) 왕관
  EV.homeBoard = function () {
    var tk = sessionStorage.getItem('cgv_token') || '';
    var el = document.getElementById('home-leaderboard');
    fetch('/api/eval?action=leaderboard', { headers: tk ? { 'Authorization': 'Bearer ' + tk } : {} })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var rows = (d && d.rows) || [];
        var mm = d && d.period ? (parseInt(d.period.split('-')[1], 10) + '월') : '';
        var top = {}; rows.forEach(function (r) { if (r.rank <= 3) top[r.miso] = r.rank; });
        window.__EV_TOP3 = top; window.__EV_TOP3_MONTH = mm;
        try { localStorage.setItem('cgv_ev_top3', JSON.stringify({ top: top, month: mm })); } catch (e) {}
        if (typeof buildAuthNameGrid === 'function') try { buildAuthNameGrid(); } catch (e) {}
        if (typeof buildUserGrid === 'function') try { buildUserGrid(); } catch (e) {}
        if (!el) return;
        if (!rows.length) { el.innerHTML = ''; return; }
        var medal = function (r) { return r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : r + '위'; };
        var colBg = function (r) { return r === 1 ? '#fdf6e3' : r === 2 ? '#f5f6f8' : r === 3 ? '#fbf0e8' : '#f8f9fb'; };
        var colBd = function (r) { return r === 1 ? '1px solid #f0d894' : '1px solid #eef0f2'; };
        var prize = function (r) { return r === 1 ? '🎬 영화관람권 2매' : r === 2 ? '⭐ 마일리지 2,000점' : r === 3 ? '⭐ 마일리지 1,000점' : ''; };
        // 시안형 3칸 가로 배치 (금·은·동)
        var cols = rows.slice(0, 3).map(function (r) {
          var pz = prize(r.rank);
          return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:11px 5px;border-radius:12px;background:' + colBg(r.rank) + ';border:' + colBd(r.rank) + '">'
            + '<span style="font-size:19px;line-height:1">' + medal(r.rank) + '</span>'
            + '<span style="font-weight:800;font-size:13px;color:#0f172a;text-align:center">' + esc(r.miso) + '</span>'
            + '<span style="font-weight:900;color:#e11d48;font-size:15px">' + r.total + '<span style="font-size:10px;color:#94a3b8;font-weight:700">점</span></span>'
            + (pz ? '<span style="font-size:8.5px;color:#a16207;font-weight:700;text-align:center;line-height:1.25">' + pz + '</span>' : '')
            + '</div>';
        }).join('');
        el.innerHTML = '<div style="background:#fff;border:1px solid #eceef2;border-radius:16px;padding:13px 14px;box-shadow:0 1px 3px rgba(0,0,0,.04)">'
          + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:10px"><span style="font-size:16px">🏆</span><span style="font-weight:800;font-size:14px;color:#0f172a">이 달의 우수 미소지기</span><span style="margin-left:auto;font-size:10px;font-weight:700;color:#94a3b8;background:#f4f5f7;padding:2px 8px;border-radius:20px">' + mm + '</span></div>'
          + '<div style="display:flex;gap:7px">' + cols + '</div>'
          + '<div style="margin-top:9px;padding:8px 11px;border-radius:10px;background:#eef6ff;font-size:11.5px;font-weight:700;color:#2563a8">🐣 신인왕 · ' + (d.rookie ? esc(d.rookie) : '8월부터 시작') + '</div>'
          + '</div>';
      }).catch(function () {});
  };

  // 공통 시트
  function openSheet(inner) {
    closeSheet();
    var ov = document.createElement('div'); ov.id = 'ev-sheet-ov';
    ov.style.cssText = 'position:fixed;inset:0;z-index:99995;background:rgba(15,23,42,.5);display:flex;align-items:flex-end;justify-content:center';
    ov.onclick = function (e) { if (e.target === ov) closeSheet(); };
    ov.innerHTML = '<div id="ev-in" style="width:100%;max-width:480px;max-height:90vh;overflow:auto;overscroll-behavior:contain;background:#fff;border-radius:20px 20px 0 0;padding:18px 16px calc(22px + env(safe-area-inset-bottom))">' + inner + '</div>';
    document.body.appendChild(ov);
  }
  function closeSheet() { var o = document.getElementById('ev-sheet-ov'); if (o) o.remove(); }
  EV.closeSheet = closeSheet;

  // 캐시된 top3로 즉시 왕관 표시(지연 제거) → 그다음 백그라운드 새로고침
  try {
    var _c = JSON.parse(localStorage.getItem('cgv_ev_top3') || 'null');
    if (_c && _c.top) {
      window.__EV_TOP3 = _c.top; window.__EV_TOP3_MONTH = _c.month || '';
      if (typeof buildAuthNameGrid === 'function') try { buildAuthNameGrid(); } catch (e) {}
      if (typeof buildUserGrid === 'function') try { buildUserGrid(); } catch (e) {}
    }
  } catch (e) {}
  setTimeout(function () { try { EV.homeBoard(); } catch (e) {} }, 300);
})();
