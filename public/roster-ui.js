/* 근태 → 전체 근무표(그리드) — window.RO
   근태가 읽는 (맞교대) 스케줄(/api/schedule)을 슬롯×포지션 그리드로 자동 변환.
   시트 버튼/수동등록 없이 항상 최신 맞교대 데이터로 표시. */
(function () {
  var RO = (window.RO = window.RO || {});
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  var CC = { '매점': '#185FA5', '플로어': '#2f7d1f', '통합': '#993556' };
  var BG = { '매점': '#E6F1FB', '플로어': '#EAF3DE', '통합': '#FBEAF0' };
  var POS = ['매점', '플로어', '통합'];
  var SHIFT_ORDER = ['D1', 'D2', 'D3', 'D4', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'N1', 'N2'];
  var SHIFT_IDX = {}; SHIFT_ORDER.forEach(function (s, i) { SHIFT_IDX[s] = i; });

  var _weeks = null, _wsel = 0, _dsel = 0, _loaded = false;

  function fmt(dt) { return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0'); }
  function addDays(dt, n) { var d = new Date(dt); d.setDate(d.getDate() + n); return d; }
  function mdNum(md) { var m = String(md).match(/(\d{1,2})\s*\/\s*(\d{1,2})/); return m ? (+m[1]) * 100 + (+m[2]) : 0; }
  function prettyWk(key) { var m = String(key).match(/(\d+)월\s*(\d+)주차/); return m ? (m[1] + '월 ' + m[2] + '주차') : String(key).replace(/\s*\(맞교대\)\s*/, ''); }
  function todayMD() { var n = new Date(); return (n.getMonth() + 1) + '/' + n.getDate(); }

  // 스케줄 배열 → [{date,dow,rows:[{slot,time,매점,플로어,통합}]}]
  function buildDays(schedule) {
    var byDate = {};
    schedule.forEach(function (r) {
      var m = String(r.date).match(/(\d{1,2})\s*\/\s*(\d{1,2})/); if (!m) return;
      var md = (+m[1]) + '/' + (+m[2]);
      var dw = (String(r.date).match(/\(([월화수목금토일])\)/) || [])[1] || '';
      var pos = r.position; if (POS.indexOf(pos) < 0) return;
      var d = byDate[md] || (byDate[md] = { dow: dw, ord: mdNum(md), slots: {} });
      var cell = d.slots[r.shiftCode] || (d.slots[r.shiftCode] = { slot: r.shiftCode, time: r.time || '' });
      var label = String(r.name || '').trim() + (r.note ? (' ' + String(r.note).trim()) : '');
      cell[pos] = cell[pos] ? (cell[pos] + ', ' + label) : label;
    });
    return Object.keys(byDate).sort(function (a, b) { return byDate[a].ord - byDate[b].ord; }).map(function (md) {
      var d = byDate[md];
      var rows = Object.keys(d.slots).sort(function (a, b) { return (SHIFT_IDX[a] == null ? 99 : SHIFT_IDX[a]) - (SHIFT_IDX[b] == null ? 99 : SHIFT_IDX[b]); }).map(function (sc) { return d.slots[sc]; });
      return { date: md, dow: d.dow, rows: rows, ord: d.ord };
    });
  }

  RO.render = function (force) {
    var host = document.getElementById('roster-body'); if (!host) return;
    if (_loaded && !force) { paint(); return; }
    if (!_weeks) host.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:34px;font-size:13px;font-weight:700">불러오는 중…</div>';
    var base = new Date();
    var probes = [-7, 0, 7, 14].map(function (o) { return fmt(addDays(base, o)); });
    Promise.all(probes.map(function (dt) {
      return fetch('/api/schedule?mode=today&date=' + encodeURIComponent(dt)).then(function (r) { return r.json(); }).catch(function () { return null; });
    })).then(function (results) {
      var seen = {}, weeks = [];
      results.forEach(function (t) {
        if (!t || !t.weekKey || !Array.isArray(t.schedule) || !t.schedule.length) return;
        if (seen[t.weekKey]) return; seen[t.weekKey] = 1;
        var days = buildDays(t.schedule);
        if (days.length) weeks.push({ key: t.weekKey, label: prettyWk(t.weekKey), days: days, ord: days[0].ord });
      });
      weeks.sort(function (a, b) { return a.ord - b.ord; });
      _loaded = true; _weeks = weeks;
      _wsel = pickTodayWeek(weeks);
      _dsel = weeks[_wsel] ? pickTodayDay(weeks[_wsel].days) : 0;
      paint();
    }).catch(function () { if (!_weeks) host.innerHTML = '<div style="text-align:center;color:#dc2626;padding:30px;font-weight:700">불러오기 실패</div>'; });
  };

  function pickTodayWeek(weeks) {
    var md = todayMD();
    for (var i = 0; i < weeks.length; i++) { if (weeks[i].days.some(function (d) { return String(d.date) === md; })) return i; }
    return weeks.length ? 0 : 0;
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

    host.innerHTML = weekSel + dayPick + '<div id="roster-capture" style="background:#fff;padding:8px;border-radius:12px">' + gridHtml(wk.days[_dsel]) + '</div>' + saveBtn;
  }

  function gridHtml(day) {
    var rows = Array.isArray(day.rows) ? day.rows : [];
    var head = '<tr>'
      + '<th style="width:66px;padding:6px 4px;font-size:10px;color:#94a3b8;text-align:left;font-weight:700">슬롯</th>'
      + POS.map(function (p) { return '<th style="padding:6px 3px;font-size:11px;font-weight:800;color:' + CC[p] + '">' + p + '</th>'; }).join('')
      + '</tr>';
    var body = rows.map(function (r) {
      var cells = POS.map(function (p) {
        var v = r[p];
        var inner = v ? '<div style="background:' + BG[p] + ';color:' + CC[p] + ';font-size:11px;font-weight:700;padding:3px 5px;border-radius:6px;line-height:1.3">' + esc(v) + '</div>' : '';
        return '<td style="padding:3px;vertical-align:top;border-left:1px solid #f0f0f0">' + inner + '</td>';
      }).join('');
      return '<tr style="border-top:1px solid #f0f0f0">'
        + '<td style="padding:5px 4px;vertical-align:top"><div style="font-size:11px;font-weight:800;color:#0f172a">' + esc(r.slot) + '</div><div style="font-size:9px;color:#a3a3aa">' + esc(r.time || '') + '</div></td>'
        + cells + '</tr>';
    }).join('');
    return '<div style="text-align:center;font-size:14px;font-weight:800;color:#0f172a;margin:4px 0 8px">' + esc(day.dow) + '요일 · ' + esc(day.date) + '</div>'
      + '<table style="width:100%;border-collapse:collapse;table-layout:fixed">' + head + body + '</table>';
  }

  RO.pickWeek = function (i) { _wsel = i; _dsel = pickTodayDay(_weeks[i].days); paint(); };
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
