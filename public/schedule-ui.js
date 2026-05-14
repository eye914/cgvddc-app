/* 미소지기 근태(스케줄) 조회 UI */
(function() {
  var SHIFT_ORDER = ['D1','D2','D3','D4','M1','M2','M3','M4','M5','M6','M7','M8','N1','N2'];

  function getCurrentName() {
    return sessionStorage.getItem('cgv_currentUser') || '';
  }

  // 날짜 선택 → 주차 찾기 → 스케줄 로드
  window.onScheduleDateChange = function() {
    var input = document.getElementById('sched-date-input');
    var date = input.value;
    if (!date) return;
    var statusEl = document.getElementById('sched-status');
    var bodyEl   = document.getElementById('sched-body');
    statusEl.textContent = '주차 검색 중...';
    bodyEl.innerHTML = '';

    fetch('/api/schedule?mode=findWeek&date=' + encodeURIComponent(date))
      .then(function(r){ return r.json(); })
      .then(function(d) {
        if (d.error) { statusEl.textContent = '오류: ' + d.error; return; }
        if (!d.weekKey) {
          statusEl.innerHTML = '<span style="color:#dc2626">해당 주차가 아직 공개되지 않았습니다.<br/>(맞교대 반영 시트 미생성)</span>';
          return;
        }
        statusEl.textContent = '시트: ' + d.weekKey;
        document.getElementById('sched-weekkey').value = d.weekKey;
        loadScheduleByWeek(d.weekKey, date);
      })
      .catch(function(e){ statusEl.textContent = '오류: ' + e.message; });
  };

  function loadScheduleByWeek(weekKey, focusDate) {
    var bodyEl = document.getElementById('sched-body');
    bodyEl.innerHTML = '<div style="padding:20px;text-align:center;color:#64748b">불러오는 중...</div>';

    fetch('/api/schedule?mode=week&weekKey=' + encodeURIComponent(weekKey))
      .then(function(r){ return r.json(); })
      .then(function(d) {
        if (d.error) { bodyEl.innerHTML = '<div style="color:#dc2626;padding:16px">' + d.error + '</div>'; return; }
        renderSchedule(d.schedule || [], focusDate);
      })
      .catch(function(e){ bodyEl.innerHTML = '<div style="color:#dc2626;padding:16px">오류: ' + e.message + '</div>'; });
  }

  function renderSchedule(rows, focusDate) {
    var bodyEl = document.getElementById('sched-body');
    if (!rows.length) { bodyEl.innerHTML = '<div style="padding:20px;text-align:center;color:#64748b">스케줄 없음</div>'; return; }

    // 날짜별 그룹
    var byDate = {};
    rows.forEach(function(r) {
      if (!byDate[r.date]) byDate[r.date] = [];
      byDate[r.date].push(r);
    });
    var dates = Object.keys(byDate);

    // 정렬: 날짜 텍스트 기준
    dates.sort(function(a, b) {
      var na = parseInt((a.match(/(\d+)\/(\d+)/) || [])[2] || 0, 10);
      var nb = parseInt((b.match(/(\d+)\/(\d+)/) || [])[2] || 0, 10);
      return na - nb;
    });

    // focusDate (YYYY-MM-DD) 의 M/D 매칭
    var focusMD = '';
    if (focusDate) {
      var p = focusDate.split('-');
      if (p.length === 3) focusMD = parseInt(p[1],10) + '/' + parseInt(p[2],10);
    }

    // 본인 필터
    var onlyMe = document.getElementById('sched-only-me') && document.getElementById('sched-only-me').checked;
    var myName = getCurrentName();

    var html = '';
    dates.forEach(function(date) {
      var items = byDate[date].slice();
      if (onlyMe && myName) items = items.filter(function(x){ return x.name === myName; });
      // shift 순 정렬
      items.sort(function(a, b) {
        return SHIFT_ORDER.indexOf(a.shiftCode) - SHIFT_ORDER.indexOf(b.shiftCode);
      });

      var isFocus = focusMD && date.indexOf(focusMD + '(') === 0;
      var dayChar = (date.match(/\(([월화수목금토일])\)/) || [])[1] || '';
      var dayColor = dayChar === '토' ? '#2563eb' : (dayChar === '일' ? '#dc2626' : '#0f172a');

      html += '<div class="sched-day-card" style="margin-bottom:14px;border:2px solid ' + (isFocus ? '#e71a0f' : '#e2e8f0') + ';border-radius:16px;overflow:hidden;background:white">';
      html += '<div style="padding:10px 14px;background:' + (isFocus ? '#fef2f2' : '#f8fafc') + ';font-weight:900;color:' + dayColor + ';font-size:14px;display:flex;justify-content:space-between;align-items:center">';
      html += '<span>' + date + '</span><span style="font-size:11px;color:#64748b;font-weight:700">' + items.length + '명</span>';
      html += '</div>';

      if (items.length === 0) {
        html += '<div style="padding:14px;text-align:center;color:#94a3b8;font-size:12px">근무 없음</div>';
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
    });
    bodyEl.innerHTML = html;
  }

  // 본인 필터 토글
  window.onScheduleFilterToggle = function() {
    var wk = document.getElementById('sched-weekkey').value;
    var date = document.getElementById('sched-date-input').value;
    if (wk) loadScheduleByWeek(wk, date);
  };

  // 주차 드롭다운에서 선택
  window.onScheduleWeekSelect = function() {
    var sel = document.getElementById('sched-week-select');
    var weekKey = sel.value;
    var statusEl = document.getElementById('sched-status');
    var bodyEl   = document.getElementById('sched-body');
    if (!weekKey) {
      statusEl.textContent = '';
      bodyEl.innerHTML = '';
      return;
    }
    statusEl.textContent = '시트: ' + weekKey;
    document.getElementById('sched-weekkey').value = weekKey;
    loadScheduleByWeek(weekKey, document.getElementById('sched-date-input').value);
  };

  // 주차 목록 로드
  function loadWeekList(autoSelectFirst) {
    var sel = document.getElementById('sched-week-select');
    fetch('/api/schedule?mode=weeks')
      .then(function(r){ return r.json(); })
      .then(function(d) {
        if (d.error || !d.weeks) return;
        sel.innerHTML = '<option value="">-- 주차 선택 --</option>';
        d.weeks.forEach(function(w) {
          var opt = document.createElement('option');
          opt.value = w; opt.textContent = w;
          sel.appendChild(opt);
        });
        if (autoSelectFirst && d.weeks.length > 0) {
          sel.value = d.weeks[0];
          window.onScheduleWeekSelect();
        }
      });
  }

  // 탭 진입 시: 주차 목록 로드 + 가장 최신 주차 자동 표시
  window.initScheduleTab = function() {
    var input = document.getElementById('sched-date-input');
    if (input && !input.value) {
      var today = new Date();
      var y = today.getFullYear();
      var m = String(today.getMonth()+1).padStart(2,'0');
      var d = String(today.getDate()).padStart(2,'0');
      input.value = y + '-' + m + '-' + d;
    }
    loadWeekList(true);
  };
})();
