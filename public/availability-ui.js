/* ─────────────────────────────────────────────────────────────
   CGV 동두천 스케줄 신청 UI (Step 1 취합)
   cgv-app.js / schedule-ui.js 보다 defer로 뒤에 로드됨
───────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  /* ── 시간 그룹 정의 (미들은 범위가 넓어 대표값 표시) ── */
  var GROUPS = [
    { id: 'd', label: '오픈', icon: '☀',  codes: 'D1~D4', range55: '09:00~16:00', range45: '09:00~15:00' },
    { id: 'm', label: '미들', icon: '🌤', codes: 'M1~M8', range55: '11:30~22:00', range45: '11:30~21:00' },
    { id: 'n', label: '마감', icon: '🌙', codes: 'N1~N2', range55: '18:00~24:30', range45: '19:00~24:30' }
  ];

  var DAY_KOR    = ['월', '화', '수', '목', '금', '토', '일'];
  var HOLIDAYS   = [];        // 공휴일 dayIdx 목록 (추후 API로 로드 가능)
  var ADMIN_INT  = [];        // 관리자 지정 통합 모집일 dayIdx
  var EVENT_LABEL = {};       // dayIdx → 이벤트명 (예: 현충일)
  var EVENT_INT_GROUPS = {};  // dayIdx → 통합모집 시간그룹 ['d','m','n'] (이벤트 통합모집일만)
  // 7×3 행렬: [요일][시간대(0=오픈,1=미들,2=마감)]
  var DAY_COUNTS = [[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0]];
  var DAY_CAPS   = [[2,3,4],[2,3,4],[2,3,4],[2,3,4],[2,3,4],[3,4,5],[3,3,4]]; // 서버값으로 덮임
  var GROUP_IDX  = { d: 0, m: 1, n: 2 };  // 시간대 → 행렬 열

  /* ── State ── */
  var selected   = {};        // dayIdx(0~6) → Set<'d'|'m'|'n'>
  var weekKey    = '';        // 'YYYY-MM-DD' (월요일)
  var weekDates  = [];        // 7개 Date 객체
  var curUser    = null;      // MISO_DATA 항목
  var posRows    = [];        // 화면에 표시할 포지션 행 목록
  var _activeSchedTab = 'view'; // 현재 서브탭

  /* ── 포지션 행 정의 빌더 ── */
  function buildPosRows(posArr) {
    var rows = [];
    var has = function (p) { return posArr.indexOf(p) > -1; };
    var isTotal = has('통합');

    // 매점: 오픈·미들·마감 (통합도 가능) — 마감을 별도 행 대신 매점에 통합
    if (isTotal || has('매점') || has('매점마감')) {
      rows.push({ id: 'mart', label: '매점', cls: 'mart', kinds: ['d', 'm', 'n'] });
    }
    // 플로어: 주중=미들·마감, 주말=오픈·미들·마감 (통합도 가능)
    if (isTotal || has('플로어')) {
      rows.push({ id: 'floor', label: '플로어', cls: 'floor', kinds: ['d', 'm', 'n'], weekdayNoOpen: true });
    }
    // 통합 포지션: 토·일·공휴일·관리자지정일만
    if (isTotal) {
      rows.push({ id: 'int', label: '통합', cls: 'int', kinds: ['d', 'm', 'n'], specialOnly: true });
    }
    return rows;
  }

  /* ── 날짜 유틸 ── */
  function getMondayOfWeek(date) {
    var d = new Date(date);
    var day = d.getDay();
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    d.setHours(0, 0, 0, 0);
    return d;
  }
  function fmtDate(dt) {
    return dt.getFullYear() + '-' +
      String(dt.getMonth() + 1).padStart(2, '0') + '-' +
      String(dt.getDate()).padStart(2, '0');
  }
  function isWeekend(idx)     { return idx >= 5; }
  function isSpecialDay(idx)  { return isWeekend(idx) || HOLIDAYS.indexOf(idx) > -1 || ADMIN_INT.indexOf(idx) > -1; }

  /* ── 셀 활성 여부 ── */
  function isCellActive(dayIdx, pos, groupId) {
    if (pos.specialOnly    && !isSpecialDay(dayIdx)) return false;
    // 이벤트 통합모집일: 관리자가 지정한 시간대(오픈/미들/마감)의 통합만 열림
    if (pos.id === 'int' && ADMIN_INT.indexOf(dayIdx) > -1 && EVENT_INT_GROUPS[dayIdx] && EVENT_INT_GROUPS[dayIdx].indexOf(groupId) === -1) return false;
    if (pos.weekdayNoOpen  && groupId === 'd' && !isWeekend(dayIdx)) return false;
    if (pos.kinds.indexOf(groupId) === -1) return false;
    return true;
  }

  function getAllActiveKinds(dayIdx) {
    var s = {};
    posRows.forEach(function (pos) {
      GROUPS.forEach(function (g) {
        if (isCellActive(dayIdx, pos, g.id)) s[g.id] = true;
      });
    });
    return Object.keys(s);
  }

  function getSelectedKinds(dayIdx) {
    return selected[dayIdx] ? Array.from(selected[dayIdx]) : [];
  }

  function countSelectedDays() {
    return Object.keys(selected).filter(function (i) {
      return selected[i] && selected[i].size > 0;
    }).length;
  }

  /* ── 서브탭 전환 (cgv-app.js가 호출) ── */
  window.switchSchedTab = function (tab) {
    _activeSchedTab = tab;
    var viewEl  = document.getElementById('sched-sub-view');
    var applyEl = document.getElementById('sched-sub-apply');
    var btnView  = document.getElementById('sched-sub-btn-view');
    var btnApply = document.getElementById('sched-sub-btn-apply');
    if (!viewEl || !applyEl) return;

    var activeStyle   = 'flex:1;padding:8px 0;border:none;border-radius:10px;font-size:12px;font-weight:800;cursor:pointer;background:#d8463a;color:white;transition:all .15s';
    var inactiveStyle = 'flex:1;padding:8px 0;border:none;border-radius:10px;font-size:12px;font-weight:800;cursor:pointer;background:transparent;color:#6c6c72;transition:all .15s';

    if (tab === 'view') {
      viewEl.style.display  = '';
      applyEl.style.display = 'none';
      btnView.style.cssText  = activeStyle;
      btnApply.style.cssText = inactiveStyle;
    } else {
      viewEl.style.display  = 'none';
      applyEl.style.display = '';
      btnView.style.cssText  = inactiveStyle;
      btnApply.style.cssText = activeStyle;
      initAvailabilityUI();
    }
  };

  /* ── 초기화 ── */
  function initAvailabilityUI() {
    var name = sessionStorage.getItem('cgv_currentUser');
    if (!name) {
      document.getElementById('avail-body').innerHTML =
        '<div style="text-align:center;padding:32px;color:#94a3b8;font-size:13px;font-weight:700">로그인 후 이용 가능합니다.</div>';
      return;
    }

    /* MISO_DATA는 cgv-app.js 전역변수 */
    var misoList = window.MISO_DATA || [];
    var miso = misoList.find(function (m) { return m.name === name; });
    if (!miso) {
      document.getElementById('avail-body').innerHTML =
        '<div style="text-align:center;padding:32px;color:#ef4444;font-size:13px;font-weight:700">미소지기 정보를 찾을 수 없습니다.</div>';
      return;
    }

    curUser = miso;
    posRows = buildPosRows(Array.isArray(miso.pos) ? miso.pos : (miso.pos || '').split(',').map(function(p){return p.trim();}));

    /* ── 관리자가 열어둔 주차 조회 ── */
    document.getElementById('avail-body').innerHTML =
      '<div style="text-align:center;padding:32px;color:#94a3b8;font-size:13px;font-weight:700">불러오는 중...</div>';

    // 신청일수·근로일수는 관리자가 바꿀 수 있으니 항상 최신값으로 갱신(캐시 우회) 후 로드
    fetch('/api/misojigi')
      .then(function(r) { return r.json(); })
      .then(function(list) {
        if (Array.isArray(list)) {
          var f = list.find(function(m) { return m.name === curUser.name; });
          if (f) {
            if (f.apply_days != null)    curUser.apply_days = f.apply_days;
            if (f.contract_days != null) curUser.contract_days = f.contract_days;
          }
        }
      })
      .catch(function() {})
      .then(function() { return fetch('/api/availability?mode=active'); })
      .then(function(r) { return r.json(); })
      .then(function(info) {
        if (!info.weekKey) {
          /* 닫혀 있음 */
          document.getElementById('avail-body').innerHTML =
            '<div style="text-align:center;padding:40px 20px">' +
            '<div style="font-size:32px;margin-bottom:12px">📭</div>' +
            '<p style="font-size:14px;font-weight:900;color:#0f172a;margin-bottom:6px">현재 신청 기간이 아닙니다</p>' +
            '<p style="font-size:12px;font-weight:700;color:#94a3b8">관리자 공지를 기다려주세요.</p>' +
            '</div>';
          /* 하단 제출 바 숨기기 */
          var footer = document.getElementById('avail-sticky-footer');
          if (footer) footer.style.display = 'none';
          return;
        }
        if (Array.isArray(info.counts) && info.counts.length === 7) DAY_COUNTS = info.counts;
        if (Array.isArray(info.caps) && info.caps.length === 7) DAY_CAPS = info.caps;

        /* 주차 세팅 */
        weekKey   = info.weekKey;
        var monday = new Date(weekKey + 'T00:00:00');
        weekDates  = [];
        for (var i = 0; i < 7; i++) {
          var d2 = new Date(monday);
          d2.setDate(monday.getDate() + i);
          weekDates.push(d2);
        }

        /* 주차 레이블 */
        var wlEl = document.getElementById('avail-week-label');
        if (wlEl) {
          var sun = weekDates[6];
          wlEl.textContent = (monday.getMonth()+1) + '/' + monday.getDate() +
            ' ~ ' + (sun.getMonth()+1) + '/' + sun.getDate();
        }

        /* 하단 제출 바 표시 */
        var footer = document.getElementById('avail-sticky-footer');
        if (footer) footer.style.display = '';

        /* 이벤트/공휴일 로드 → HOLIDAYS / ADMIN_INT / EVENT_LABEL 채운 뒤 신청 데이터 로드 */
        fetch('/api/events')
          .then(function(r) { return r.json(); })
          .then(function(ev) {
            HOLIDAYS = []; ADMIN_INT = []; EVENT_LABEL = {}; EVENT_INT_GROUPS = {};
            var emap = (ev && ev.events) || {};
            for (var di = 0; di < 7; di++) {
              var e = emap[fmtDate(weekDates[di])];
              if (!e) continue;
              if (e.label)      EVENT_LABEL[di] = e.label;
              if (e.holiday)    HOLIDAYS.push(di);
              if (e.recruitInt) { ADMIN_INT.push(di); EVENT_INT_GROUPS[di] = (e.intGroups && e.intGroups.length) ? e.intGroups : ['d','m','n']; }
            }
          }, function() { HOLIDAYS = []; ADMIN_INT = []; EVENT_LABEL = {}; EVENT_INT_GROUPS = {}; })
          .then(function() {
            return fetch('/api/availability?weekKey=' + weekKey + '&name=' + encodeURIComponent(name));
          })
          .then(function(r) { return r.json(); })
          .then(function(json) {
            selected = {};
            (json.data || []).forEach(function(row) {
              selected[row.day_of_week] = new Set(row.shift_codes || []);
            });
            renderAvailUI();
          })
          .catch(function() {
            selected = {};
            renderAvailUI();
          });
      })
      .catch(function() {
        document.getElementById('avail-body').innerHTML =
          '<div style="text-align:center;padding:32px;color:#ef4444;font-size:13px;font-weight:700">네트워크 오류. 다시 시도해주세요.</div>';
      });
  }

  /* ── 렌더 ── */
  function renderAvailUI() {
    var contractDays  = parseInt(curUser.contract_days, 10) || 5;
    var applyLimit    = parseInt(curUser.apply_days, 10) || contractDays; // 신청 가능 일수(근로일수로 폴백)
    var selectedDays  = countSelectedDays();
    var hours         = parseFloat(curUser.hours) || 5.5;
    var overLimit     = selectedDays > applyLimit;
    var weekendOk     = getSelectedKinds(5).length > 0 || getSelectedKinds(6).length > 0;
    var closeOk       = [0,1,2,3,4,5,6].some(function(di){ return getSelectedKinds(di).indexOf('n') > -1; });

    /* 진행 상태 텍스트 */
    var progressMsg;
    if (selectedDays < applyLimit) {
      progressMsg = '<span style="color:#64748b;font-weight:700;font-size:11px">신청 가능 ' + applyLimit + '일 중 ' + selectedDays + '일 선택</span>';
    } else {
      progressMsg = '<span style="color:#16a34a;font-weight:800;font-size:11px">신청 가능 일수만큼 선택 완료!</span>';
    }
    var pct = Math.min(selectedDays / applyLimit * 100, 100);

    var html = '';

    /* ── 유저 프로필 카드 ── */
    html += '<div style="background:white;border-radius:14px;border:1px solid #e2e8f0;padding:14px 16px;margin-bottom:10px">';
    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">';
    html += '<span style="font-size:16px;font-weight:900;color:#0f172a">' + curUser.name + '</span>';
    html += '<span style="display:inline-block;padding:2px 8px;background:#eef4f9;color:#4a7fb5;border-radius:6px;font-size:10px;font-weight:800">' + hours + 'h</span>';
    html += '</div>';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">';
    html += '<span style="font-size:11px;font-weight:700;color:#64748b">신청 가능 <b style="color:#0f172a">' + applyLimit + '일</b> · 선택 <b style="color:#0f172a">' + selectedDays + '일</b></span>';
    html += progressMsg;
    html += '</div>';
    /* 진행 바 */
    html += '<div style="height:6px;background:#f1f5f9;border-radius:3px;overflow:hidden;margin-bottom:6px">';
    html += '<div style="height:100%;border-radius:3px;background:' + (selectedDays >= applyLimit ? '#16a34a' : '#d8463a') + ';width:' + pct + '%;transition:width .3s"></div>';
    html += '</div>';
    html += '<p style="font-size:10.5px;color:#8a6d3b;background:#fbf3e2;border-radius:9px;padding:9px 11px;font-weight:700;line-height:1.55;word-break:keep-all;margin-top:2px"><b>최대 ' + applyLimit + '일</b>까지 요일을 선택할 수 있어요. 한 요일 안에서 가능한 시간대(오픈·미들·마감)는 여러 개 골라도 됩니다. 시간대마다 <b>선착순 정원</b>이 있어 차면 잠깁니다.</p>';
    html += '<p style="font-size:10.5px;font-weight:800;line-height:1.5;word-break:keep-all;margin-top:6px;border-radius:9px;padding:9px 11px;' + (weekendOk ? 'color:#16a34a;background:#eaf7ef' : 'color:#dc2626;background:#fef2f2') + '">' + (weekendOk ? '주말 근무 선택 완료 (토·일 중 하루 이상)' : '주말 근무 필수 — 토·일 중 하루 이상 꼭 선택해야 신청이 완료됩니다.') + '</p>';
    html += '<p style="font-size:10.5px;font-weight:800;line-height:1.5;word-break:keep-all;margin-top:6px;border-radius:9px;padding:9px 11px;' + (closeOk ? 'color:#16a34a;background:#eaf7ef' : 'color:#9a6b00;background:#fdf6e3') + '">' + (closeOk ? '마감 근무 선택 완료 — 감사합니다!' : '마감(폐점) 가능하시면 하루라도 마감을 선택해 주세요. 마감 인원이 늘 부족해요.') + '</p>';
    html += '</div>';

    /* ── 초기화 ── */
    var patStyle = 'padding:9px 0;border:1.5px solid #e6e6ec;background:white;border-radius:10px;font-size:11.5px;font-weight:800;cursor:pointer;color:#4a4a52';
    html += '<div style="margin-bottom:12px">';
    html += '<button style="width:100%;' + patStyle + ';color:#a1a1a8" onclick="availReset()">전체 초기화</button>';
    html += '</div>';

    /* ── 요일 카드 ── */
    for (var dayIdx = 0; dayIdx < 7; dayIdx++) {
      var d = weekDates[dayIdx];
      var dateStr   = (d.getMonth() + 1) + '/' + d.getDate();
      var isSat     = dayIdx === 5;
      var isSun     = dayIdx === 6;
      var isHoliday = HOLIDAYS.indexOf(dayIdx) > -1;
      var isAdminInt= ADMIN_INT.indexOf(dayIdx) > -1;
      var nameColor = isSat ? '#5b8fd0' : isSun || isHoliday ? '#cf6b62' : '#2a2a2e';
      var curKinds  = getSelectedKinds(dayIdx);
      var allKinds  = getAllActiveKinds(dayIdx);
      var capG = DAY_CAPS[dayIdx] || [0,0,0];
      var cntG = DAY_COUNTS[dayIdx] || [0,0,0];
      // 시간대(gid) 정원 마감 여부 — 내가 이미 고른 시간대는 잠기지 않음
      function grpFull(gid) {
        var gi = GROUP_IDX[gid];
        if (gi === undefined) return false;
        if (curKinds.indexOf(gid) > -1) return false;
        return (cntG[gi] || 0) >= (capG[gi] || 0);
      }
      var availKinds = allKinds.filter(function (k) { return !grpFull(k); });
      var allOn   = availKinds.length > 0 && availKinds.every(function (k) { return curKinds.indexOf(k) > -1; });
      var picks   = new Set(curKinds).size;
      var isWk    = (dayIdx === 5 || dayIdx === 6);
      var anyFull = ['d','m','n'].some(grpFull);

      /* 카드 */
      html += '<div style="background:white;border-radius:14px;border:1px solid #e2e8f0;padding:12px 14px;margin-bottom:8px">';

      /* 카드 헤더 */
      html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';
      html += '<div style="display:flex;align-items:center;gap:6px">';
      html += '<span style="font-size:15px;font-weight:900;color:' + nameColor + '">' + DAY_KOR[dayIdx] + '</span>';
      html += '<span style="font-size:11px;font-weight:700;color:#94a3b8">' + dateStr + '</span>';
      if (isHoliday)  html += '<span style="font-size:9px;font-weight:800;color:#c0564a;background:#f9ece9;padding:2px 6px;border-radius:5px">공휴일</span>';
      if (isAdminInt) html += '<span style="font-size:9px;font-weight:800;color:#3f8a96;background:#ecf6f7;padding:2px 6px;border-radius:5px">통합모집</span>';
      if (EVENT_LABEL[dayIdx]) html += '<span style="font-size:9px;font-weight:800;color:#8a6d3b;background:#fbf3e2;padding:2px 6px;border-radius:5px">' + EVENT_LABEL[dayIdx] + '</span>';
      if (picks > 0)  html += '<span style="font-size:9px;font-weight:800;color:#d8463a;background:#fbeeec;padding:2px 6px;border-radius:5px">' + picks + '개</span>';
      if ((dayIdx === 5 || dayIdx === 6) && !weekendOk) html += '<span style="font-size:9px;font-weight:800;color:#dc2626;background:#fef2f2;padding:2px 6px;border-radius:5px">주말 필수</span>';
      html += '</div>';
      /* 전부 가능 버튼 (정원 안 찬 시간대만 선택) */
      var allBtnStyle = allOn
        ? 'padding:5px 11px;border:none;border-radius:9px;font-size:11px;font-weight:800;cursor:pointer;background:#d8463a;color:white'
        : 'padding:5px 11px;border:1.5px solid #e6e6ec;border-radius:9px;font-size:11px;font-weight:800;cursor:pointer;background:white;color:#6c6c72';
      html += '<button style="' + allBtnStyle + '" onclick="availToggleAll(' + dayIdx + ')">' + (allOn ? '✓ ' : '○ ') + '전부 가능</button>';
      html += '</div>';

      /* 시간대별 정원 표시 행 */
      html += '<div style="display:grid;grid-template-columns:42px 1fr 1fr 1fr;gap:6px;margin-bottom:8px">';
      html += '<span></span>';
      ['d','m','n'].forEach(function (gid) {
        var gi = GROUP_IDX[gid], lbl = (gid === 'd' ? '오픈' : gid === 'm' ? '미들' : '마감');
        var full = (cntG[gi] || 0) >= (capG[gi] || 0);
        html += '<span style="text-align:center;font-size:9.5px;font-weight:800;border-radius:6px;padding:3px 1px;' +
          (full ? 'color:#b91c1c;background:#fef2f2' : 'color:#475569;background:#f1f5f9') + '">' +
          lbl + ' ' + (cntG[gi] || 0) + '/' + (capG[gi] || 0) + (full ? ' 마감' : '') + '</span>';
      });
      html += '</div>';

      /* 포지션별 칩 행 */
      var hasAnyCell = false;
      posRows.forEach(function (pos) {
        var activeGroups = GROUPS.filter(function (g) { return isCellActive(dayIdx, pos, g.id); });
        if (!activeGroups.length) return;
        hasAnyCell = true;

        var labelColor = pos.cls === 'mart' ? '#b15644'
          : pos.cls === 'mart-close' ? '#a85a86'
          : pos.cls === 'floor' ? '#2f7d5c' : '#615aa0';

        html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">';
        html += '<span style="flex:0 0 42px;font-size:11px;font-weight:800;line-height:1.25;color:' + labelColor + '">' + pos.label + '</span>';
        html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;flex:1">';

        // 오픈/미들/마감 3열 고정 — 해당 포지션이 안 쓰는 칸은 빈칸으로 정렬 유지
        GROUPS.forEach(function (g) {
          if (!isCellActive(dayIdx, pos, g.id)) { html += '<span></span>'; return; }
          var on = curKinds.indexOf(g.id) > -1;
          if (grpFull(g.id)) {
            // 정원 마감 시간대 → 잠금 칩 (클릭 불가)
            html += '<span style="display:flex;align-items:center;justify-content:center;gap:3px;width:100%;padding:7px 3px;border-radius:9px;font-size:11px;font-weight:800;border:1.5px solid #ececef;background:#f4f4f6;color:#b0b0b8;white-space:nowrap">' + g.label + '</span>';
            return;
          }
          var chipStyle = on
            ? 'display:flex;align-items:center;justify-content:center;gap:3px;width:100%;padding:7px 3px;border-radius:9px;font-size:11px;font-weight:800;cursor:pointer;border:1.5px solid #d8463a;background:#d8463a;color:white;white-space:nowrap'
            : 'display:flex;align-items:center;justify-content:center;gap:3px;width:100%;padding:7px 3px;border-radius:9px;font-size:11px;font-weight:800;cursor:pointer;border:1.5px solid #e6e6ec;background:white;color:#4a4a52;white-space:nowrap';
          html += '<button style="' + chipStyle + '" onclick="availToggleChip(' + dayIdx + ',\'' + g.id + '\')">';
          html += g.label + '<span style="font-size:8.5px;opacity:.6;font-weight:700">' + g.codes + '</span>';
          html += '</button>';
        });

        html += '</div></div>';
      });

      if (!hasAnyCell) {
        html += '<p style="font-size:11px;color:#94a3b8;font-weight:700;padding:4px 2px">이 요일은 신청 가능한 포지션이 없습니다.</p>';
      }
      if (anyFull) {
        html += '<p style="font-size:10.5px;color:#dc2626;font-weight:700;line-height:1.5;padding:4px 2px;word-break:keep-all">정원이 찬 시간대는 잠겼어요. 다른 시간대를 선택해 주세요.</p>';
      }

      html += '</div>'; /* /카드 */
    }

    document.getElementById('avail-body').innerHTML = html;

    /* 하단 바 업데이트 */
    var fd = document.getElementById('avail-footer-days');
    var fc = document.getElementById('avail-footer-contract');
    if (fd) fd.textContent = selectedDays;
    if (fc) fc.textContent = contractDays;
  }

  /* 시간대(gid) 정원 마감 여부 — 내가 이미 고른 시간대는 잠기지 않음 */
  function isGrpFull(dayIdx, gid) {
    var gi = GROUP_IDX[gid];
    if (gi === undefined) return false;
    if (getSelectedKinds(dayIdx).indexOf(gid) > -1) return false;
    var capG = DAY_CAPS[dayIdx] || [0,0,0];
    var cntG = DAY_COUNTS[dayIdx] || [0,0,0];
    return (cntG[gi] || 0) >= (capG[gi] || 0);
  }
  function openKinds(dayIdx) {
    return getAllActiveKinds(dayIdx).filter(function (k) { return !isGrpFull(dayIdx, k); });
  }
  // 신청 가능 일수 = apply_days 설정값 우선, 없으면 근로일수
  function getApplyLimit() {
    if (!curUser) return 5;
    return parseInt(curUser.apply_days, 10) || parseInt(curUser.contract_days, 10) || 5;
  }
  // 새 요일을 추가하려는데 신청 가능 일수를 이미 다 채웠으면 true
  function dayLimitBlocked(dayIdx) {
    var has = selected[dayIdx] && selected[dayIdx].size > 0;
    if (has) return false; // 이미 고른 요일이면 제한 없음
    return countSelectedDays() >= getApplyLimit();
  }

  /* ── 전역 액션 함수들 ── */
  window.availToggleChip = function (dayIdx, groupId) {
    if (isGrpFull(dayIdx, groupId)) return; // 정원 찬 시간대는 선택 불가
    var removing = selected[dayIdx] && selected[dayIdx].has(groupId);
    if (!removing && dayLimitBlocked(dayIdx)) {
      alert('신청 가능 일수(' + getApplyLimit() + '일)만큼만 선택할 수 있어요.\n선택한 다른 요일을 먼저 해제해 주세요.');
      return;
    }
    if (!selected[dayIdx]) selected[dayIdx] = new Set();
    if (selected[dayIdx].has(groupId)) selected[dayIdx].delete(groupId);
    else selected[dayIdx].add(groupId);
    renderAvailUI();
  };

  window.availToggleAll = function (dayIdx) {
    var kinds = openKinds(dayIdx); // 정원 안 찬 시간대만
    var curKinds = getSelectedKinds(dayIdx);
    var allOn = kinds.length > 0 && kinds.every(function (k) { return curKinds.indexOf(k) > -1; });
    if (!allOn && dayLimitBlocked(dayIdx)) {
      alert('신청 가능 일수(' + getApplyLimit() + '일)만큼만 선택할 수 있어요.\n선택한 다른 요일을 먼저 해제해 주세요.');
      return;
    }
    selected[dayIdx] = allOn ? new Set() : new Set(kinds);
    renderAvailUI();
  };

  window.availSelectAll = function () {
    for (var i = 0; i < 7; i++) selected[i] = new Set(openKinds(i));
    renderAvailUI();
  };

  window.availSelectPattern = function (pattern) {
    for (var i = 0; i < 7; i++) {
      selected[i] = new Set();
      var activeKinds = openKinds(i); // 정원 안 찬 시간대만
      if (pattern === 'weekday' && i < 5)  selected[i] = new Set(activeKinds);
      if (pattern === 'weekend' && i >= 5) selected[i] = new Set(activeKinds);
      if (pattern === 'mid' && activeKinds.indexOf('m') > -1) selected[i].add('m');
    }
    renderAvailUI();
  };

  window.availReset = function () {
    selected = {};
    renderAvailUI();
  };

  /* ── 신청 제출 ── */
  window.availSubmit = function () {
    if (!curUser) return;
    // 주말(토 dayIdx 5 · 일 dayIdx 6) 중 하루는 필수
    if (getSelectedKinds(5).length === 0 && getSelectedKinds(6).length === 0) {
      alert('주말 근무는 필수입니다.\n\n토요일 또는 일요일 중 가능한 날을 최소 하루 선택해야 신청이 완료됩니다.');
      return;
    }
    // 마감(폐점) 미선택 시 부드러운 권장 확인 (차단 아님)
    var hasClose = [0,1,2,3,4,5,6].some(function(di){ return getSelectedKinds(di).indexOf('n') > -1; });
    if (!hasClose) {
      if (!confirm('마감(폐점) 근무를 하나도 선택하지 않으셨어요.\n\n마감 인원이 늘 부족합니다. 가능한 날이 있다면 마감을 하나라도 선택해 주시면 큰 도움이 돼요.\n\n그래도 이대로 제출할까요?')) return;
    }
    var notice = '📋 신청 전 확인\n\n'
      + "선택하신 요일은 '근무 희망'으로 접수됩니다.\n"
      + '최종 근무는 매장 운영·인원 상황에 따라 조정될 수 있어요.\n\n'
      + '이대로 신청할까요?';
    if (!confirm(notice)) return;
    var btn = document.getElementById('avail-submit-btn');
    if (btn) { btn.disabled = true; btn.textContent = '저장 중...'; }

    var days = [];
    for (var i = 0; i < 7; i++) {
      days.push({ dayOfWeek: i, shiftCodes: getSelectedKinds(i) });
    }

    var picked = countSelectedDays();

    fetch('/api/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: curUser.name, weekKey: weekKey, days: days })
    })
      .then(function (r) { return r.json(); })
      .then(function (json) {
        if (json.ok) {
          renderAvailComplete(picked);
        } else {
          showAvailToast('오류: ' + (json.error || '다시 시도해주세요'), '#dc2626');
          if (btn) { btn.disabled = false; btn.textContent = '신청하기'; }
        }
      })
      .catch(function () {
        showAvailToast('네트워크 오류. 다시 시도해주세요.', '#dc2626');
        if (btn) { btn.disabled = false; btn.textContent = '신청하기'; }
      });
  };

  /* ── 신청 완료 화면 ── */
  function renderAvailComplete(picked) {
    var mon = new Date(weekKey + 'T00:00:00');
    var sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    var wlabel = (mon.getMonth() + 1) + '/' + mon.getDate() + ' ~ ' + (sun.getMonth() + 1) + '/' + sun.getDate();
    var footer = document.getElementById('avail-sticky-footer');
    if (footer) footer.style.display = 'none';
    var b = document.getElementById('avail-body');
    if (!b) return;
    b.innerHTML =
      '<div style="text-align:center;padding:48px 24px">' +
        '<div style="width:72px;height:72px;border-radius:50%;background:#e9f6ef;display:flex;align-items:center;justify-content:center;margin:0 auto 18px;font-size:34px;color:#2f8a5f">✓</div>' +
        '<div style="font-size:19px;font-weight:800;color:#2a2a2e;margin-bottom:8px;letter-spacing:-.03em">스케줄 신청 완료!</div>' +
        '<div style="font-size:13px;font-weight:700;color:#6c6c72;margin-bottom:6px">' + wlabel + ' 주간</div>' +
        '<div style="font-size:12px;font-weight:600;color:#a1a1a8;line-height:1.55;word-break:keep-all;margin:0 auto 24px;max-width:300px">희망 근무 <b style="color:#d8463a">' + picked + '일</b> 신청이 저장되었습니다. 관리자 편성 후 「내 근무」에서 확정 스케줄을 확인할 수 있어요.</div>' +
        '<div style="display:flex;gap:8px;max-width:320px;margin:0 auto">' +
          '<button onclick="availBackToForm()" style="flex:1;padding:13px 0;border:1.5px solid #e6e6ec;background:#fff;border-radius:13px;font-size:13px;font-weight:800;color:#4a4a52;cursor:pointer">✏️ 수정하기</button>' +
          '<button onclick="switchSchedTab(\'view\')" style="flex:1;padding:13px 0;border:none;background:#d8463a;border-radius:13px;font-size:13px;font-weight:800;color:#fff;cursor:pointer">내 근무 보기</button>' +
        '</div>' +
      '</div>';
  }
  window.availBackToForm = function () {
    var footer = document.getElementById('avail-sticky-footer');
    if (footer) footer.style.display = '';
    var btn = document.getElementById('avail-submit-btn');
    if (btn) { btn.disabled = false; btn.textContent = '신청하기'; }
    renderAvailUI();
  };

  function showAvailToast(msg, bgColor) {
    var t = document.getElementById('avail-toast');
    if (!t) return;
    t.textContent = msg;
    t.style.background = bgColor;
    t.style.display = 'block';
    setTimeout(function () { t.style.display = 'none'; }, 3500);
  }

})();
