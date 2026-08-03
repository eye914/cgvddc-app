/* 근태 → 전체 근무표(그리드) — window.RO
   근태가 읽는 (맞교대) 스케줄(/api/schedule)을 슬롯×포지션 그리드로 자동 변환.
   · 이번 주를 먼저 즉시 표시 → 나머지 주는 백그라운드 로드(초기 로딩 단축)
   · 타임슬롯은 D1~N2 전체를 항상 표시(빈 칸 포함) */
(function () {
  var RO = (window.RO = window.RO || {});
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  var CC = { '매점': '#185FA5', '플로어': '#2f7d1f', '통합': '#993556' };
  var BG = { '매점': '#E6F1FB', '플로어': '#EAF3DE', '통합': '#FBEAF0' };
  var POS = ['매점', '플로어', '통합'];
  var SHIFT_ORDER = ['D1', 'D2', 'D3', 'D4', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'N1', 'N2'];
  var SHIFT_IDX = {}; SHIFT_ORDER.forEach(function (s, i) { SHIFT_IDX[s] = i; });
  // 데이터에 없는 슬롯의 기본 시간(폴백)
  var DEFAULT_TIME = { D1: '09:00-14:30', D2: '09:30-15:00', D3: '10:00-15:30', D4: '10:30-16:00', M1: '11:30-17:00', M2: '12:30-18:00', M3: '13:00-18:30', M4: '13:30-19:00', M5: '14:00-19:30', M6: '14:30-20:00', M7: '15:30-21:00', M8: '16:30-22:00', N1: '18:00-23:30', N2: '19:00-24:30' };

  var _weeks = null, _wsel = 0, _dsel = 0, _loaded = false, _selKey = '';

  function fmt(dt) { return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0'); }
  function addDays(dt, n) { var d = new Date(dt); d.setDate(d.getDate() + n); return d; }
  function mdNum(md) { var m = String(md).match(/(\d{1,2})\s*\/\s*(\d{1,2})/); return m ? (+m[1]) * 100 + (+m[2]) : 0; }
  function prettyWk(key) { var m = String(key).match(/(\d+)월\s*(\d+)주차/); return m ? (m[1] + '월 ' + m[2] + '주차') : String(key).replace(/\s*\(맞교대\)\s*/, ''); }
  function todayMD() { var n = new Date(); return (n.getMonth() + 1) + '/' + n.getDate(); }

  // 스케줄 배열 → { days:[{date,dow,ord,slots:{shiftCode:{time,매점,플로어,통합}}}], timeMap }
  function buildWeek(schedule) {
    var byDate = {}, timeMap = {};
    schedule.forEach(function (r) {
      var m = String(r.date).match(/(\d{1,2})\s*\/\s*(\d{1,2})/); if (!m) return;
      var md = (+m[1]) + '/' + (+m[2]);
      var dw = (String(r.date).match(/\(([월화수목금토일])\)/) || [])[1] || '';
      if (POS.indexOf(r.position) < 0) return;
      if (r.shiftCode && r.time && !timeMap[r.shiftCode]) timeMap[r.shiftCode] = r.time;
      var d = byDate[md] || (byDate[md] = { dow: dw, ord: mdNum(md), slots: {} });
      var cell = d.slots[r.shiftCode] || (d.slots[r.shiftCode] = { time: r.time || '' });
      var label = String(r.name || '').trim() + (r.note ? (' ' + String(r.note).trim()) : '');
      cell[r.position] = cell[r.position] ? (cell[r.position] + ', ' + label) : label;
    });
    var days = Object.keys(byDate).sort(function (a, b) { return byDate[a].ord - byDate[b].ord; }).map(function (md) {
      var d = byDate[md]; return { date: md, dow: d.dow, ord: d.ord, slots: d.slots };
    });
    return { days: days, timeMap: timeMap };
  }

  function fetchWeek(dt) {
    return fetch('/api/schedule?mode=today&date=' + encodeURIComponent(dt))
      .then(function (r) { return r.json(); })
      .then(function (t) {
        if (!t || !t.weekKey || !Array.isArray(t.schedule) || !t.schedule.length) return null;
        var b = buildWeek(t.schedule);
        return { key: t.weekKey, label: prettyWk(t.weekKey), days: b.days, timeMap: b.timeMap, ord: b.days[0] ? b.days[0].ord : 0 };
      })
      .catch(function () { return null; });
  }
  function mergeWeeks(list) {
    _weeks = _weeks || [];
    list.forEach(function (w) { if (w && !_weeks.some(function (x) { return x.key === w.key; })) _weeks.push(w); });
    _weeks.sort(function (a, b) { return a.ord - b.ord; });
  }
  function idxOfKey(k) { for (var i = 0; i < _weeks.length; i++) if (_weeks[i].key === k) return i; return -1; }

  RO.render = function (force) {
    var host = document.getElementById('roster-body'); if (!host) return;
    if (_loaded && !force) { paint(); return; }
    if (!_weeks) host.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:34px;font-size:13px;font-weight:700">불러오는 중…</div>';
    // 1) 이번 주 먼저 → 즉시 렌더
    fetchWeek(fmt(new Date())).then(function (w) {
      _loaded = true;
      if (w) { mergeWeeks([w]); _selKey = w.key; _wsel = Math.max(0, idxOfKey(w.key)); _dsel = pickTodayDay(w.days); }
      paint();
      loadNeighbors(); // 2) 나머지 주는 백그라운드
    }).catch(function () { if (!_weeks) host.innerHTML = '<div style="text-align:center;color:#dc2626;padding:30px;font-weight:700">불러오기 실패</div>'; });
  };

  function loadNeighbors() {
    var base = new Date();
    Promise.all([-7, 7, 14].map(function (o) { return fetchWeek(fmt(addDays(base, o))); })).then(function (ws) {
      var before = (_weeks || []).length;
      mergeWeeks(ws.filter(Boolean));
      if ((_weeks || []).length !== before) {
        if (_selKey) { var i = idxOfKey(_selKey); if (i >= 0) _wsel = i; }
        paint();
      }
    });
  }

  function pickTodayDay(days) {
    var md = todayMD();
    for (var i = 0; i < days.length; i++) { if (String(days[i].date) === md) return i; }
    return 0;
  }

  function paint() {
    var host = document.getElementById('roster-body'); if (!host) return;
    if (!_weeks || !_weeks.length) {
      host.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:40px 20px;font-weight:700;background:#f8fafc;border-radius:14px">표시할 근무표가 없습니다.<div style="font-size:12px;color:#b8b8be;margin-top:6px;font-weight:600">해당 주차가 아직 공개되지 않았을 수 있어요.</div></div>';
      return;
    }
    if (_wsel >= _weeks.length) _wsel = 0;
    var wk = _weeks[_wsel];
    if (_dsel >= wk.days.length) _dsel = 0;

    var weekSel = '';
    if (_weeks.length > 1) {
      weekSel = '<div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:8px;margin-bottom:6px">' + _weeks.map(function (w, i) {
        var on = i === _wsel;
        return '<button onclick="RO.pickWeek(' + i + ')" style="flex:0 0 auto;padding:6px 12px;border-radius:10px;font-size:12px;font-weight:800;border:1px solid ' + (on ? '#0f172a' : '#e2e2e2') + ';background:' + (on ? '#0f172a' : '#fff') + ';color:' + (on ? '#fff' : '#555') + '">' + esc(w.label) + '</button>';
      }).join('') + '</div>';
    } else {
      weekSel = '<div style="font-size:12px;color:#94a3b8;font-weight:700;margin:2px 0 8px">' + esc(wk.label) + '</div>';
    }

    var dayPick = '<div style="display:flex;gap:5px;overflow-x:auto;padding-bottom:8px">' + wk.days.map(function (d, i) {
      var on = i === _dsel;
      return '<button onclick="RO.pickDay(' + i + ')" style="flex:0 0 auto;padding:6px 11px;border-radius:9px;font-size:12px;font-weight:700;border:1px solid ' + (on ? '#d8463a' : '#e2e2e2') + ';background:' + (on ? '#d8463a' : '#fff') + ';color:' + (on ? '#fff' : '#555') + '">' + esc(d.dow) + ' ' + esc(d.date) + '</button>';
    }).join('') + '</div>';

    var saveBtn = '<button onclick="RO.saveImg()" style="width:100%;margin-top:12px;padding:11px;border-radius:12px;font-size:13px;font-weight:800;background:#f1f5f9;border:1px solid #e2e8f0;color:#334155">📷 이미지로 저장 · 공유</button>';

    host.innerHTML = weekSel + dayPick + '<div id="roster-capture" style="background:#fff;padding:8px;border-radius:12px">' + gridHtml(wk, wk.days[_dsel]) + '</div>' + saveBtn;
  }

  function gridHtml(week, day) {
    var head = '<tr>'
      + '<th style="width:66px;padding:6px 4px;font-size:10px;color:#94a3b8;text-align:left;font-weight:700">슬롯</th>'
      + POS.map(function (p) { return '<th style="padding:6px 3px;font-size:11px;font-weight:800;color:' + CC[p] + '">' + p + '</th>'; }).join('')
      + '</tr>';
    var body = SHIFT_ORDER.map(function (sc) {
      var cell = day.slots[sc] || {};
      var time = cell.time || week.timeMap[sc] || DEFAULT_TIME[sc] || '';
      var cells = POS.map(function (p) {
        var v = cell[p];
        var inner = v ? '<div style="background:' + BG[p] + ';color:' + CC[p] + ';font-size:11px;font-weight:700;padding:3px 5px;border-radius:6px;line-height:1.3">' + esc(v) + '</div>' : '';
        return '<td style="padding:3px;vertical-align:top;border-left:1px solid #f0f0f0">' + inner + '</td>';
      }).join('');
      return '<tr style="border-top:1px solid #f0f0f0">'
        + '<td style="padding:5px 4px;vertical-align:top"><div style="font-size:11px;font-weight:800;color:#0f172a">' + sc + '</div><div style="font-size:9px;color:#a3a3aa">' + esc(time) + '</div></td>'
        + cells + '</tr>';
    }).join('');
    return '<div style="text-align:center;font-size:14px;font-weight:800;color:#0f172a;margin:4px 0 8px">' + esc(day.dow) + '요일 · ' + esc(day.date) + '</div>'
      + '<table style="width:100%;border-collapse:collapse;table-layout:fixed">' + head + body + '</table>';
  }

  RO.pickWeek = function (i) { _wsel = i; _selKey = _weeks[i].key; _dsel = pickTodayDay(_weeks[i].days); paint(); };
  RO.pickDay = function (i) { _dsel = i; paint(); };

  RO.saveImg = function () {
    var node = document.getElementById('roster-capture'); if (!node) return;
    function shoot() {
      window.html2canvas(node, { backgroundColor: '#ffffff', scale: 2 }).then(function (canvas) {
        var day = _weeks[_wsel].days[_dsel];
        canvas.toBlob(function (blob) {
          var name = '근무표_' + String(day.date).replace('/', '-') + '(' + day.dow + ').png';
          var file = new File([blob], name, { type: 'image/png' });
          if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            navigator.share({ files: [file], title: name }).catch(function () {});
          } else {
            var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
            document.body.appendChild(a); a.click(); a.remove();
          }
        }, 'image/png');
      }).catch(function () { alert('이미지 저장에 실패했어요. 스크린샷으로 저장해 주세요.'); });
    }
    if (window.html2canvas) return shoot();
    var s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    s.onload = shoot;
    s.onerror = function () { alert('이미지 기능을 불러오지 못했어요(네트워크). 스크린샷으로 저장해 주세요.'); };
    document.head.appendChild(s);
  };
})();
