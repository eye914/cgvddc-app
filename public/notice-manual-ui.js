/* 공지사항 · 업무 매뉴얼 UI (cgv-app.js 뒤에 defer 로드) — window.NM */
(function () {
  var NM = (window.NM = window.NM || {});

  /* ── 세션/공통 ── */
  function tok() { return sessionStorage.getItem('cgv_token') || ''; }
  function isAdmin() { return sessionStorage.getItem('cgv_admin') === 'true'; }
  function me() { return sessionStorage.getItem('cgv_currentUser') || sessionStorage.getItem('cgv_admin_name') || ''; }
  function pinDefault() { return sessionStorage.getItem('cgv_pin_default') === 'true'; }
  function api(url, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok() }, opts.headers || {});
    return fetch(url, opts).then(function (r) { return r.json(); });
  }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function nl2br(s) { return esc(s).replace(/\n/g, '<br>'); }

  // 간단 서식 렌더: "## 제목", "- 불릿", "1. 번호", "> 안내박스", "**굵게**", 빈 줄=간격
  function inlineMd(t) { return esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>'); }
  function renderMd(src) {
    var lines = String(src == null ? '' : src).split('\n');
    var html = '', inUl = false, inOl = false;
    function close() { if (inUl) { html += '</ul>'; inUl = false; } if (inOl) { html += '</ol>'; inOl = false; } }
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i].replace(/\s+$/, '');
      if (!ln.trim()) { close(); continue; }
      if (/^##\s+/.test(ln)) { close(); html += '<div class="nm-h">' + inlineMd(ln.replace(/^##\s+/, '')) + '</div>'; continue; }
      if (/^>\s+/.test(ln)) { close(); html += '<div class="nm-note">' + inlineMd(ln.replace(/^>\s+/, '')) + '</div>'; continue; }
      var mo = ln.match(/^(\d+)\.\s+(.*)/);
      if (mo) { if (!inOl) { close(); html += '<ol class="nm-ol">'; inOl = true; } html += '<li>' + inlineMd(mo[2]) + '</li>'; continue; }
      if (/^[-·]\s+/.test(ln)) { if (!inUl) { close(); html += '<ul class="nm-ul">'; inUl = true; } html += '<li>' + inlineMd(ln.replace(/^[-·]\s+/, '')) + '</li>'; continue; }
      close(); html += '<p class="nm-p">' + inlineMd(ln) + '</p>';
    }
    close();
    return html;
  }
  function injectNMStyle() {
    if (document.getElementById('nm-style')) return;
    var css = '.nm-body{font-size:14px;line-height:1.55;color:#3f4652;font-family:"Pretendard",-apple-system,"Malgun Gothic",sans-serif}'
      + '.nm-body .nm-h{display:flex;align-items:center;gap:7px;margin:20px 0 9px;font-size:15px;font-weight:800;color:#1f2937;letter-spacing:-.01em}'
      + '.nm-body .nm-h:first-child{margin-top:2px}'
      + '.nm-body .nm-h:before{content:"";width:4px;height:15px;background:#e71a0f;border-radius:3px;flex:0 0 auto}'
      + '.nm-body .nm-p{margin:0 0 8px}'
      + '.nm-body .nm-ul{margin:0 0 8px;padding-left:2px;list-style:none}'
      + '.nm-body .nm-ul>li{padding-left:15px;position:relative;margin-bottom:7px}'
      + '.nm-body .nm-ul>li:before{content:"•";position:absolute;left:2px;color:#c0392b}'
      + '.nm-body .nm-ol{margin:0 0 8px;padding-left:20px}'
      + '.nm-body .nm-ol>li{margin-bottom:7px}'
      + '.nm-body .nm-note{margin:8px 0;background:#fbf7ee;border:1px solid #f0e6d2;border-radius:10px;padding:9px 12px;font-size:13px;line-height:1.5;color:#8a6d3b}'
      + '.nm-body img{width:100%;border-radius:10px;margin:10px 0 2px;border:1px solid #eee}';
    var st = document.createElement('style'); st.id = 'nm-style'; st.textContent = css; document.head.appendChild(st);
  }
  // 이미지에 도난방지 워터마크를 직접 얹어 렌더 (스크롤·위치와 무관하게 모든 이미지에 표시)
  function protectedImg(u) {
    var mark = esc(me() || '미소지기') + ' · ' + new Date().toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    var wm = ''; for (var i = 0; i < 18; i++) wm += '<span style="color:rgba(255,255,255,.42);font-size:12px;font-weight:800;transform:rotate(-24deg);white-space:nowrap;text-shadow:0 0 3px rgba(0,0,0,.4)">' + mark + '</span>';
    return '<div style="position:relative;margin-top:10px;border:1px solid #eee;border-radius:10px;overflow:hidden;transform:translateZ(0)">'
      + '<img src="' + esc(u) + '" draggable="false" oncontextmenu="return false" onclick="NM.zoom(this.src)" style="width:100%;display:block;cursor:zoom-in">'
      + '<div style="position:absolute;inset:0;pointer-events:none;display:flex;flex-wrap:wrap;gap:34px 22px;align-content:flex-start;padding:22px 8px;overflow:hidden">' + wm + '</div></div>';
  }
  var N_CATS = ['전체', '미소지기', '매점', '매표', '플로어', '프로모션', '이벤트'];
  var M_CATS = ['매점', '매표'];
  var M_TYPES = ['일반', '신입', '조리매뉴얼'];
  var catCls = { '전체': 'background:#eef0f2;color:#555', '미소지기': 'background:#f3e8ff;color:#7c3aed', '매점': 'background:#fbe6df;color:#b15644', '매표': 'background:#e3effb;color:#2563a8', '플로어': 'background:#e2f3ea;color:#2f7d5c', '프로모션': 'background:#fff3d6;color:#a5761a', '이벤트': 'background:#fde7f0;color:#be185d' };
  var typeCls = { '일반': 'background:#eef0f2;color:#555', '신입': 'background:#e7f0ff;color:#2563a8', '조리매뉴얼': 'background:#fff3d6;color:#a5761a', '신입교육': 'background:#e7f0ff;color:#2563a8', '조리레시피': 'background:#fff3d6;color:#a5761a' };

  var _nFilter = '전체', _mFilter = '전체';
  var _mySigned = [];

  function gateMsg(title) {
    if (!tok()) return '<div style="text-align:center;color:#94a3b8;padding:40px 20px;font-weight:700">로그인 후 이용할 수 있습니다.</div>';
    if (pinDefault() && !isAdmin()) return '<div style="text-align:center;color:#dc2626;padding:40px 20px;font-weight:800;line-height:1.6">🔒 보안을 위해 초기 PIN(00000)으로는<br>' + title + '을(를) 볼 수 없습니다.<br><span style="font-size:12px;color:#64748b;font-weight:700">관리자에게 PIN 설정을 요청해주세요.</span></div>';
    return '';
  }

  /* ══════════════════════ 공지 ══════════════════════ */
  NM.renderNotices = function () {
    injectNMStyle();
    var host = document.getElementById('view-notice'); if (!host) return;
    var g = gateMsg('공지'); if (g) { host.innerHTML = g; return; }
    host.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:30px">불러오는 중…</div>';
    Promise.all([
      api('/api/notices' + (isAdmin() ? '?all=1' : '')),
      api('/api/notice-signatures?mine=1')
    ]).then(function (res) {
      var list = Array.isArray(res[0]) ? res[0] : [];
      _mySigned = Array.isArray(res[1]) ? res[1] : [];
      var chips = '<div style="display:flex;gap:6px;overflow-x:auto;padding:4px 2px 12px">' + N_CATS.map(function (c) {
        var on = _nFilter === c;
        return '<button onclick="NM.setNFilter(\'' + c + '\')" style="flex:0 0 auto;border:1px solid ' + (on ? '#1a1a1a' : '#e2e2e2') + ';background:' + (on ? '#1a1a1a' : '#fff') + ';color:' + (on ? '#fff' : '#555') + ';padding:6px 12px;border-radius:20px;font-size:12px;font-weight:700;white-space:nowrap">' + c + '</button>';
      }).join('') + '</div>';
      var items = list.filter(function (n) { return _nFilter === '전체' || n.category === _nFilter; });
      var body = items.length ? items.map(noticeCard).join('') : '<div style="text-align:center;color:#94a3b8;padding:30px;font-weight:700">공지가 없습니다.</div>';
      var addBtn = isAdmin() ? '<button onclick="NM.openNoticeForm()" style="width:100%;margin-bottom:12px;padding:13px;background:#e71a0f;color:#fff;border:none;border-radius:13px;font-weight:800;font-size:14px">＋ 새 공지 작성</button>' : '';
      host.innerHTML = '<div style="padding:4px 14px">' + addBtn + chips + body + '</div>';
    }).catch(function () { host.innerHTML = '<div style="text-align:center;color:#dc2626;padding:30px">불러오기 실패</div>'; });
  };
  NM.setNFilter = function (c) { _nFilter = c; NM.renderNotices(); };

  function todayISO() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function periodTxt(n) {
    if (!n.start_date && !n.end_date) return '상시';
    return (n.start_date || '~') + ' ~ ' + (n.end_date || '상시');
  }
  function isExpired(n) { return n.end_date && String(n.end_date) < todayISO(); }

  function noticeCard(n) {
    var signed = _mySigned.indexOf(n.id) > -1;
    var badges = '';
    if (n.pinned) badges += '<span style="font-size:11px;color:#c98a00;font-weight:800">📌 고정</span>';
    if (n.important) badges += '<span style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:6px;background:#fdeaea;color:#e71a0f">🔴 중요</span>';
    if (n.require_signature) badges += '<span style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:6px;background:#111;color:#fff">✍ 서명필요</span>';
    badges += '<span style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:6px;' + (catCls[n.category] || catCls['전체']) + '">' + esc(n.category) + '</span>';
    if (n.require_signature && signed) badges += '<span style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:6px;background:#eaf7ef;color:#1c7a43">✅ 확인완료</span>';
    var adminExtra = isAdmin() && isExpired(n) ? '<span style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:6px;background:#f1f5f9;color:#94a3b8">기간만료</span>' : '';
    return '<div onclick="NM.openNotice(\'' + n.id + '\')" style="background:#fff;border:1px solid #eee;border-radius:14px;padding:13px 14px;margin-bottom:10px;cursor:pointer">'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:6px">' + badges + adminExtra + '</div>'
      + '<div style="font-size:14px;font-weight:800;line-height:1.35;color:#0f172a">' + esc(n.title) + '</div>'
      + '<div style="font-size:11px;color:#9a9aa0;margin-top:5px;font-weight:600">' + periodTxt(n) + '</div>'
      + '</div>';
  }

  var _notices = {};
  NM.openNotice = function (id) {
    api('/api/notices' + (isAdmin() ? '?all=1' : '')).then(function (list) {
      var n = (list || []).filter(function (x) { return x.id === id; })[0];
      if (!n) { alert('공지를 찾을 수 없습니다.'); return; }
      _notices[id] = n;
      var signed = _mySigned.indexOf(id) > -1;
      var adminBtns = isAdmin() ? '<button onclick="NM.notify(\'' + id + '\')" style="width:100%;margin-top:12px;padding:11px;background:#0f172a;color:#fff;border:none;border-radius:11px;font-weight:800;font-size:13px">🔔 전체 미소지기에게 알림 보내기</button>'
        + '<div style="display:flex;gap:8px;margin-top:8px"><button onclick="NM.openNoticeForm(\'' + id + '\')" style="flex:1;padding:10px;background:#f1f5f9;border:none;border-radius:10px;font-weight:800;color:#334155">수정</button><button onclick="NM.delNotice(\'' + id + '\')" style="flex:1;padding:10px;background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;font-weight:800;color:#dc2626">삭제</button></div>' : '';
      var sigArea = '';
      if (n.require_signature && !isAdmin()) { // 관리자는 서명 안 함 → 패드 미표시(스크롤 방해 방지)
        if (signed) sigArea = '<div style="margin-top:14px;background:#eaf7ef;border:1px solid #b8e6c9;border-radius:12px;padding:13px;font-weight:800;color:#1c7a43;text-align:center">✅ 확인 및 서명 완료</div>';
        else sigArea = signaturePadHtml(id);
      }
      var adminStatus = isAdmin() && n.require_signature ? '<div id="nm-sigstat" style="margin-top:12px"></div>' : '';
      var nImgs = (n.images || []).map(protectedImg).join('')
        + ((n.images && n.images.length) ? '<div style="text-align:center;font-size:11px;color:#b0b0b6;margin-top:6px">사진을 탭하면 확대됩니다</div>' : '');
      var html = '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:8px">'
        + (n.important ? '<span style="font-size:10px;font-weight:800;padding:3px 9px;border-radius:6px;background:#fdeaea;color:#e71a0f">🔴 중요</span>' : '')
        + (n.require_signature ? '<span style="font-size:10px;font-weight:800;padding:3px 9px;border-radius:6px;background:#111;color:#fff">✍ 서명필요</span>' : '')
        + '<span style="font-size:10px;font-weight:800;padding:3px 9px;border-radius:6px;' + (catCls[n.category] || catCls['전체']) + '">' + esc(n.category) + '</span></div>'
        + '<div style="font-size:17px;font-weight:800;line-height:1.35">' + esc(n.title) + '</div>'
        + '<div style="font-size:11px;color:#9a9aa0;margin:6px 0 12px;font-weight:600">' + periodTxt(n) + ' · 관리자</div>'
        + '<div class="nm-protected nm-body" style="border-top:1px solid #f0f0f0;padding-top:12px;position:relative">' + renderMd(n.body) + nImgs + '</div>'
        + sigArea + adminStatus + adminBtns;
      openSheet(html, true);
      if (isAdmin() && n.require_signature) loadSigStatus(id);
      initSigPad();
    });
  };

  function signaturePadHtml(id) {
    return '<div id="nm-sigwrap" style="margin-top:14px;background:#f8f9fb;border:1px solid #e6e6e6;border-radius:12px;padding:11px">'
      + '<div style="font-size:11px;font-weight:800;color:#555;margin-bottom:7px">아래 칸에 서명해주세요 (손가락/마우스)</div>'
      + '<canvas id="nm-sigpad" style="width:100%;height:130px;background:#fff;border:1.5px dashed #cfcfd6;border-radius:9px;touch-action:none;display:block"></canvas>'
      + '<div style="display:flex;gap:8px;margin-top:9px"><button onclick="NM.sigClear()" style="flex:0 0 34%;border:none;background:#eceef1;color:#555;border-radius:11px;padding:12px;font-weight:800">다시</button>'
      + '<button onclick="NM.sigSubmit(\'' + id + '\')" style="flex:1;border:none;background:#e71a0f;color:#fff;border-radius:11px;padding:12px;font-weight:800">확인 및 제출</button></div></div>';
  }

  var _sigCtx = null, _sigCanvas = null, _sigDirty = false;
  function initSigPad() {
    var c = document.getElementById('nm-sigpad'); if (!c) return;
    _sigCanvas = c; _sigDirty = false;
    setTimeout(function () {
      var r = c.getBoundingClientRect(); c.width = r.width * 2; c.height = r.height * 2;
      _sigCtx = c.getContext('2d'); _sigCtx.scale(2, 2); _sigCtx.lineWidth = 2.2; _sigCtx.lineCap = 'round'; _sigCtx.strokeStyle = '#16264a';
    }, 40);
    var drawing = false;
    function pos(e) { var r = c.getBoundingClientRect(); var t = e.touches ? e.touches[0] : e; return { x: t.clientX - r.left, y: t.clientY - r.top }; }
    function start(e) { if (!_sigCtx) return; drawing = true; _sigDirty = true; var p = pos(e); _sigCtx.beginPath(); _sigCtx.moveTo(p.x, p.y); e.preventDefault(); }
    function move(e) { if (!drawing || !_sigCtx) return; var p = pos(e); _sigCtx.lineTo(p.x, p.y); _sigCtx.stroke(); e.preventDefault(); }
    function end() { drawing = false; }
    c.addEventListener('mousedown', start); c.addEventListener('mousemove', move); window.addEventListener('mouseup', end);
    c.addEventListener('touchstart', start, { passive: false }); c.addEventListener('touchmove', move, { passive: false }); c.addEventListener('touchend', end);
  }
  NM.sigClear = function () { if (_sigCtx && _sigCanvas) { _sigCtx.clearRect(0, 0, _sigCanvas.width, _sigCanvas.height); _sigDirty = false; } };
  NM.sigSubmit = function (id) {
    if (!_sigDirty || !_sigCanvas) { alert('서명을 먼저 입력해주세요.'); return; }
    var png = _sigCanvas.toDataURL('image/png');
    api('/api/notice-signatures', { method: 'POST', body: JSON.stringify({ notice_id: id, signature: png }) })
      .then(function (j) {
        if (j && j.error) { alert('오류: ' + j.error); return; }
        if (_mySigned.indexOf(id) < 0) _mySigned.push(id);
        alert('확인 및 서명이 완료되었습니다.');
        closeSheet();
        NM.renderNotices();
      }).catch(function () { alert('네트워크 오류'); });
  };

  function loadSigStatus(id) {
    api('/api/notice-signatures?notice_id=' + id).then(function (r) {
      var el = document.getElementById('nm-sigstat'); if (!el || !r) return;
      var signed = r.signed || [], unsigned = r.unsigned || [];
      var total = signed.length + unsigned.length;
      var pct = total ? Math.round(signed.length / total * 100) : 0;
      var signedHtml = signed.length ? '<details style="margin-bottom:6px"><summary style="font-size:12px;color:#2f9e5f;font-weight:800;cursor:pointer;padding:5px 0">✅ 확인 완료 ' + signed.length + '명 (펼쳐서 서명 보기)</summary><div style="margin-top:2px">'
        + signed.map(function (s) {
          var t = s.signed_at ? new Date(s.signed_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
          return '<div style="display:flex;align-items:center;gap:9px;padding:6px 0;border-top:1px solid #f3f3f3">'
            + '<img src="' + esc(s.signature) + '" onclick="NM.zoom(this.src)" draggable="false" style="width:66px;height:34px;object-fit:contain;background:#fff;border:1px solid #e2e2e2;border-radius:6px;cursor:zoom-in;flex:0 0 auto">'
            + '<div><div style="font-size:13px;font-weight:800;color:#0f172a">' + esc(s.name) + '</div><div style="font-size:10px;color:#9a9aa0">' + t + '</div></div></div>';
        }).join('') + '</div></details>' : '';
      var unsignedHtml = unsigned.length
        ? '<details style="margin-bottom:8px"><summary style="font-size:12px;color:#c0392b;font-weight:800;cursor:pointer;padding:5px 0">⏳ 미확인 ' + unsigned.length + '명 (펼쳐서 보기)</summary><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">'
          + unsigned.map(function (u) { return '<span style="font-size:11px;font-weight:700;padding:4px 9px;border-radius:14px;background:#fdeaea;color:#c0392b">' + esc(u) + '</span>'; }).join('') + '</div></details>'
          + '<button onclick="NM.remind(\'' + id + '\')" style="width:100%;border:none;background:#111;color:#fff;border-radius:11px;padding:10px;font-size:12px;font-weight:800">🔔 미확인자에게 확인 요청 푸시</button>'
        : '<div style="font-size:12px;font-weight:800;color:#1c7a43">✅ 전원 확인 완료</div>';
      el.innerHTML = '<div style="background:#fff;border:1px solid #eee;border-radius:12px;padding:13px">'
        + '<div style="display:flex;justify-content:space-between;font-size:12px;font-weight:800;color:#555;margin-bottom:8px"><span>👤 서명 현황</span><span style="color:#2f9e5f">' + signed.length + ' / ' + total + ' 확인</span></div>'
        + '<div style="height:9px;border-radius:5px;background:#eee;overflow:hidden;margin-bottom:9px"><div style="height:100%;background:#2f9e5f;width:' + pct + '%"></div></div>'
        + signedHtml + unsignedHtml
        + '</div>';
    });
  }
  NM.remind = function (id) {
    if (!confirm('미확인자에게 확인 요청 푸시를 보낼까요?')) return;
    api('/api/notice-signatures', { method: 'POST', body: JSON.stringify({ notice_id: id, action: 'remind' }) })
      .then(function (j) { alert(j && j.reminded != null ? (j.reminded + '명에게 발송했습니다.') : '발송됨'); });
  };

  NM.delNotice = function (id) {
    if (!confirm('이 공지를 삭제할까요?')) return;
    api('/api/notices', { method: 'DELETE', body: JSON.stringify({ id: id }) })
      .then(function (j) { if (j && j.error) { alert(j.error); return; } closeSheet(); NM.renderNotices(); });
  };
  NM.notify = function (id) {
    if (!confirm('전체 미소지기에게 이 공지 알림(푸시)을 보낼까요?')) return;
    api('/api/notices', { method: 'POST', body: JSON.stringify({ id: id, action: 'notify' }) })
      .then(function (j) { if (j && j.error) { alert('오류: ' + j.error); return; } alert('알림을 발송했습니다.'); })
      .catch(function () { alert('네트워크 오류'); });
  };

  NM.openNoticeForm = function (id) {
    var n = id ? _notices[id] : null;
    _formImgs = n && n.images ? n.images.slice() : [];
    var catOpts = N_CATS.map(function (c) { return '<option ' + (n && n.category === c ? 'selected' : '') + '>' + c + '</option>'; }).join('');
    var v = function (x) { return n && n[x] != null ? esc(n[x]) : ''; };
    var ck = function (x) { return n && n[x] ? 'checked' : ''; };
    var inS = 'width:100%;padding:11px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box';
    var html = '<div style="font-size:16px;font-weight:800;margin-bottom:12px">' + (id ? '공지 수정' : '새 공지 작성') + '</div>'
      + '<input id="nf-title" placeholder="제목" value="' + v('title') + '" style="' + inS + ';margin-bottom:8px">'
      + '<textarea id="nf-body" placeholder="내용" style="' + inS + ';margin-bottom:8px;min-height:120px;resize:vertical">' + (n ? esc(n.body) : '') + '</textarea>'
      + '<label style="font-size:12px;font-weight:700;color:#555">카테고리</label><select id="nf-cat" style="' + inS + ';margin:4px 0 10px">' + catOpts + '</select>'
      + '<div style="display:flex;gap:8px;margin-bottom:10px"><div style="flex:1"><label style="font-size:12px;font-weight:700;color:#555">노출 시작</label><input id="nf-start" type="date" value="' + v('start_date') + '" style="' + inS + '"></div>'
      + '<div style="flex:1"><label style="font-size:12px;font-weight:700;color:#555">노출 종료</label><input id="nf-end" type="date" value="' + v('end_date') + '" style="' + inS + '"></div></div>'
      + '<div style="font-size:11px;color:#94a3b8;margin-bottom:10px">비워두면 상시 노출</div>'
      + '<label style="display:flex;align-items:center;gap:8px;font-weight:700;margin-bottom:7px"><input type="checkbox" id="nf-pin" ' + ck('pinned') + '> 📌 상단 고정</label>'
      + '<label style="display:flex;align-items:center;gap:8px;font-weight:700;margin-bottom:7px"><input type="checkbox" id="nf-imp" ' + ck('important') + '> 🔴 중요 (작성 시 전체 푸시 알림)</label>'
      + '<label style="display:flex;align-items:center;gap:8px;font-weight:700;margin-bottom:12px"><input type="checkbox" id="nf-sig" ' + ck('require_signature') + '> ✍ 서명 필요 (미소지기 확인 서명 강제)</label>'
      + '<label style="font-size:12px;font-weight:700;color:#555">사진 첨부 (선택)</label>'
      + '<input id="nf-imgs" type="file" accept="image/*" multiple onchange="NM.pickImgs(event)" style="' + inS + ';margin:5px 0 8px">'
      + '<div id="mf-preview" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px"></div>'
      + '<button onclick="NM.saveNotice(' + (id ? "'" + id + "'" : 'null') + ')" style="width:100%;padding:14px;background:#e71a0f;color:#fff;border:none;border-radius:13px;font-weight:800;font-size:15px">' + (id ? '수정 저장' : '공지 등록') + '</button>';
    openSheet(html, true);
    renderImgPreview();
  };
  NM.saveNotice = function (id) {
    var body = {
      title: document.getElementById('nf-title').value.trim(),
      body: document.getElementById('nf-body').value,
      category: document.getElementById('nf-cat').value,
      start_date: document.getElementById('nf-start').value || null,
      end_date: document.getElementById('nf-end').value || null,
      pinned: document.getElementById('nf-pin').checked,
      important: document.getElementById('nf-imp').checked,
      require_signature: document.getElementById('nf-sig').checked,
      images: _formImgs
    };
    if (!body.title) { alert('제목을 입력해주세요.'); return; }
    var opt = id ? { method: 'PATCH', body: JSON.stringify(Object.assign({ id: id }, body)) } : { method: 'POST', body: JSON.stringify(body) };
    api('/api/notices', opt).then(function (j) {
      if (j && j.error) { alert('오류: ' + j.error); return; }
      closeSheet(); NM.renderNotices();
    }).catch(function () { alert('네트워크 오류'); });
  };

  /* ══════════════════════ 매뉴얼 ══════════════════════ */
  NM.renderManuals = function () {
    injectNMStyle();
    var host = document.getElementById('view-manual'); if (!host) return;
    var g = gateMsg('매뉴얼'); if (g) { host.innerHTML = g; return; }
    host.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:30px">불러오는 중…</div>';
    api('/api/manuals').then(function (list) {
      list = Array.isArray(list) ? list : [];
      var filters = M_TYPES.concat(M_CATS);
      var chips = '<div style="display:flex;gap:6px;overflow-x:auto;padding:4px 2px 12px">' + filters.map(function (c) {
        var on = _mFilter === c;
        return '<button onclick="NM.setMFilter(\'' + c + '\')" style="flex:0 0 auto;border:1px solid ' + (on ? '#1a1a1a' : '#e2e2e2') + ';background:' + (on ? '#1a1a1a' : '#fff') + ';color:' + (on ? '#fff' : '#555') + ';padding:6px 12px;border-radius:20px;font-size:12px;font-weight:700;white-space:nowrap">' + c + '</button>';
      }).join('') + '</div>';
      var items = list.filter(function (m) { return _mFilter === '전체' || m.category === _mFilter || m.type === _mFilter; });
      var body = items.length ? items.map(manualCard).join('') : '<div style="text-align:center;color:#94a3b8;padding:30px;font-weight:700">매뉴얼이 없습니다.</div>';
      var addBtn = isAdmin() ? '<button onclick="NM.openManualForm()" style="width:100%;margin-bottom:12px;padding:13px;background:#e71a0f;color:#fff;border:none;border-radius:13px;font-weight:800;font-size:14px">＋ 새 매뉴얼 작성</button>' : '';
      host.innerHTML = '<div style="padding:4px 14px">' + addBtn + chips + body + '</div>';
    }).catch(function () { host.innerHTML = '<div style="text-align:center;color:#dc2626;padding:30px">불러오기 실패</div>'; });
  };
  NM.setMFilter = function (c) { _mFilter = (_mFilter === c ? '전체' : c); NM.renderManuals(); }; // 같은 칩 다시 누르면 전체

  var _manuals = {};
  function manualCard(m) {
    _manuals[m.id] = m;
    var thumb = (m.images && m.images[0]) ? '<img src="' + esc(m.images[0]) + '" style="width:58px;height:58px;border-radius:10px;object-fit:cover;flex:0 0 auto" draggable="false">' : '<div style="width:58px;height:58px;border-radius:10px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:22px;flex:0 0 auto">📄</div>';
    var imgCnt = m.images && m.images.length ? ' · 사진 ' + m.images.length + '장' : '';
    return '<div onclick="NM.openManual(\'' + m.id + '\')" style="background:#fff;border:1px solid #eee;border-radius:14px;padding:11px 12px;margin-bottom:10px;cursor:pointer;display:flex;gap:11px;align-items:center">'
      + thumb + '<div style="min-width:0"><div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:5px"><span style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:6px;' + (typeCls[m.type] || typeCls['일반']) + '">' + esc(m.type) + '</span><span style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:6px;' + (catCls[m.category] || catCls['매점']) + '">' + esc(m.category) + '</span></div>'
      + '<div style="font-size:14px;font-weight:800;line-height:1.35;color:#0f172a">' + esc(m.title) + '</div>'
      + '<div style="font-size:11px;color:#9a9aa0;margin-top:3px;font-weight:600">' + esc(m.type) + imgCnt + '</div></div></div>';
  }

  NM.openManual = function (id) {
    var m = _manuals[id]; if (!m) return;
    var imgs = (m.images || []).map(protectedImg).join('')
      + (m.images && m.images.length ? '<div style="text-align:center;font-size:11px;color:#b0b0b6;margin-top:6px">사진을 탭하면 확대됩니다</div>' : '');
    var adminBtns = isAdmin() ? '<div style="display:flex;gap:8px;margin-top:14px"><button onclick="NM.openManualForm(\'' + id + '\')" style="flex:1;padding:10px;background:#f1f5f9;border:none;border-radius:10px;font-weight:800;color:#334155">수정</button><button onclick="NM.delManual(\'' + id + '\')" style="flex:1;padding:10px;background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;font-weight:800;color:#dc2626">삭제</button></div>' : '';
    var html = '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px"><span style="font-size:10px;font-weight:800;padding:3px 9px;border-radius:6px;' + (typeCls[m.type] || typeCls['일반']) + '">' + esc(m.type) + '</span><span style="font-size:10px;font-weight:800;padding:3px 9px;border-radius:6px;' + (catCls[m.category] || catCls['매점']) + '">' + esc(m.category) + '</span></div>'
      + '<div style="font-size:17px;font-weight:800;line-height:1.35">' + esc(m.title) + '</div>'
      + '<div class="nm-protected nm-body" style="border-top:1px solid #f0f0f0;padding-top:12px;margin-top:10px;position:relative">' + renderMd(m.body) + imgs + '</div>' + adminBtns;
    openSheet(html, true);
  };
  NM.delManual = function (id) {
    if (!confirm('이 매뉴얼을 삭제할까요?')) return;
    api('/api/manuals', { method: 'DELETE', body: JSON.stringify({ id: id }) })
      .then(function (j) { if (j && j.error) { alert(j.error); return; } closeSheet(); NM.renderManuals(); });
  };

  var _formImgs = [];
  NM.openManualForm = function (id) {
    var m = id ? _manuals[id] : null;
    _formImgs = m && m.images ? m.images.slice() : [];
    var typeOpts = M_TYPES.map(function (t) { return '<option ' + (m && m.type === t ? 'selected' : '') + '>' + t + '</option>'; }).join('');
    var catOpts = M_CATS.map(function (c) { return '<option ' + (m && m.category === c ? 'selected' : '') + '>' + c + '</option>'; }).join('');
    var inS = 'width:100%;padding:11px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box';
    var html = '<div style="font-size:16px;font-weight:800;margin-bottom:12px">' + (id ? '매뉴얼 수정' : '새 매뉴얼 작성') + '</div>'
      + '<input id="mf-title" placeholder="제목" value="' + (m ? esc(m.title) : '') + '" style="' + inS + ';margin-bottom:8px">'
      + '<div style="display:flex;gap:8px;margin-bottom:8px"><select id="mf-type" style="' + inS + '">' + typeOpts + '</select><select id="mf-cat" style="' + inS + '">' + catOpts + '</select></div>'
      + '<textarea id="mf-body" placeholder="본문 내용" style="' + inS + ';margin-bottom:10px;min-height:140px;resize:vertical">' + (m ? esc(m.body) : '') + '</textarea>'
      + '<label style="font-size:12px;font-weight:700;color:#555">사진 첨부</label>'
      + '<input id="mf-imgs" type="file" accept="image/*" multiple onchange="NM.pickImgs(event)" style="' + inS + ';margin:5px 0 8px">'
      + '<div id="mf-preview" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px"></div>'
      + '<button onclick="NM.saveManual(' + (id ? "'" + id + "'" : 'null') + ')" style="width:100%;padding:14px;background:#e71a0f;color:#fff;border:none;border-radius:13px;font-weight:800;font-size:15px">' + (id ? '수정 저장' : '매뉴얼 등록') + '</button>';
    openSheet(html, true);
    renderImgPreview();
  };
  NM.pickImgs = function (e) {
    var files = Array.prototype.slice.call(e.target.files || []);
    var done = 0; if (!files.length) return;
    files.forEach(function (f) {
      var rd = new FileReader();
      rd.onload = function () { _formImgs.push(rd.result); if (++done === files.length) renderImgPreview(); };
      rd.readAsDataURL(f);
    });
  };
  function renderImgPreview() {
    var el = document.getElementById('mf-preview'); if (!el) return;
    el.innerHTML = _formImgs.map(function (src, i) {
      return '<div style="position:relative"><img src="' + esc(src) + '" style="width:60px;height:60px;object-fit:cover;border-radius:8px"><button onclick="NM.rmImg(' + i + ')" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:#e71a0f;color:#fff;border:none;font-size:12px;line-height:1">×</button></div>';
    }).join('');
  }
  NM.rmImg = function (i) { _formImgs.splice(i, 1); renderImgPreview(); };
  NM.saveManual = function (id) {
    var body = {
      title: document.getElementById('mf-title').value.trim(),
      type: document.getElementById('mf-type').value,
      category: document.getElementById('mf-cat').value,
      body: document.getElementById('mf-body').value,
      images: _formImgs
    };
    if (!body.title) { alert('제목을 입력해주세요.'); return; }
    var btn = event && event.target; if (btn) { btn.disabled = true; btn.textContent = '저장 중…'; }
    var opt = id ? { method: 'PATCH', body: JSON.stringify(Object.assign({ id: id }, body)) } : { method: 'POST', body: JSON.stringify(body) };
    api('/api/manuals', opt).then(function (j) {
      if (j && j.error) { alert('오류: ' + j.error); if (btn) { btn.disabled = false; btn.textContent = '저장'; } return; }
      closeSheet(); NM.renderManuals();
    }).catch(function () { alert('네트워크 오류'); if (btn) { btn.disabled = false; } });
  };

  /* ── 공통 시트(모달) + 보안(워터마크/저장차단) ── */
  function openSheet(innerHtml, protectedContent) {
    closeSheet();
    var ov = document.createElement('div');
    ov.id = 'nm-sheet-ov';
    ov.style.cssText = 'position:fixed;inset:0;z-index:99998;background:rgba(15,23,42,.5);display:flex;align-items:flex-end;justify-content:center';
    ov.onclick = function (e) { if (e.target === ov) closeSheet(); };
    var wm = protectedContent ? watermarkLayer() : '';
    ov.innerHTML = '<div id="nm-sheet" style="width:100%;max-width:460px;max-height:88vh;overflow:auto;overscroll-behavior:contain;touch-action:pan-y;background:#fff;border-radius:20px 20px 0 0;padding:18px 16px calc(22px + env(safe-area-inset-bottom));position:relative">'
      + '<button onclick="NM.closeSheet()" style="position:absolute;top:12px;right:12px;border:none;background:#f1f5f9;width:30px;height:30px;border-radius:50%;font-size:17px;color:#64748b;z-index:5">×</button>'
      + wm + '<div style="position:relative;z-index:1;margin-top:6px">' + innerHtml + '</div></div>';
    document.body.appendChild(ov);
    lockBody(); // 뒷배경 스크롤 견고 잠금(iOS 포함)
    if (protectedContent) hardenProtected();
  }
  function closeSheet() {
    var o = document.getElementById('nm-sheet-ov');
    if (o) { o.remove(); if (!document.getElementById('nm-zoom')) unlockBody(); }
  }
  NM.closeSheet = closeSheet;
  // iOS 안전 스크롤 잠금 (overflow:hidden만으론 배경이 움직여서 position:fixed 방식 사용)
  var _lockY = 0, _locked = false;
  function lockBody() {
    if (_locked) return;
    _lockY = window.pageYOffset || document.documentElement.scrollTop || 0;
    var b = document.body.style;
    b.position = 'fixed'; b.top = (-_lockY) + 'px'; b.left = '0'; b.right = '0'; b.width = '100%';
    _locked = true;
  }
  function unlockBody() {
    if (!_locked) return;
    var b = document.body.style;
    b.position = ''; b.top = ''; b.left = ''; b.right = ''; b.width = '';
    _locked = false;
    window.scrollTo(0, _lockY);
  }

  // 사진 전체화면 확대(라이트박스): 탭하면 확대/축소, 확대 시 스크롤로 이동. 워터마크 유지.
  NM.zoom = function (src) {
    NM.closeZoom();
    var mark = esc(me() || '미소지기') + ' · ' + new Date().toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    var wm = '';
    for (var i = 0; i < 24; i++) wm += '<span style="color:rgba(255,255,255,.13);font-size:12px;font-weight:800;transform:rotate(-24deg);white-space:nowrap">' + mark + '</span>';
    var ov = document.createElement('div');
    ov.id = 'nm-zoom';
    ov.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.93);overflow:auto;-webkit-overflow-scrolling:touch;display:flex;align-items:center;justify-content:center';
    ov.innerHTML =
      '<div style="position:fixed;inset:0;z-index:1;pointer-events:none;display:flex;flex-wrap:wrap;gap:40px 28px;align-content:flex-start;padding:70px 12px;overflow:hidden">' + wm + '</div>'
      + '<img id="nm-zoom-img" src="' + esc(src) + '" draggable="false" oncontextmenu="return false" style="max-width:100%;max-height:100%;position:relative;z-index:2;cursor:zoom-in">'
      + '<button onclick="NM.closeZoom()" style="position:fixed;top:14px;right:14px;width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.18);color:#fff;border:none;font-size:22px;z-index:3">×</button>'
      + '<div style="position:fixed;bottom:16px;left:0;right:0;text-align:center;color:rgba(255,255,255,.7);font-size:12px;font-weight:700;z-index:3;pointer-events:none">사진을 탭하면 확대 · 다시 탭하면 축소</div>';
    document.body.appendChild(ov);
    var img = document.getElementById('nm-zoom-img');
    var zoomed = false;
    img.addEventListener('click', function (e) {
      e.stopPropagation();
      zoomed = !zoomed;
      if (zoomed) {
        img.style.maxWidth = 'none'; img.style.maxHeight = 'none';
        img.style.width = (ov.clientWidth * 2.6) + 'px'; img.style.cursor = 'zoom-out';
        ov.style.alignItems = 'flex-start'; ov.style.justifyContent = 'flex-start';
      } else {
        img.style.maxWidth = '100%'; img.style.maxHeight = '100%'; img.style.width = ''; img.style.cursor = 'zoom-in';
        ov.style.alignItems = 'center'; ov.style.justifyContent = 'center';
        ov.scrollTo(0, 0);
      }
    });
    ov.addEventListener('click', function (e) { if (e.target === ov) NM.closeZoom(); });
  };
  NM.closeZoom = function () { var z = document.getElementById('nm-zoom'); if (z) z.remove(); };

  function watermarkLayer() {
    var mark = esc(me() || '미소지기') + ' · ' + new Date().toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    var cells = '';
    for (var i = 0; i < 40; i++) cells += '<span style="color:rgba(120,120,130,.14);font-size:12px;font-weight:800;transform:rotate(-24deg);white-space:nowrap">' + mark + '</span>';
    return '<div class="nm-wm" style="position:absolute;inset:0;z-index:2;pointer-events:none;display:flex;flex-wrap:wrap;gap:34px 26px;align-content:flex-start;padding:60px 10px;overflow:hidden">' + cells + '</div>';
  }
  function hardenProtected() {
    var s = document.getElementById('nm-sheet'); if (!s) return;
    s.style.webkitUserSelect = 'none'; s.style.userSelect = 'none'; s.style.webkitTouchCallout = 'none';
    s.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    s.addEventListener('dragstart', function (e) { e.preventDefault(); });
  }
  // 앱 백그라운드 전환 시 열린 시트 블러 (엿보기·녹화 억제)
  document.addEventListener('visibilitychange', function () {
    var s = document.getElementById('nm-sheet'); if (!s) return;
    s.style.filter = document.visibilityState === 'visible' ? '' : 'blur(14px)';
  });
})();
