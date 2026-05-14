/* 미소지기 근태(스케줄) 조회 UI - 선택한 날짜만 표시 */
(function() {
  var SHIFT_ORDER = ['D1','D2','D3','D4','M1','M2','M3','M4','M5','M6','M7','M8','N1','N2'];
  // 주차별 스케줄 캐시 (페이지 세션 동안 유지)
  var _cache = {};

  function getCurrentName() {
    return sessionStorage.getItem('cgv_currentUser') || '';
  }

  // 날짜 선택 → 주차 찾기 → 해당 날짜만 표시
  window.onScheduleDateChange = function() {
    var input = document.getElementById('sched-date-input');
    var date = input.value;
    if (!date) return;
    var statusEl = document.getElementById('sched-status');
    var bodyEl   = document.getElementById('sched-body');
    statusEl.textContent = '검색 중...';
    bodyEl.innerHTML = '';

    fetch('/api/schedule?mode=findWeek&date=' + encodeURIComponent(date))
      .then(function(r){ return r.json(); })
      .then(function(d) {
        if (d.error) { statusEl.textContent = '오류: ' + d.error; return; }
        if (!d.weekKey) {
          statusEl.innerHTML = '<span style="color:#dc2626">해당 주차가 아직 공개되지 않았습니다.</span>';
          return;
        }
        statusEl.textContent = '시트: ' + d.weekKey;
        document.getElementById('sched-weekkey').value = d.weekKey;
        loadAndShow(d.weekKey, date);
      })
      .catch(function(e){ statusEl.textContent = '오류: ' + e.message; });
  };

  function loadAndShow(weekKey, focusDate) {
    var bodyEl = document.getElementById('sched-body');
    if (_cache[weekKey]) {
      renderSingleDate(_cache[weekKey], focusDate);
      return;
    }
    bodyEl.innerHTML = '<div style="padding:20px;text-align:center;color:#64748b">불러오는 중...</div>';
    fetch('/api/schedule?mode=week&weekKey=' + encodeURIComponent(weekKey))
      .then(function(r){ return r.json(); })
      .then(function(d) {
        if (d.error) { bodyEl.innerHTML = '<div style="color:#dc2626;padding:16px">' + d.error + '</div>'; return; }
        _cache[weekKey] = d.schedule || [];
        renderSingleDate(_cache[weekKey], focusDate);
      })
      .catch(function(e){ bodyEl.innerHTML = '<div style="color:#dc2626;padding:16px">오류: ' + e.message + '</div>'; });
  }

  function renderSingleDate(rows, focusDate) {
    var bodyEl = document.getElementById('sched-body');

    // focusDate (YYYY-MM-DD) → M/D 매칭
    var focusMD = '';
    if (focusDate) {
      var p = focusDate.split('-');
      if (p.length === 3) focusMD = parseInt(p[1],10) + '/' + parseInt(p[2],10);
    }

    // 선택한 날짜만 필터
    var items = rows.filter(function(r) {
      return r.date && r.date.indexOf(focusMD + '(') === 0;
    });

    if (items.length === 0) {
      bodyEl.innerHTML = '<div style="padding:30px;text-align:center;color:#94a3b8;font-size:13px;font-weight:700;background:#f8fafc;border-radius:12px">선택한 날짜에 근무 인원이 없습니다.</div>';
      return;
    }

    // 본인 필터
    var onlyMe = document.getElementById('sched-only-me') && document.getElementById('sched-only-me').checked;
    var myName = getCurrentName();
    if (onlyMe && myName) items = items.filter(function(x){ return x.name === myName; });

    // shift 순 정렬
    items.sort(function(a, b) {
      return SHIFT_ORDER.indexOf(a.shiftCode) - SHIFT_ORDER.indexOf(b.shiftCode);
    });

    var date = items[0] ? items[0].date : (focusMD + '(?)');
    var dayChar = (date.match(/\(([월화수목금토일])\)/) || [])[1] || '';
    var dayColor = dayChar === '토' ? '#2563eb' : (dayChar === '일' ? '#dc2626' : '#0f172a');

    var html = '';
    html += '<div style="border:2px solid #e2e8f0;border-radius:16px;overflow:hidden;background:white">';
    html += '<div style="padding:12px 16px;background:#fef2f2;font-weight:900;color:' + dayColor + ';font-size:15px;display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #fecaca">';
    html += '<span>' + date + '</span><span style="font-size:12px;color:#64748b;font-weight:700">' + items.length + '명</span>';
    html += '</div>';

    if (items.length === 0) {
      html += '<div style="padding:20px;text-align:center;color:#94a3b8;font-size:12px">본인 근무 없음</div>';
    } else {
      html += '<table style="width:100%;border-collapse:collapse;font-size:12px">';
      html += '<thead><tr style="background:#f1f5f9"><th style="padding:8px 6px;text-align:center;font-weight:900;color:#475569">시프트</th><th style="padding:8px 6px;text-align:left;font-weight:900;color:#475569">이름</th><th style="padding:8px 6px;text-align:center;font-weight:900;color:#475569">시간</th><th style="padding:8px 6px;text-align:center;font-weight:900;color:#475569">포지션</th></tr></thead><tbody>';
      items.forEach(function(it) {
        var isMine = myName && it.name === myName;
        var rowBg = isMine ? '#fef9c3' : 'white';
        var nameStyle = isMine ? 'font-weight:900;color:#b45309' : 'font-weight:700;color:#0f172a';
        var noteHtml = it.note ? '<div style="font-size:10px;color:#64748b;font-weight:600">(' + it.note + ')</div>' : '';
        var shiftBg = it.shiftCode.charAt(0) === 'D' ? '#fed7aa' : (it.shiftCode.charAt(0) === 'M' ? '#bae6fd' : '#c7d2fe');
        html += '<tr style="background:' + rowBg + ';border-top:1px solid #f1f5f9">';
        html += '<td style="padding:8px 6px;text-align:center"><span style="display:inline-block;padding:2px 8px;border-radius:6px;background:' + shiftBg + ';font-weight:900;color:#0f172a">' + it.shiftCode + '</span></td>';
        html += '<td style="padding:8px 6px;' + nameStyle + '">' + it.name + (isMine ? ' ⭐' : '') + '</td>';
        html += '<td style="padding:8px 6px;text-align:center;color:#475569;font-weight:600">' + it.time + noteHtml + '</td>';
        html += '<td style="padding:8px 6px;text-align:center;color:#475569;font-weight:700">' + it.position + '</td>';
        html += '</tr>';
      });
      html += '</tbody></table>';
    }
    html += '</div>';
    bodyEl.innerHTML = html;
  }

  // 본인 필터 토글
  window.onScheduleFilterToggle = function() {
    var wk = document.getElementById('sched-weekkey').value;
    var date = document.getElementById('sched-date-input').value;
    if (wk && _cache[wk]) renderSingleDate(_cache[wk], date);
  };

  function fmtDate(dt) {
    var y = dt.getFullYear();
    var m = String(dt.getMonth()+1).padStart(2,'0');
    var d = String(dt.getDate()).padStart(2,'0');
    return y + '-' + m + '-' + d;
  }

  // 탭 진입: 오늘 날짜로 자동 조회 + 검색 범위 제한 (오늘 ~ 3주 후)
  window.initScheduleTab = function() {
    var input = document.getElementById('sched-date-input');
    if (!input) return;
    var today = new Date();
    var maxDt = new Date(today);
    maxDt.setDate(maxDt.getDate() + 21);
    input.min = fmtDate(today);
    input.max = fmtDate(maxDt);
    if (!input.value) input.value = fmtDate(today);
    window.onScheduleDateChange();
  };
})();
