/* 근태 → 전체 근무표(시트 스냅샷) UI — window.RO
   편성은 구글시트에서 하고, 시트 버튼(GAS)이 /api/roster 로 등록.
   여러 주 누적: { weeks:[ {week_label, first_date, days:[{date,dow,rows:[{slot,time,매점,플로어,통합}]}]} ] } */
(function () {
  var RO = (window.RO = window.RO || {});
  function tok() { return sessionStorage.getItem('cgv_token') || ''; }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  var CC = { '매점': '#185FA5', '플로어': '#2f7d1f', '통합': '#993556' };
  var BG = { '매점': '#E6F1FB', '플로어': '#EAF3DE', '통합': '#FBEAF0' };
  var POS = ['매점', '플로어', '통합'];

  var _weeks = null, _wsel = 0, _dsel = 0, _loaded = false;

  RO.render = function (force) {
    var host = document.getElementById('roster-body'); if (!host) return;
    if (_loaded && !force) { paint(); return; }
    host.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:34px;font-size:13px;font-weight:700">불러오는 중…</div>';
    fetch('/api/roster', { headers: { 'Authorization': 'Bearer ' + tok() } })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        _loaded = true;
        _weeks = (d && Array.isArray(d.weeks)) ? d.weeks.filter(function (w) { return w && Array.isArray(w.days) && w.days.length; }) : [];
        _wsel = pickTodayWeek(_weeks);
        _dsel = _weeks[_wsel] ? pickTodayDay(_weeks[_wsel].days) : 0;
        paint();
      })
      .catch(function () { host.innerHTML = '<div style="text-align:center;color:#dc2626;padding:30px;font-weight:700">불러오기 실패</div>'; });
  };

  function todayMD() { var n = new Date(); return (n.getMonth() + 1) + '/' + n.getDate(); }
  // 오늘이 포함된 주를 기본 선택, 없으면 마지막(최신) 주
  function pickTodayWeek(weeks) {
    var md = todayMD();
    for (var i = 0; i < weeks.length; i++) {
      if (weeks[i].days.some(function (d) { return String(d.date) === md; })) return i;
    }
    return weeks.length ? weeks.length - 1 : 0;
  }
  function pickTodayDay(days) {
    var md = todayMD();
    for (var i = 0; i < days.length; i++) { if (String(days[i].date) === md) return i; }
    return 0;
  }

  function paint() {
    var host = document.getElementById('roster-body'); if (!host) return;
    if (!_weeks || !_weeks.length) {
      host.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:40px 20px;font-weight:700;background:#f8fafc;border-radius:14px">아직 등록된 근무표가 없습니다.<div style="font-size:12px;color:#b8b8be;margin-top:6px;font-weight:600">편성 후 시트의 [앱에 근무표 등록] 버튼을 눌러주세요.</div></div>';
      return;
    }
    if (_wsel >= _weeks.length) _wsel = _weeks.length - 1;
    var wk = _weeks[_wsel];
    if (_dsel >= wk.days.length) _dsel = 0;

    // 주차 선택 (2주 이상일 때만)
    var weekSel = '';
    if (_weeks.length > 1) {
      weekSel = '<div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:8px;margin-bottom:6px">' + _weeks.map(function (w, i) {
        var on = i === _wsel;
        var lbl = w.week_label || (w.days[0] && w.days[0].date + '~' + w.days[w.days.length - 1].date) || ('주 ' + (i + 1));
        return '<button onclick="RO.pickWeek(' + i + ')" style="flex:0 0 auto;padding:6px 12px;border-radius:10px;font-size:12px;font-weight:800;border:1px solid ' + (on ? '#0f172a' : '#e2e2e2') + ';background:' + (on ? '#0f172a' : '#fff') + ';color:' + (on ? '#fff' : '#555') + '">' + esc(lbl) + '</button>';
      }).join('') + '</div>';
    } else {
      var lbl0 = wk.week_label || '';
      if (lbl0) weekSel = '<div style="font-size:12px;color:#94a3b8;font-weight:700;margin:2px 0 8px">' + esc(lbl0) + '</div>';
    }

    // 요일 선택
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

  // 현재 요일 그리드를 PNG로 저장 (html2canvas 지연 로드)
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
