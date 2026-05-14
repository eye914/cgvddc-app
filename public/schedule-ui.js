/* 미소지기 근태(스케줄) 조회 UI - 즉시 표시 + 프리페치 */
(function() {
  var SHIFT_ORDER = ['D1','D2','D3','D4','M1','M2','M3','M4','M5','M6','M7','M8','N1','N2'];
  var _cache = {};      // weekKey -> schedule[]
  var _dateToWeek = {}; // YYYY-MM-DD -> weekKey
  var _prefetchStarted = false;
  var _prefetchPromise = null;

  function getCurrentName() {
    return sessionStorage.getItem('cgv_currentUser') || '';
  }
  function fmtDate(dt) {
    var y = dt.getFullYear();
    var m = String(dt.getMonth()+1).padStart(2,'0');
    var d = String(dt.getDate()).padStart(2,'0');
    return y + '-' + m + '-' + d;
  }
  function todayStr() { return fmtDate(new Date()); }

  // localStorage 캐시 (TTL 30분)
  var LS_KEY_PREFIX = 'cgv_sched_';
  function lsGet(weekKey) {
    try {
      var raw = localStorage.getItem(LS_KEY_PREFIX + weekKey);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (Date.now() - obj.ts > 30 * 60 * 1000) return null;
      return obj.data;
    } catch(e) { return null; }
  }
  function lsSet(weekKey, data) {
    try {
      localStorage.setItem(LS_KEY_PREFIX + weekKey, JSON.stringify({ ts: Date.now(), data: data }));
    } catch(e) {}
  }

  // ★ 앱 로드 직후 호출: 오늘 날짜 스케줄을 백그라운드 프리페치
  window.prefetchTodaySchedule = function() {
    if (_prefetchStarted) return _prefetchPromise;
    _prefetchStarted = true;
    var today = todayStr();
    // 1) localStorage에서 weekKey 추론 시도 → 캐시 hit이면 즉시 사용
    var allKeys = Object.keys(localStorage);
    for (var i = 0; i < allKeys.length; i++) {
      if (allKeys[i].indexOf(LS_KEY_PREFIX) !== 0) continue;
      var wk = allKeys[i].substring(LS_KEY_PREFIX.length);
      var cached = lsGet(wk);
      if (cached) _cache[wk] = cached;
    }
    // 2) 실제 fetch
    _prefetchPromise = fetch('/api/schedule?mode=today&date=' + encodeURIComponent(today))
      .then(function(r){ return r.json(); })
      .then(function(d) {
        if (d && d.weekKey) {
          _dateToWeek[today] = d.weekKey;
          _cache[d.weekKey] = d.schedule || [];
          lsSet(d.weekKey, d.schedule || []);
        }
        return d;
      })
      .catch(function(){ return null; });
    return _prefetchPromise;
  };

  // 날짜 선택 → 즉시 표시 (캐시) or fetch
  window.onScheduleDateChange = function() {
    var input = document.getElementById('sched-date-input');
    var date = input.value;
    if (!date) return;
    var statusEl = document.getElementById('sched-status');
    var bodyEl   = document.getElementById('sched-body');

    // 캐시된 weekKey 있으면 즉시 렌더
    var wk = _dateToWeek[date];
    if (wk && _cache[wk]) {
      statusEl.textContent = '시트: ' + wk;
      document.getElementById('sched-weekkey').value = wk;
      renderSingleDate(_cache[wk], date);
      return;
    }
    // weekKey만 알고 데이터 없는 경우 (다른 주차 캐시 매칭)
    // 일단 모든 캐시된 주차에서 해당 날짜 데이터 찾기 시도
    var p = date.split('-');
    if (p.length === 3) {
      var focusMD = parseInt(p[1],10) + '/' + parseInt(p[2],10);
      var foundKey = null;
      Object.keys(_cache).forEach(function(k) {
        if (_cache[k].some(function(x){ return x.date && x.date.indexOf(focusMD + '(') === 0; })) {
          foundKey = k;
        }
      });
      if (foundKey) {
        _dateToWeek[date] = foundKey;
        statusEl.textContent = '시트: ' + foundKey;
        document.getElementById('sched-weekkey').value = foundKey;
        renderSingleDate(_cache[foundKey], date);
        return;
      }
    }

    statusEl.textContent = '검색 중...';
    bodyEl.innerHTML = '<div style="padding:20px;text-align:center;color:#64748b">불러오는 중...</div>';
    fetch('/api/schedule?mode=today&date=' + encodeURIComponent(date))
      .then(function(r){ return r.json(); })
      .then(function(d) {
        if (d.error) { statusEl.textContent = '오류: ' + d.error; bodyEl.innerHTML=''; return; }
        if (!d.weekKey) {
          statusEl.innerHTML = '<span style="color:#dc2626">해당 주차가 아직 공개되지 않았습니다.</span>';
          bodyEl.innerHTML = '';
          return;
        }
        _dateToWeek[date] = d.weekKey;
        _cache[d.weekKey] = d.schedule || [];
        lsSet(d.weekKey, d.schedule || []);
        statusEl.textContent = '시트: ' + d.weekKey;
        document.getElementById('sched-weekkey').value = d.weekKey;
        renderSingleDate(_cache[d.weekKey], date);
      })
      .catch(function(e){ statusEl.textContent = '오류: ' + e.message; bodyEl.innerHTML=''; });
  };

  function renderSingleDate(rows, focusDate) {
    var bodyEl = document.getElementById('sched-body');
    var focusMD = '';
    if (focusDate) {
      var p = focusDate.split('-');
      if (p.length === 3) focusMD = parseInt(p[1],10) + '/' + parseInt(p[2],10);
    }
    var items = rows.filter(function(r) {
      return r.date && r.date.indexOf(focusMD + '(') === 0;
    });
    if (items.length === 0) {
      bodyEl.innerHTML = '<div style="padding:30px;text-align:center;color:#94a3b8;font-size:13px;font-weight:700;background:#f8fafc;border-radius:12px">선택한 날짜에 근무 인원이 없습니다.</div>';
      return;
    }
    var onlyMe = document.getElementById('sched-only-me') && document.getElementById('sched-only-me').checked;
    var myName = getCurrentName();
    if (onlyMe && myName) items = items.filter(function(x){ return x.name === myName; });
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

  window.onScheduleFilterToggle = function() {
    var wk = document.getElementById('sched-weekkey').value;
    var date = document.getElementById('sched-date-input').value;
    if (wk && _cache[wk]) renderSingleDate(_cache[wk], date);
  };

  // 탭 진입: 오늘 날짜 + 캐시 있으면 즉시 표시
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

  // ★ 페이지 로드 즉시 백그라운드 프리페치 (defer 스크립트라 DOM 준비됨)
  setTimeout(function() {
    if (typeof window.prefetchTodaySchedule === 'function') {
      window.prefetchTodaySchedule();
    }
  }, 500);
})();
