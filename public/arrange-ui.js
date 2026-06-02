/* ─────────────────────────────────────────────────────────────
   스케줄 편성 (Step 2) — 관리자 편성 그리드
   전체화면 오버레이로 동작. 기존 view/탭 비침투(ar- 접두사 스코프).
   데이터: GET /api/arrange  /  배정: POST /api/schedule(assign|remove)
───────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var POS = ['매점', '플로어', '통합'];
  var POS_CLS = { '매점': 'mart', '플로어': 'floor', '통합': 'int' };
  var DAY_KOR = ['월', '화', '수', '목', '금', '토', '일'];
  // [코드, 5.5h 표시, 4.5h 괄호]
  var SHIFTS = {
    d: [['D1', '09:00~14:30', '(~13:30)'], ['D2', '09:30~15:00', '(~14:00)'], ['D3', '10:00~15:30', '(~14:30)'], ['D4', '10:30~16:00', '(~15:00)']],
    m: [['M1', '11:30~17:00', '(~16:00)'], ['M2', '12:30~18:00', '(~17:00)'], ['M3', '13:00~18:30', '(~17:30)'], ['M4', '13:30~19:00', '(~18:00)'], ['M5', '14:00~19:30', '(~18:30)'], ['M6', '14:30~20:00', '(~19:00)'], ['M7', '15:30~21:00', '(~20:00)'], ['M8', '16:30~22:00', '(~21:00)']],
    n: [['N1', '18:00~23:30', '(19:00~)'], ['N2', '19:00~24:30', '(20:00~)']]
  };
  var GROUPS = [['d', '오픈', 'open'], ['m', '미들', 'mid'], ['n', '마감', 'close']];
  var TIME = {}; SHIFTS.d.concat(SHIFTS.m, SHIFTS.n).forEach(function (s) { TIME[s[0]] = { disp: s[1], b45: s[2] }; });

  var ST = { weekKey: null, data: null, day: 0, busy: false, view: 'g' };
  function mn(t) { var p = String(t).split(':'); return (+p[0]) * 60 + (+p[1]); }
  function fmtMin(m) { var h = Math.floor(m / 60), mm = m % 60; return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm; }

  /* ── 유틸 ── */
  function parseMon(wk) { var p = String(wk).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function dateForDay(d) {
    var mon = parseMon(ST.weekKey); var dt = new Date(mon); dt.setDate(mon.getDate() + d);
    return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
  }
  function dayLabel(d) { var dt = parseMon(ST.weekKey); dt.setDate(dt.getDate() + d); return (dt.getMonth() + 1) + '/' + dt.getDate(); }
  function staffBy(name) { return (ST.data.staff || []).find(function (s) { return s.name === name; }); }
  function is45(name) { var s = staffBy(name); return s && parseFloat(s.hours) < 5.0; }
  function submitted(name) { return (ST.data.submitted || []).indexOf(name) > -1; }
  function assignedDays(name) {
    var set = {}; (ST.data.assignments || []).forEach(function (a) { if (a.name === name) set[a.dayOfWeek] = 1; });
    return Object.keys(set).length;
  }
  function cellOf(code, pos) {
    var date = dateForDay(ST.day);
    var pcode = POS_CLS[pos] || pos; // DB position은 영문코드(mart/floor/int)
    return (ST.data.assignments || []).find(function (a) {
      return a.date === date && a.shiftCode === code && (a.position === pcode || a.position === pos);
    });
  }
  // (코드그룹, 요일, 포지션) 가능 직원: 신청자(그 그룹) + 미제출(전체가능)
  function eligible(group, pos) {
    var subs = [], non = [];
    (ST.data.staff || []).forEach(function (s) {
      if (!submitted(s.name)) { non.push(s); return; }
      var av = (ST.data.availability[s.name] || {})[ST.day] || [];
      if (av.indexOf(group) > -1) subs.push(s);
    });
    function rank(arr) {
      return arr.sort(function (a, b) {
        var am = a.pos.indexOf(pos) > -1 || a.pos.indexOf('통합') > -1 ? 0 : 1;
        var bm = b.pos.indexOf(pos) > -1 || b.pos.indexOf('통합') > -1 ? 0 : 1;
        return am - bm || a.name.localeCompare(b.name, 'ko');
      });
    }
    return { subs: rank(subs), non: rank(non) };
  }

  /* ── 스타일 1회 주입 ── */
  function injectStyle() {
    if (document.getElementById('ar-style')) return;
    var css = ''
      + '#ar-root{position:fixed;inset:0;z-index:9000;display:none;background:#f6f6f8;font-family:-apple-system,BlinkMacSystemFont,"Pretendard","Malgun Gothic",sans-serif;color:#2a2a2e;letter-spacing:-.012em;overflow:hidden;}'
      + '#ar-root.show{display:flex;flex-direction:column;}'
      + '.ar-hd{background:rgba(248,248,250,.95);border-bottom:.5px solid #ebebef;padding:12px 16px 11px;}'
      + '.ar-hd-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:11px;}'
      + '.ar-title{font-size:18px;font-weight:800;letter-spacing:-.03em;}'
      + '.ar-close{font-size:15px;color:#6c6c72;background:#ececef;border:none;width:30px;height:30px;border-radius:50%;}'
      + '.ar-week{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;}.ar-week::-webkit-scrollbar{display:none;}'
      + '.ar-wd{flex:0 0 auto;width:42px;height:56px;border-radius:14px;background:#e9e9ee;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;}'
      + '.ar-wd .w{font-size:10px;font-weight:700;color:#b2b2b8;}.ar-wd .d{font-size:16px;font-weight:800;color:#2a2a2e;}'
      + '.ar-wd.sat .d,.ar-wd.sat .w{color:#5b8fd0;}.ar-wd.sun .d,.ar-wd.sun .w{color:#d06b66;}'
      + '.ar-wd.on{background:#4587d6;box-shadow:0 3px 9px rgba(69,135,214,.3);}.ar-wd.on .w,.ar-wd.on .d{color:#fff;}'
      + '.ar-pg{padding:11px 16px 2px;}.ar-pg-row{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:7px;}'
      + '.ar-pg-a{font-size:13px;font-weight:800;}.ar-pg-a span{color:#b2b2b8;font-weight:600;font-size:11px;margin-left:5px;}'
      + '.ar-pg-b{font-size:11px;color:#b2b2b8;font-weight:600;}'
      + '.ar-bar{height:7px;border-radius:5px;background:#e8e8ec;overflow:hidden;}.ar-bar>i{display:block;height:100%;background:#3f9d6e;border-radius:5px;}'
      + '.ar-ch{display:grid;grid-template-columns:56px 1fr 1fr 1fr;gap:7px;padding:14px 16px 2px;}'
      + '.ar-ch div{font-size:11px;font-weight:700;color:#6c6c72;text-align:center;}'
      + '.ar-body{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:0 16px 90px;}'
      + '.ar-sec{display:flex;align-items:center;gap:8px;margin:16px 2px 9px;}.ar-sec .pd{width:9px;height:9px;border-radius:3px;}'
      + '.ar-sec.open .pd{background:#cf9a45;}.ar-sec.mid .pd{background:#5a93bd;}.ar-sec.close .pd{background:#6d6daf;}'
      + '.ar-sec .lb{font-size:13.5px;font-weight:800;}'
      + '.ar-row{display:grid;grid-template-columns:56px 1fr 1fr 1fr;gap:7px;margin-bottom:7px;}'
      + '.ar-cc{display:flex;flex-direction:column;justify-content:center;align-items:center;border-radius:12px;padding:6px 2px;}'
      + '.ar-cc.open{background:#faf3e8;}.ar-cc.mid{background:#eef4f9;}.ar-cc.close{background:#f0eff8;}'
      + '.ar-cc .c{font-size:12.5px;font-weight:800;}.ar-cc.open .c{color:#a9772f;}.ar-cc.mid .c{color:#447aa0;}.ar-cc.close .c{color:#56569a;}'
      + '.ar-cc .t{font-size:8.5px;color:#6c6c72;font-weight:600;margin-top:2px;}'
      + '.ar-sl{min-height:46px;border-radius:13px;display:flex;align-items:center;justify-content:center;padding:4px;}'
      + '.ar-sl.e{background:#fbfbfc;border:1px dashed #e4e4e9;}.ar-sl.e .p{font-size:18px;color:#d0d0d6;}'
      + '.ar-sl.f{background:#fff;border:1.5px solid;}'
      + '.ar-sl.f.mart{border-color:#e6c6bf;}.ar-sl.f.floor{border-color:#c6e0d3;}.ar-sl.f.int{border-color:#d4cfea;}'
      + '.ar-sl .nm{font-size:13px;font-weight:800;line-height:1.1;}'
      + '.ar-sl.f.mart .nm{color:#b15644;}.ar-sl.f.floor .nm{color:#2f7d5c;}.ar-sl.f.int .nm{color:#615aa0;}'
      + '.ar-sl .sb{font-size:8.5px;color:#6c6c72;font-weight:700;margin-top:1px;}'
      + '.ar-foot{position:absolute;left:0;right:0;bottom:0;background:rgba(248,248,250,.95);border-top:.5px solid #ebebef;padding:11px 16px calc(13px + env(safe-area-inset-bottom));display:flex;gap:9px;}'
      + '.ar-btn{border:none;border-radius:14px;padding:14px 0;font-size:13px;font-weight:800;}'
      + '.ar-btn-g{flex:0 0 36%;background:#ececef;color:#6c6c72;}.ar-btn-r{flex:1;background:#d8463a;color:#fff;}'
      + '.ar-ov{position:fixed;inset:0;z-index:9100;background:rgba(0,0,0,.34);display:none;align-items:flex-end;justify-content:center;}'
      + '.ar-ov.show{display:flex;animation:arfade .25s ease;}@keyframes arfade{from{opacity:0}to{opacity:1}}'
      + '.ar-sheet{width:100%;max-width:460px;background:#fff;border-radius:22px 22px 0 0;padding:8px 16px calc(20px + env(safe-area-inset-bottom));max-height:80vh;overflow:auto;animation:arup .4s cubic-bezier(.32,.72,0,1);}'
      + '@keyframes arup{from{transform:translateY(100%)}to{transform:translateY(0)}}'
      + '.ar-grab{width:38px;height:5px;border-radius:3px;background:#dedee2;margin:7px auto 13px;}'
      + '.ar-sh-h{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:2px;}'
      + '.ar-sh-t{font-size:17px;font-weight:800;}.ar-sh-s{font-size:11.5px;color:#6c6c72;font-weight:600;margin-top:3px;}'
      + '.ar-cur{display:flex;align-items:center;gap:9px;background:#fff6f4;border:1px solid #f1d6cf;border-radius:13px;padding:9px 12px;margin:12px 0 4px;}'
      + '.ar-cur .nm{font-size:14px;font-weight:800;flex:1;color:#b15644;}'
      + '.ar-cur .rm{font-size:11px;font-weight:800;color:#fff;background:#c4503e;border:none;border-radius:9px;padding:7px 12px;}'
      + '.ar-grp{font-size:11px;font-weight:700;color:#b2b2b8;margin:15px 2px 8px;display:flex;align-items:center;gap:7px;}'
      + '.ar-gd{width:7px;height:7px;border-radius:50%;}.ar-gd.s{background:#3f9d6e;}.ar-gd.n{background:#c8c8ce;}'
      + '.ar-pr{display:flex;align-items:center;gap:10px;padding:9px 11px;border-radius:14px;margin-bottom:7px;border:.5px solid #ebebef;background:#fff;}'
      + '.ar-pr.s{background:#f4faf6;border-color:#dbede2;}'
      + '.ar-av{width:32px;height:32px;border-radius:50%;flex:0 0 32px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;}'
      + '.ar-av.s{background:#d9eee2;color:#2f7d58;}.ar-av.n{background:#ededf0;color:#8a8a90;}'
      + '.ar-pr .pn{font-size:14px;font-weight:800;flex:1;}'
      + '.ar-tag{font-size:9px;font-weight:700;padding:3px 7px;border-radius:7px;background:#f0f0f2;color:#6c6c72;}'
      + '.ar-cnt{font-size:10px;font-weight:700;color:#2a2a2e;background:#ececef;padding:4px 8px;border-radius:8px;}.ar-cnt.over{background:#f9ece9;color:#bf5848;}'
      + '.ar-add{font-size:12px;font-weight:800;color:#fff;background:#d8463a;border:none;border-radius:10px;padding:8px 13px;}'
      + '.ar-empty{padding:40px 20px;text-align:center;color:#b2b2b8;font-size:13px;font-weight:700;}'
      + '.ar-hint{font-size:10px;color:#b2b2b8;text-align:center;margin:10px 0 2px;font-weight:600;}'
      + '.ar-pr.busy{opacity:.55;}'
      + '.ar-busy{font-size:10px;font-weight:800;color:#9a9aa0;background:#f0f0f2;padding:7px 11px;border-radius:9px;white-space:nowrap;}'
      + '.ar-clear{margin-top:9px;width:100%;border:1px solid #f0d6d2;background:#fdf3f1;color:#c4503e;border-radius:11px;padding:9px 0;font-size:11.5px;font-weight:800;cursor:pointer;}'
      + '.ar-pg-b.link{cursor:pointer;text-decoration:underline;text-underline-offset:2px;}'
      + '.ar-names{display:flex;flex-wrap:wrap;gap:6px;}'
      + '.ar-chip{font-size:12px;font-weight:800;padding:6px 11px;border-radius:9px;}'
      + '.ar-chip.s{background:#e9f6ef;color:#2f8a5f;}.ar-chip.n{background:#f0f0f2;color:#8a8a90;}'
      + '.ar-seg{display:flex;gap:3px;margin:10px 16px 0;background:#e9e9ed;border-radius:11px;padding:3px;}'
      + '.ar-seg button{flex:1;border:none;background:transparent;padding:8px 0;border-radius:9px;font-size:12.5px;font-weight:800;color:#6c6c72;}'
      + '.ar-seg button.on{background:#fff;color:#2a2a2e;box-shadow:0 1px 3px rgba(0,0,0,.08);}'
      + '.ar-vbody{position:relative;margin:8px 0 0;background:#fff;border:.5px solid #eeeef1;border-radius:12px;}'
      + '.ar-hl{position:absolute;left:36px;right:0;height:0;border-top:1px solid #e7e7eb;}'
      + '.ar-hl.half{border-top:1px dotted #cdcdd5;}'
      + '.ar-hlab{position:absolute;left:0;width:30px;text-align:right;transform:translateY(-50%);font-size:9px;color:#b2b2b8;font-weight:700;}'
      + '.ar-vhead{display:flex;gap:6px;padding:0 0 6px;margin-top:6px;}'
      + '.ar-vh-g{flex:0 0 36px;}.ar-vh-c{flex:1;text-align:center;font-size:11.5px;font-weight:800;color:#6c6c72;}'
      + '.ar-vtrack{position:absolute;top:0;bottom:0;left:36px;right:0;display:flex;}'
      + '.ar-vcol{flex:1;position:relative;border-right:1px dashed #dadae1;}.ar-vcol:last-child{border-right:none;}'
      + '.ar-vbar{position:absolute;border-radius:9px;padding:4px 6px;overflow:hidden;border:1px solid transparent;}'
      + '.ar-vbar.mart{background:rgba(190,90,74,.24);border-color:rgba(190,90,74,.45);}.ar-vbar.floor{background:rgba(50,128,95,.22);border-color:rgba(50,128,95,.42);}.ar-vbar.int{background:rgba(100,92,162,.22);border-color:rgba(100,92,162,.42);}'
      + '.ar-vbn{display:block;font-size:10.5px;font-weight:800;letter-spacing:-.03em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'
      + '.ar-vbar.mart .ar-vbn{color:#b15644;}.ar-vbar.floor .ar-vbn{color:#2f7d5c;}.ar-vbar.int .ar-vbn{color:#615aa0;}'
      + '.ar-vbt{display:block;font-size:8px;font-weight:700;color:#6c6c72;opacity:.8;}'
      + '.ar-vlab{position:absolute;left:0;right:0;text-align:center;pointer-events:none;padding-top:3px;z-index:2;}'
      + '.ar-vln{font-size:10.5px;font-weight:800;letter-spacing:-.03em;white-space:nowrap;}'
      + '.ar-vlab.mart .ar-vln{color:#b15644;}.ar-vlab.floor .ar-vln{color:#2f7d5c;}.ar-vlab.int .ar-vln{color:#615aa0;}'
      + '.ar-vlt{display:block;font-size:8px;font-weight:700;color:#6c6c72;opacity:.85;margin-top:1px;}';
    var st = document.createElement('style'); st.id = 'ar-style'; st.textContent = css; document.head.appendChild(st);
  }

  function ensureRoot() {
    injectStyle();
    if (document.getElementById('ar-root')) return;
    var root = document.createElement('div'); root.id = 'ar-root';
    root.innerHTML =
      '<div class="ar-hd">' +
        '<div class="ar-hd-top"><div class="ar-title">스케줄 편성</div><button class="ar-close" onclick="closeArrangeScreen()">✕</button></div>' +
        '<div class="ar-week" id="ar-week"></div>' +
      '</div>' +
      '<div class="ar-seg"><button id="ar-seg-g" class="on" onclick="arrangeView(\'g\')">그리드</button><button id="ar-seg-t" onclick="arrangeView(\'t\')">타임라인</button></div>' +
      '<div class="ar-pg" id="ar-pg"></div>' +
      '<div class="ar-ch" id="ar-ch"><div></div><div>매점</div><div>플로어</div><div>통합</div></div>' +
      '<div class="ar-body" id="ar-body"></div>' +
      '<div class="ar-foot"><button class="ar-btn ar-btn-g" onclick="closeArrangeScreen()">닫기</button><button class="ar-btn ar-btn-r" onclick="arrangeDeploy()">📤 시트로 배포</button></div>';
    document.body.appendChild(root);
    var ov = document.createElement('div'); ov.id = 'ar-ov'; ov.className = 'ar-ov';
    ov.addEventListener('click', function (e) { if (e.target === ov) ov.classList.remove('show'); });
    document.body.appendChild(ov);
  }

  /* ── 렌더 ── */
  function render() {
    var wkLbl = (function () { var m = parseMon(ST.weekKey), s = new Date(m); s.setDate(m.getDate() + 6); return (m.getMonth() + 1) + '/' + m.getDate() + '~' + (s.getMonth() + 1) + '/' + s.getDate(); })();
    document.querySelector('#ar-root .ar-title').textContent = '스케줄 편성 · ' + wkLbl;

    // 주(요일) 스트립
    var wk = '';
    for (var d = 0; d < 7; d++) {
      var cls = d === 5 ? 'sat' : d === 6 ? 'sun' : '';
      wk += '<div class="ar-wd ' + cls + (d === ST.day ? ' on' : '') + '" onclick="arrangeSelDay(' + d + ')"><div class="w">' + DAY_KOR[d] + '</div><div class="d">' + dayLabel(d).split('/')[1] + '</div></div>';
    }
    document.getElementById('ar-week').innerHTML = wk;

    // 진행률 (선택 요일)
    var total = 0, filled = 0;
    GROUPS.forEach(function (g) { SHIFTS[g[0]].forEach(function () { POS.forEach(function () { total++; }); }); });
    (ST.data.assignments || []).forEach(function (a) { if (a.dayOfWeek === ST.day) filled++; });
    var pct = total ? Math.round(filled / total * 100) : 0;
    document.getElementById('ar-pg').innerHTML =
      '<div class="ar-pg-row"><div class="ar-pg-a">배정 ' + pct + '% <span>' + filled + ' 칸</span></div>' +
      '<div class="ar-pg-b link" onclick="arrangeShowStatus()">신청 ' + (ST.data.submitted || []).length + ' · 미제출 ' + ((ST.data.staff || []).length - (ST.data.submitted || []).length) + ' ›</div></div>' +
      '<div class="ar-bar"><i style="width:' + pct + '%"></i></div>' +
      (filled > 0 ? '<button class="ar-clear" onclick="arrangeClearDay()">이 요일 배정 초기화 (' + filled + '칸)</button>' : '');

    var ch = document.getElementById('ar-ch');
    if (ST.view === 't') {
      if (ch) ch.style.display = 'none';
      renderTimeline();
      return;
    }
    if (ch) ch.style.display = '';

    // 그리드
    var html = '';
    GROUPS.forEach(function (g) {
      html += '<div class="ar-sec ' + g[2] + '"><span class="pd"></span><span class="lb">' + g[1] + '</span></div>';
      SHIFTS[g[0]].forEach(function (s) {
        var code = s[0];
        html += '<div class="ar-row"><div class="ar-cc ' + g[2] + '"><span class="c">' + code + '</span><span class="t">' + s[1] + '</span></div>';
        POS.forEach(function (p) {
          var a = cellOf(code, p), cls = POS_CLS[p];
          if (a) {
            var sub = is45(a.name) ? '<span class="sb">' + (TIME[code] ? TIME[code].b45 : '') + '</span>' : '';
            html += '<div class="ar-sl f ' + cls + '" onclick="arrangeSlot(\'' + code + '\',\'' + p + '\')"><div style="display:flex;flex-direction:column;align-items:center"><span class="nm">' + a.name + '</span>' + sub + '</div></div>';
          } else {
            html += '<div class="ar-sl e" onclick="arrangeSlot(\'' + code + '\',\'' + p + '\')"><span class="p">+</span></div>';
          }
        });
        html += '</div>';
      });
    });
    document.getElementById('ar-body').innerHTML = html;
  }

  /* ── 세로 타임라인 (배정 막대) ── */
  function renderTimeline() {
    var START = 540, END = 1470, SPAN = END - START, HOURH = 44, PAD = 14, H = Math.round(SPAN / 60 * HOURH);
    var order = ['매점', '플로어', '통합'];
    var P = { mart: '매점', 'mart-close': '매점', floor: '플로어', int: '통합' };
    var lanes = { '매점': [], '플로어': [], '통합': [] };
    (ST.data.assignments || []).forEach(function (a) {
      if (a.dayOfWeek !== ST.day) return;
      var posK = P[a.position] || a.position;
      if (!lanes[posK]) return;
      var disp = (TIME[a.shiftCode] || {}).disp || '';
      var pp = disp.split('~'); if (pp.length < 2) return;
      var s = mn(pp[0]), e = mn(pp[1]), is45h = (parseFloat(a.hours) || 5.5) < 5.0;
      if (is45h) { if (a.shiftCode.charAt(0) === 'N') s += 60; else e -= 60; }
      lanes[posK].push({ n: a.name, s: s, e: e, code: a.shiftCode, pos: posK, cls: POS_CLS[posK],
        sub: is45h ? (a.shiftCode.charAt(0) === 'N' ? '(' + fmtMin(s) + '~)' : '(~' + fmtMin(e) + ')') : '' });
    });
    var head = '<div class="ar-vhead"><div class="ar-vh-g"></div>' + order.map(function (p) { return '<div class="ar-vh-c">' + p + '</div>'; }).join('') + '</div>';
    var lines = '';
    for (var h = 9; h <= 24; h++) { var top = PAD + (h - 9) / 15.5 * H; lines += '<div class="ar-hl" style="top:' + top + 'px"></div><div class="ar-hlab" style="top:' + top + 'px">' + h + '시</div>'; }
    for (var t = START + 30; t < END; t += 60) { lines += '<div class="ar-hl half" style="top:' + (PAD + (t - START) / SPAN * H) + 'px"></div>'; }
    lines += '<div class="ar-hl" style="top:' + (PAD + H) + 'px"></div>';
    var cols = '';
    order.forEach(function (pos) {
      // 중앙정렬 · 동일 폭 · 분할 안 함 (겹치면 반투명 누적으로 색이 진해짐)
      var items = lanes[pos].slice().sort(function (a, b) { return a.s - b.s; });
      var bars = '';
      items.forEach(function (it) {
        var top = PAD + (it.s - START) / SPAN * H, hgt = (it.e - it.s) / SPAN * H;
        bars += '<div class="ar-vbar ' + it.cls + '" style="top:' + top + 'px;height:' + (hgt - 3) + 'px;left:29.5%;width:41%" onclick="arrangeSlot(\'' + it.code + '\',\'' + pos + '\')"></div>' +
          '<div class="ar-vlab ' + it.cls + '" style="top:' + top + 'px">' +
          '<span class="ar-vln">' + it.n + '</span>' + (it.sub ? '<span class="ar-vlt">' + it.sub + '</span>' : '') + '</div>';
      });
      cols += '<div class="ar-vcol">' + bars + '</div>';
    });
    document.getElementById('ar-body').innerHTML = head +
      '<div class="ar-vbody" style="height:' + (H + PAD * 2) + 'px"><div>' + lines + '</div><div class="ar-vtrack">' + cols + '</div></div>' +
      '<div class="ar-hint">막대 탭 → 해당 슬롯 편집 · 빈 시간대는 그리드에서 배정</div>';
  }
  window.arrangeView = function (v) {
    ST.view = v;
    document.getElementById('ar-seg-g').classList.toggle('on', v === 'g');
    document.getElementById('ar-seg-t').classList.toggle('on', v === 't');
    render();
  };

  /* ── 가능직원 팝업 ── */
  var _slot = null;
  window.arrangeSlot = function (code, pos) {
    _slot = { code: code, pos: pos };
    var group = code.charAt(0).toLowerCase();
    var el = eligible(group, pos);
    var cur = cellOf(code, pos);
    var pcode = POS_CLS[pos] || pos;
    var ov = document.getElementById('ar-ov');
    function row(s, isSub) {
      var ad = assignedDays(s.name), over = ad > s.contractDays;
      // 같은 요일 다른 슬롯에 이미 배정된 경우 → 중복 배정 차단
      var dayAsg = (ST.data.assignments || []).find(function (a) { return a.dayOfWeek === ST.day && a.name === s.name; });
      var here = dayAsg && dayAsg.shiftCode === code && dayAsg.position === pcode;
      var blocked = dayAsg && !here;
      var right = blocked
        ? '<span class="ar-busy">이미 ' + dayAsg.shiftCode + ' 배정</span>'
        : '<button class="ar-add" onclick="arrangeAssign(\'' + s.name.replace(/'/g, "\\'") + '\')">배정</button>';
      return '<div class="ar-pr ' + (isSub ? 's' : '') + (blocked ? ' busy' : '') + '">' +
        '<div class="ar-av ' + (isSub ? 's' : 'n') + '">' + s.name.charAt(0) + '</div>' +
        '<span class="pn">' + s.name + '</span>' +
        '<span class="ar-tag">' + (s.pos.join('·') || '-') + '</span>' +
        '<span class="ar-cnt ' + (over ? 'over' : '') + '">' + ad + '/' + s.contractDays + '</span>' +
        right + '</div>';
    }
    var h = '<div class="ar-grab"></div>' +
      '<div class="ar-sh-h"><div><div class="ar-sh-t">' + code + ' · ' + pos + '</div><div class="ar-sh-s">' + dayLabel(ST.day) + '(' + DAY_KOR[ST.day] + ') ' + (TIME[code] ? TIME[code].disp : '') + ' · 가능 직원</div></div><button class="ar-close" onclick="arrangeCloseSheet()">✕</button></div>';
    if (cur) h += '<div class="ar-cur"><span class="nm">' + cur.name + ' 배정됨</span><button class="rm" onclick="arrangeRemove()">배정 해제</button></div>';
    h += '<div class="ar-grp"><span class="ar-gd s"></span>신청자 (' + el.subs.length + ')</div>';
    h += el.subs.length ? el.subs.map(function (s) { return row(s, true); }).join('') : '<div class="ar-hint">신청자 없음</div>';
    h += '<div class="ar-grp"><span class="ar-gd n"></span>미제출 · 전체 가능 (' + el.non.length + ')</div>';
    h += el.non.length ? el.non.map(function (s) { return row(s, false); }).join('') : '<div class="ar-hint">없음</div>';
    h += '<div class="ar-hint">신청자 먼저 · 미제출자는 회색 · 카운터 빨강=계약일수 초과</div>';
    ov.innerHTML = '<div class="ar-sheet">' + h + '</div>';
    ov.classList.add('show');
  };
  window.arrangeCloseSheet = function () { document.getElementById('ar-ov').classList.remove('show'); };

  function post(body) {
    return fetch('/api/schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(function (r) { return r.json(); });
  }
  function reload() { return loadData(ST.weekKey).then(render); }

  window.arrangeAssign = function (name) {
    if (ST.busy || !_slot) return; ST.busy = true;
    var s = staffBy(name);
    var code = _slot.code, pos = _slot.pos, pcode = POS_CLS[pos] || pos, date = dateForDay(ST.day);
    // 낙관적 업데이트: 즉시 화면 반영
    ST.data.assignments = (ST.data.assignments || []).filter(function (a) { return !(a.date === date && a.shiftCode === code && a.position === pcode); });
    ST.data.assignments.push({ date: date, dayOfWeek: ST.day, shiftCode: code, position: pcode, name: name, hours: String(s ? s.hours : '5.5') });
    arrangeCloseSheet(); render();
    post({ action: 'assign', weekKey: ST.weekKey, date: date, dayOfWeek: ST.day, shiftCode: code, position: pcode, name: name, hours: parseFloat(s ? s.hours : 5.5) || 5.5 })
      .then(function (j) { ST.busy = false; if (j && j.error) { alert('배정 저장 실패: ' + j.error); reload(); } })
      .catch(function () { ST.busy = false; alert('네트워크 오류 — 다시 시도해주세요'); reload(); });
  };
  window.arrangeRemove = function () {
    if (ST.busy || !_slot) return; ST.busy = true;
    var code = _slot.code, pos = _slot.pos, pcode = POS_CLS[pos] || pos, date = dateForDay(ST.day);
    ST.data.assignments = (ST.data.assignments || []).filter(function (a) { return !(a.date === date && a.shiftCode === code && a.position === pcode); });
    arrangeCloseSheet(); render();
    post({ action: 'remove', weekKey: ST.weekKey, date: date, shiftCode: code, position: pcode })
      .then(function (j) { ST.busy = false; if (j && j.error) { alert('해제 저장 실패: ' + j.error); reload(); } })
      .catch(function () { ST.busy = false; alert('네트워크 오류 — 다시 시도해주세요'); reload(); });
  };

  window.arrangeSelDay = function (d) { ST.day = d; render(); };
  window.arrangeDeploy = function () {
    if (ST.busy) return;
    var asgN = (ST.data.assignments || []).length;
    if (!asgN) { alert('배정된 인원이 없습니다.'); return; }
    var mon = parseMon(ST.weekKey);
    var sheetName = String(mon.getFullYear()).slice(-2) + '년' + (mon.getMonth() + 1) + '월' + Math.ceil(mon.getDate() / 7) + '주차(편성)';
    if (!confirm('현재 편성(' + asgN + '칸)을 시트에 작성할까요?\n→ ' + sheetName + ' 탭\n(없으면 전주차 원본 복제 후 작성)')) return;
    ST.busy = true;
    fetch('/api/schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'deploySheet', weekKey: ST.weekKey }) })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        ST.busy = false;
        if (j && j.error) { alert('배포 실패: ' + j.error); return; }
        var rr = (j && j.result) || {};
        if (rr.error) { alert('시트 작성 오류: ' + rr.error); return; }
        var tabs = rr.won ? (rr.won + ' + ' + rr.mat) : (rr.sheet || sheetName);
        var msg = '✅ 시트 배포 완료 (원본+맞교대)\n' + tabs + ' · ' + (rr.written || 0) + '칸 작성';
        if (rr.missed && rr.missed.length) msg += '\n\n⚠ 미반영 ' + rr.missed.length + '건:\n' + rr.missed.slice(0, 8).join('\n');
        alert(msg);
      })
      .catch(function () { ST.busy = false; alert('네트워크 오류'); });
  };

  window.arrangeClearDay = function () {
    var n = (ST.data.assignments || []).filter(function (a) { return a.dayOfWeek === ST.day; }).length;
    if (!n || ST.busy) return;
    if (!confirm(dayLabel(ST.day) + '(' + DAY_KOR[ST.day] + ') 배정 ' + n + '칸을 모두 초기화할까요?')) return;
    ST.busy = true;
    var date = dateForDay(ST.day);
    ST.data.assignments = (ST.data.assignments || []).filter(function (a) { return a.dayOfWeek !== ST.day; });
    render();
    post({ action: 'clearDay', weekKey: ST.weekKey, date: date })
      .then(function (j) { ST.busy = false; if (j && j.error) { alert('초기화 실패: ' + j.error); reload(); } })
      .catch(function () { ST.busy = false; alert('네트워크 오류'); reload(); });
  };

  window.arrangeShowStatus = function () {
    var subSet = {}; (ST.data.submitted || []).forEach(function (n) { subSet[n] = 1; });
    var subs = [], non = [];
    (ST.data.staff || []).forEach(function (s) { (subSet[s.name] ? subs : non).push(s.name); });
    var mon = parseMon(ST.weekKey), sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    var wl = (mon.getMonth() + 1) + '/' + mon.getDate() + '~' + (sun.getMonth() + 1) + '/' + sun.getDate();
    var h = '<div class="ar-grab"></div>' +
      '<div class="ar-sh-h"><div><div class="ar-sh-t">신청 현황</div><div class="ar-sh-s">' + wl + ' · 제출 ' + subs.length + ' / 미제출 ' + non.length + '</div></div><button class="ar-close" onclick="arrangeCloseSheet()">✕</button></div>' +
      '<div class="ar-grp"><span class="ar-gd s"></span>신청 완료 (' + subs.length + ')</div>' +
      (subs.length ? '<div class="ar-names">' + subs.map(function (n) { return '<span class="ar-chip s">' + n + '</span>'; }).join('') + '</div>' : '<div class="ar-hint">없음</div>') +
      '<div class="ar-grp"><span class="ar-gd n"></span>미제출 (' + non.length + ')</div>' +
      (non.length ? '<div class="ar-names">' + non.map(function (n) { return '<span class="ar-chip n">' + n + '</span>'; }).join('') + '</div>' : '<div class="ar-hint">전원 제출 완료</div>') +
      '<div class="ar-hint">미제출자는 편성 시 전체 가능으로 간주됩니다.</div>';
    var ov = document.getElementById('ar-ov');
    ov.innerHTML = '<div class="ar-sheet">' + h + '</div>';
    ov.classList.add('show');
  };

  /* ── 데이터 로드 / 열기 ── */
  function loadData(weekKey) {
    return fetch('/api/arrange?weekKey=' + encodeURIComponent(weekKey)).then(function (r) { return r.json(); })
      .then(function (j) { if (j.error) throw new Error(j.error); ST.data = j; ST.weekKey = weekKey; return j; });
  }

  window.openArrangeScreen = function (wk) {
    if (!wk && typeof window.getSelectedAvailWeek === 'function') { try { wk = window.getSelectedAvailWeek(); } catch (e) {} }
    if (!wk) {
      fetch('/api/availability?mode=active').then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.weekKey) window.openArrangeScreen(j.weekKey);
        else alert('대상 주차를 먼저 선택하거나, 신청을 열어주세요.');
      });
      return;
    }
    ensureRoot();
    var root = document.getElementById('ar-root');
    ST.day = 0;
    document.getElementById('ar-body').innerHTML = '<div class="ar-empty">불러오는 중…</div>';
    root.classList.add('show');
    loadData(wk).then(render).catch(function (e) {
      document.getElementById('ar-body').innerHTML = '<div class="ar-empty">불러오기 실패: ' + (e.message || e) + '</div>';
    });
  };
  window.closeArrangeScreen = function () {
    var r = document.getElementById('ar-root'); if (r) r.classList.remove('show');
    var o = document.getElementById('ar-ov'); if (o) o.classList.remove('show');
  };
})();
