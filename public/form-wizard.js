/* 근태서류 단계별 입력 — window.FW
   한 번에 하나씩 묻고 마지막에 확인 → 기존 submitForm 으로 제출.
   서명은 기존 서명패드(openSignPad)를 그대로 사용한다. */
(function () {
  var FW = (window.FW = window.FW || {});

  var LABELS = { late: '지각확인서', absent: '결근사유서', resign: '사직원', earlyLeave: '희망조퇴·휴무확인서',
                 privacy: '개인정보보호 서약서', overtime: '연장·야간·휴일 근로동의서', workCondition: '근로조건 변경동의서' };
  var RETURN_ITEMS = ['유니폼', '명찰', '락커Key'];

  // ── 서류별 단계 정의 ──
  //   type: date | text | tel | textarea | time2 | items | bank | kind | consent | sign | review
  function stepsOf(type) {
    var S = {
      late: [
        { k: 'date', t: '지각한 날짜를 선택해 주세요', type: 'date' },
        { k: 'sch', t: '약정 근로시간을 알려주세요', h: '스케줄상 예정된 출근~퇴근 시간입니다.', type: 'time2', a: 'schStart', b: 'schEnd' },
        { k: 'act', t: '실제 근로시간은 어떻게 되나요?', h: '실제로 출근한 시간부터 퇴근 시간까지입니다.', type: 'time2', a: 'actStart', b: 'actEnd' },
        { k: 'content', t: '지각 사유를 작성해 주세요', type: 'textarea', ph: '사유를 구체적으로 작성해 주세요' },
        { k: 'sign', t: '확인 서명을 해주세요', type: 'sign', mode: 'sign' }
      ],
      earlyLeave: [
        { k: 'kind', t: '어떤 경우인가요?', type: 'kind' },
        { k: 'date', t: '해당 날짜를 선택해 주세요', type: 'date' },
        { k: 'sch', t: '약정 근로시간을 알려주세요', h: '스케줄상 예정된 출근~퇴근 시간입니다.', type: 'time2', a: 'schStart', b: 'schEnd' },
        { k: 'act', t: '희망 퇴근 시간을 알려주세요', h: '조퇴하려는 시간입니다.', type: 'time2', a: 'actStart', b: 'actEnd', skipIfOff: 1 },
        { k: 'content', t: '사유를 작성해 주세요', type: 'textarea', ph: '사유를 구체적으로 작성해 주세요' },
        { k: 'consent', t: '확인 사항', type: 'consent' },
        { k: 'sign', t: '확인 서명을 해주세요', type: 'sign', mode: 'sign' }
      ],
      absent: [
        { k: 'date', t: '결근한 날짜를 선택해 주세요', type: 'date' },
        { k: 'birth', t: '주민번호 앞 6자리를 입력해 주세요', type: 'text', ph: '001215', max: 6, num: 1 },
        { k: 'why', t: '결근 사유를 작성해 주세요', type: 'textarea', ph: '사유를 구체적으로 작성해 주세요' },
        { k: 'submitterSign', t: '제출자 서명을 해주세요', type: 'sign', mode: 'submitter' }
      ],
      resign: [
        { k: 'resignDate', t: '퇴직일이 언제인가요?', h: '마지막으로 근무하는 날짜입니다.', type: 'date' },
        { k: 'hireDate', t: '입사일은 언제였나요?', h: '기억나지 않으면 관리자에게 확인해 주세요.', type: 'date' },
        { k: 'birth', t: '주민번호 앞 6자리를 입력해 주세요', type: 'text', ph: '001215', max: 6, num: 1 },
        { k: 'phone', t: '연락처를 입력해 주세요', h: '퇴사 후에도 연락 가능한 번호로 적어주세요.', type: 'tel', ph: '010-0000-0000' },
        { k: 'reason', t: '퇴사 사유를 알려주세요', type: 'textarea', ph: '예) 학업 병행이 어려워 부득이하게 퇴사합니다.' },
        { k: 'items', t: '회사 물품을 반납하셨나요?', h: '항목마다 반납 또는 분실을 선택해 주세요. 분실 물품은 규정에 따라 변상 처리됩니다.', type: 'items' },
        { k: 'bank', t: '급여를 받을 계좌를 알려주세요', h: '마지막 급여가 입금될 계좌입니다.', type: 'bank' },
        { k: 'agree', t: '금품청산 합의 확인', type: 'agree' },
        { k: 'submitterSign', t: '제출자 서명을 해주세요', type: 'sign', mode: 'submitter' }
      ],
      privacy: [
        { k: 'birth', t: '생년월일 6자리를 입력해 주세요', type: 'text', ph: '001215', max: 6, num: 1 },
        { k: 'phone', t: '연락처를 입력해 주세요', type: 'tel', ph: '010-0000-0000' },
        { k: 'date', t: '작성일을 선택해 주세요', type: 'date' },
        { k: 'sign', t: '서명해 주세요', type: 'sign', mode: 'sign' }
      ],
      overtime: [
        { k: 'birth', t: '주민번호 앞 6자리를 입력해 주세요', type: 'text', ph: '001215', max: 6, num: 1 },
        { k: 'date', t: '작성일을 선택해 주세요', type: 'date' },
        { k: 'sign', t: '서명해 주세요', type: 'sign', mode: 'sign' }
      ],
      workCondition: [
        { k: 'birth', t: '생년월일 6자리를 입력해 주세요', type: 'text', ph: '001215', max: 6, num: 1 },
        { k: 'date', t: '작성일을 선택해 주세요', type: 'date' },
        { k: 'sign', t: '서명해 주세요', type: 'sign', mode: 'sign' }
      ]
    };
    var arr = (S[type] || []).slice();
    arr.push({ k: 'review', t: '작성 내용을 확인해 주세요', h: '잘못된 곳이 있으면 이전으로 돌아가 고칠 수 있습니다.', type: 'review' });
    return arr;
  }

  var _type, _steps, _i, _d, _name, _admin, _reqId;

  function injectStyle() {
    if (document.getElementById('fw-style')) return;
    var css = '#fw-body .fw-q{font-size:19px;font-weight:900;color:#0f172a;line-height:1.45;margin-bottom:6px;word-break:keep-all}'
      + '#fw-body .fw-h{font-size:12.5px;font-weight:700;color:#94a3b8;margin-bottom:16px;line-height:1.6;word-break:keep-all}'
      + '#fw-body input[type=text],#fw-body input[type=date],#fw-body input[type=tel],#fw-body textarea{width:100%;padding:14px;border:1.5px solid #dfe3e8;border-radius:12px;font-size:16px;font-weight:700;font-family:inherit;outline:none;background:#fff;box-sizing:border-box}'
      + '#fw-body input:focus,#fw-body textarea:focus{border-color:#D6001C;box-shadow:0 0 0 3px rgba(214,0,28,.1)}'
      + '#fw-body textarea{min-height:120px;resize:none;line-height:1.6}'
      + '.fw-err{font-size:12.5px;font-weight:800;color:#D6001C;margin-top:9px;display:none}'
      + '.fw-itm{display:flex;align-items:center;gap:8px;padding:12px 13px;border:1.5px solid #e6eaf0;border-radius:12px;margin-bottom:9px}'
      + '.fw-itm b{flex:1;font-size:14px;font-weight:800;color:#334155}'
      + '.fw-pill{padding:9px 15px;border:1.5px solid #dfe3e8;border-radius:99px;font-size:12.5px;font-weight:800;background:#fff;color:#64748b;cursor:pointer}'
      + '.fw-pill.ok{border-color:#16a34a;background:#f0fdf4;color:#15803d}'
      + '.fw-pill.no{border-color:#D6001C;background:#fff1f2;color:#b91c1c}'
      + '.fw-tbtn{flex:1;padding:14px 8px;border:1.5px solid #aac;border-radius:12px;background:#eef4ff;font-size:15px;font-weight:900;color:#334155;cursor:pointer}'
      + '.fw-kind{display:grid;grid-template-columns:1fr 1fr;gap:9px}'
      + '.fw-kb{padding:16px 8px;border:1.5px solid #dfe3e8;border-radius:13px;background:#fff;text-align:center;cursor:pointer}'
      + '.fw-kb.on{border-color:#D6001C;background:#fff1f2}'
      + '.fw-kb b{display:block;font-size:14.5px;font-weight:900;color:#334155}'
      + '.fw-kb.on b{color:#D6001C}'
      + '.fw-kb span{font-size:11px;font-weight:700;color:#94a3b8}'
      + '.fw-sigbtn{width:100%;padding:16px;border:2px dashed #cbd5e1;border-radius:13px;background:#fafbfc;font-size:14px;font-weight:900;color:#64748b;cursor:pointer}'
      + '.fw-sigbtn.done{border-style:solid;border-color:#16a34a;background:#f0fdf4;color:#15803d}'
      + '.fw-rv{border:1px solid #d7dbe0;border-radius:11px;overflow:hidden}'
      + '.fw-rv .r{display:flex;border-bottom:1px solid #eceff3;font-size:12.5px}'
      + '.fw-rv .r:last-child{border-bottom:none}'
      + '.fw-rv .k{width:104px;min-width:104px;background:#f5f7f9;padding:10px;font-weight:800;color:#475569}'
      + '.fw-rv .v{flex:1;padding:10px;font-weight:700;color:#0f172a;word-break:break-all}'
      + '.fw-pg{height:5px;background:#eef0f3;border-radius:99px;overflow:hidden}'
      + '.fw-pgf{height:100%;background:#D6001C;border-radius:99px;transition:width .3s cubic-bezier(.32,.72,0,1)}';
    var st = document.createElement('style'); st.id = 'fw-style'; st.textContent = css; document.head.appendChild(st);
  }

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function fmtD(d) { if (!d) return ''; var p = String(d).split('-'); return p.length === 3 ? Number(p[0]) + '년 ' + Number(p[1]) + '월 ' + Number(p[2]) + '일' : d; }
  function el(id) { return document.getElementById(id); }
  function isOff() { return _d.kind === '희망휴무'; }

  // 현재 단계에서 건너뛸지 (희망휴무면 '희망 퇴근 시간' 생략)
  function visible(s) { return !(s.skipIfOff && isOff()); }
  function vSteps() { return _steps.filter(visible); }

  FW.open = function (reqId, type, name, adminName) {
    injectStyle();
    _type = type; _reqId = reqId; _name = name || ''; _admin = adminName || '';
    _steps = stepsOf(type);
    if (!_steps.length) return false;      // 정의 없는 유형은 기존 방식 사용
    _i = 0;
    _d = { name: _name, kind: '희망조퇴', items: {} };
    window._signDataURL = null; window._submitterSignDataURL = null; window._agreementSignDataURL = null;

    var wrap = el('fw-modal');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'fw-modal';
      wrap.className = 'fixed inset-0 z-[8400] flex items-end justify-center';
      wrap.style.cssText = 'background:rgba(15,23,42,.7)';
      wrap.innerHTML =
        '<div style="width:100%;max-width:640px;background:#fff;border-radius:26px 26px 0 0;display:flex;flex-direction:column;max-height:95vh">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;padding:16px 18px 10px">'
        +   '<b id="fw-title" style="font-size:16px;font-weight:900;color:#0f172a"></b>'
        +   '<button onclick="FW.cancel()" style="border:none;background:transparent;color:#94a3b8;font-size:26px;line-height:1">&times;</button>'
        + '</div>'
        + '<div style="padding:0 18px 10px"><div class="fw-pg"><div class="fw-pgf" id="fw-pgf"></div></div>'
        +   '<div id="fw-pgt" style="font-size:10.5px;font-weight:800;color:#94a3b8;margin-top:6px"></div></div>'
        + '<div id="fw-body" style="flex:1;overflow-y:auto;padding:8px 18px 18px">'
        +   '<div class="fw-q" id="fw-q"></div><div class="fw-h" id="fw-h"></div>'
        +   '<div id="fw-f"></div><div class="fw-err" id="fw-e"></div></div>'
        + '<div style="display:flex;gap:9px;padding:12px 18px calc(16px + env(safe-area-inset-bottom));border-top:1px solid #eef0f3">'
        +   '<button id="fw-prev" onclick="FW.prev()" style="flex:0 0 92px;padding:15px;border:none;border-radius:13px;background:#f1f5f9;color:#64748b;font-size:15px;font-weight:900">이전</button>'
        +   '<button id="fw-next" onclick="FW.next()" style="flex:1;padding:15px;border:none;border-radius:13px;background:#D6001C;color:#fff;font-size:15px;font-weight:900">다음</button>'
        + '</div></div>';
      document.body.appendChild(wrap);
    }
    wrap.style.display = 'flex';
    el('fw-title').textContent = LABELS[type] || '서류 작성';
    render();
    return true;
  };

  FW.cancel = function () {
    var w = el('fw-modal'); if (w) w.style.display = 'none';
  };

  function render() {
    var list = vSteps(), s = list[_i];
    if (!s) return;
    el('fw-pgf').style.width = (_i / (list.length - 1) * 100) + '%';
    el('fw-pgt').textContent = (_i + 1) + ' / ' + list.length + (s.type === 'review' ? ' · 마지막 단계' : '');
    el('fw-q').textContent = s.t;
    el('fw-h').textContent = s.h || '';
    el('fw-h').style.display = s.h ? '' : 'none';
    el('fw-prev').style.visibility = _i === 0 ? 'hidden' : '';
    el('fw-next').textContent = s.type === 'review' ? '제출하기' : '다음';
    el('fw-e').style.display = 'none';

    var b = el('fw-f'), v = _d[s.k] || '';
    if (s.type === 'date') b.innerHTML = '<input type="date" id="fw-in" value="' + esc(v) + '">';
    else if (s.type === 'text' || s.type === 'tel')
      b.innerHTML = '<input type="' + s.type + '" id="fw-in" placeholder="' + esc(s.ph || '') + '"' + (s.max ? ' maxlength="' + s.max + '"' : '') + ' value="' + esc(v) + '">';
    else if (s.type === 'textarea') b.innerHTML = '<textarea id="fw-in" placeholder="' + esc(s.ph || '') + '">' + esc(v) + '</textarea>';
    else if (s.type === 'time2') b.innerHTML = timeHtml(s);
    else if (s.type === 'items') b.innerHTML = itemsHtml();
    else if (s.type === 'bank')
      b.innerHTML = '<input type="text" id="fw-in" placeholder="은행명 (예: 국민)" value="' + esc(_d.bank || '') + '" style="margin-bottom:9px">'
        + '<input type="text" id="fw-in2" placeholder="계좌번호" value="' + esc(_d.account || '') + '">';
    else if (s.type === 'kind') b.innerHTML = kindHtml();
    else if (s.type === 'consent') b.innerHTML = consentHtml();
    else if (s.type === 'agree') b.innerHTML = agreeHtml();
    else if (s.type === 'sign') b.innerHTML = signHtml(s.mode);
    else if (s.type === 'review') b.innerHTML = reviewHtml();

    var inp = el('fw-in');
    if (inp && s.num) inp.setAttribute('inputmode', 'numeric');
    if (inp && s.type !== 'date') setTimeout(function () { try { inp.focus(); } catch (e) {} }, 100);
  }

  function timeHtml(s) {
    var a = _d[s.a] || '', b = _d[s.b] || '';
    return '<div style="display:flex;align-items:center;gap:8px">'
      + '<button type="button" class="fw-tbtn" id="fw-t1" onclick="FW.pickTime(\'' + s.a + '\',\'fw-t1\')">' + (a || '-- : --') + '</button>'
      + '<span style="font-weight:900;color:#64748b">~</span>'
      + '<button type="button" class="fw-tbtn" id="fw-t2" onclick="FW.pickTime(\'' + s.b + '\',\'fw-t2\')">' + (b || '-- : --') + '</button>'
      + '</div><div style="font-size:11.5px;color:#94a3b8;font-weight:700;margin-top:9px">버튼을 눌러 시간을 선택하세요</div>';
  }
  FW.pickTime = function (key, btnId) {
    if (typeof openTimePicker === 'function') {
      // 기존 시간 선택기 사용 — hidden input 을 임시로 만들어 연결
      var hid = el('fw-hid-' + key);
      if (!hid) { hid = document.createElement('input'); hid.type = 'hidden'; hid.id = 'fw-hid-' + key; document.body.appendChild(hid); }
      openTimePicker('fw-hid-' + key, btnId);
      var iv = setInterval(function () {
        if (hid.value) { _d[key] = hid.value; clearInterval(iv); }
      }, 200);
      setTimeout(function () { clearInterval(iv); }, 60000);
    } else {
      var t = prompt('시간을 입력하세요 (예: 14:30)', _d[key] || '');
      if (t) { _d[key] = t; render(); }
    }
  };

  function itemsHtml() {
    return RETURN_ITEMS.map(function (n) {
      var st = _d.items[n] || '';
      return '<div class="fw-itm"><b>' + n + '</b>'
        + '<button class="fw-pill ' + (st === '반납' ? 'ok' : '') + '" onclick="FW.pick(\'' + n + '\',\'반납\')">반납</button>'
        + '<button class="fw-pill ' + (st === '분실' ? 'no' : '') + '" onclick="FW.pick(\'' + n + '\',\'분실\')">분실</button></div>';
    }).join('');
  }
  FW.pick = function (n, v) { _d.items[n] = (_d.items[n] === v ? '' : v); render(); };

  function kindHtml() {
    var off = isOff();
    return '<div class="fw-kind">'
      + '<div class="fw-kb ' + (!off ? 'on' : '') + '" onclick="FW.setKind(\'희망조퇴\')"><b>희망조퇴</b><span>일부 근무 후 퇴근</span></div>'
      + '<div class="fw-kb ' + (off ? 'on' : '') + '" onclick="FW.setKind(\'희망휴무\')"><b>희망휴무</b><span>근무 없음</span></div>'
      + '</div>';
  }
  FW.setKind = function (k) { _d.kind = k; render(); };

  function consentHtml() {
    return '<div style="font-size:12px;line-height:1.85;color:#334155;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;word-break:keep-all">'
      + '본인은 위 일자의 <b>근로시간 단축(또는 휴무)을 본인의 자유로운 의사에 따라 자발적으로 신청</b>하며, 회사의 지시나 강요에 의한 것이 아님을 확인합니다.<br><br>'
      + '아울러 해당 시간은 <b>무급</b>으로 처리되며, 이로 인해 <b>주휴수당 지급요건(주 15시간 이상 근무 및 소정근로일 만근)에 영향이 있을 수 있음</b>을 안내받아 이해하였습니다.</div>'
      + '<label style="display:flex;align-items:flex-start;gap:9px;margin-top:14px;font-size:13.5px;font-weight:800;color:#0f172a;cursor:pointer">'
      + '<input type="checkbox" id="fw-consent" ' + (_d.consent ? 'checked' : '') + ' style="width:20px;height:20px;accent-color:#D6001C;margin-top:1px;flex-shrink:0">'
      + '<span>위 내용을 모두 확인하였으며 이에 동의합니다.</span></label>';
  }

  function agreeHtml() {
    return '<div style="font-size:13.5px;line-height:1.9;color:#1f2937;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:15px;margin-bottom:13px;word-break:keep-all">'
      + '본인은 근로기준법 제36조에 의거하여 회사와의 근로관계 종료에 따른 임금 등의 금품청산을 <b>퇴사하는 월의 익월 급여일까지 연장</b>하여 청산하는 것을 합의합니다.</div>'
      + '<input type="text" id="fw-in" placeholder="확인 이름" value="' + esc(_d.agreeName || '') + '" style="margin-bottom:11px">'
      + signHtml('agreement')
      + '<div style="font-size:11.5px;color:#94a3b8;font-weight:700;margin-top:10px;word-break:keep-all">합의가 어려우시면 제출 전 관리자에게 문의해 주세요.</div>';
  }

  function signHtml(mode) {
    var v = mode === 'submitter' ? window._submitterSignDataURL : mode === 'agreement' ? window._agreementSignDataURL : window._signDataURL;
    return '<button type="button" class="fw-sigbtn ' + (v ? 'done' : '') + '" onclick="FW.sign(\'' + mode + '\')">'
      + (v ? '✓ 서명 완료 — 다시 서명하려면 탭' : '✏️ 여기를 눌러 서명하기') + '</button>'
      + (v ? '<img src="' + v + '" style="display:block;max-height:70px;margin:12px auto 0;border:1px solid #e2e8f0;border-radius:8px;background:#fff">' : '');
  }
  FW.sign = function (mode) {
    if (typeof openSignPad !== 'function') { alert('서명 기능을 불러오지 못했습니다.'); return; }
    openSignPad(mode);
    // 서명패드가 닫히면 화면 갱신
    var iv = setInterval(function () {
      var m = document.getElementById('sign-pad-modal');
      if (!m || m.style.display === 'none') { clearInterval(iv); render(); }
    }, 300);
    setTimeout(function () { clearInterval(iv); }, 120000);
  };

  function reviewHtml() {
    function row(k, v) { return '<div class="r"><div class="k">' + k + '</div><div class="v">' + (v || '<span style="color:#cbd5e1">미입력</span>') + '</div></div>'; }
    var h = '<div class="fw-rv">';
    if (_type === 'resign') {
      var ret = [], lost = [];
      RETURN_ITEMS.forEach(function (n) { (_d.items[n] === '분실' ? lost : ret).push(n); });
      h += row('퇴직일', fmtD(_d.resignDate)) + row('입사일', fmtD(_d.hireDate)) + row('주민번호', _d.birth)
        + row('연락처', _d.phone) + row('퇴사 사유', esc(_d.reason))
        + row('반납 물품', ret.join(', ') + (lost.length ? '<div style="color:#b91c1c;margin-top:3px">분실 : ' + lost.join(', ') + ' (변상 대상)</div>' : ''))
        + row('계좌', (_d.bank || '') + ' ' + (_d.account || ''))
        + row('합의 확인', (_d.agreeName || '') + (window._agreementSignDataURL ? ' <span style="color:#15803d">· 서명완료</span>' : ''))
        + row('제출자 서명', window._submitterSignDataURL ? '<span style="color:#15803d">서명완료</span>' : '')
        + row('면담 직원', _admin || '관리자');
    } else if (_type === 'earlyLeave') {
      h += row('구분', _d.kind) + row('날짜', fmtD(_d.date))
        + row('약정 근로시간', (_d.schStart || '') + (_d.schEnd ? ' ~ ' + _d.schEnd : ''))
        + row('희망 퇴근', isOff() ? '해당없음' : ((_d.actStart || '') + (_d.actEnd ? ' ~ ' + _d.actEnd : '')))
        + row('사유', esc(_d.content)) + row('동의', _d.consent ? '<span style="color:#15803d">동의함</span>' : '')
        + row('서명', window._signDataURL ? '<span style="color:#15803d">서명완료</span>' : '');
    } else if (_type === 'late') {
      h += row('날짜', fmtD(_d.date))
        + row('약정 근로시간', (_d.schStart || '') + (_d.schEnd ? ' ~ ' + _d.schEnd : ''))
        + row('실제 근로시간', (_d.actStart || '') + (_d.actEnd ? ' ~ ' + _d.actEnd : ''))
        + row('사유', esc(_d.content))
        + row('서명', window._signDataURL ? '<span style="color:#15803d">서명완료</span>' : '');
    } else if (_type === 'absent') {
      h += row('날짜', fmtD(_d.date)) + row('주민번호', _d.birth) + row('사유', esc(_d.why))
        + row('서명', window._submitterSignDataURL ? '<span style="color:#15803d">서명완료</span>' : '');
    } else {
      h += row('생년월일', _d.birth) + (_d.phone ? row('연락처', _d.phone) : '') + row('작성일', fmtD(_d.date))
        + row('서명', window._signDataURL ? '<span style="color:#15803d">서명완료</span>' : '');
    }
    h += '</div><div style="font-size:11.5px;color:#94a3b8;font-weight:700;margin-top:12px;text-align:center">제출하면 위 내용이 ' + (LABELS[_type] || '서류') + ' 양식으로 저장됩니다.</div>';
    return h;
  }

  function err(m) { var e = el('fw-e'); e.textContent = m; e.style.display = 'block'; }

  FW.prev = function () { if (_i > 0) { _i--; render(); } };

  FW.next = function () {
    var list = vSteps(), s = list[_i], inp = el('fw-in');
    if (s.type === 'review') { submit(); return; }
    if (s.type === 'time2') {
      if (!_d[s.a] || !_d[s.b]) return err('시작·종료 시간을 모두 선택해 주세요.');
      if (_d[s.a] === _d[s.b]) return err('시작과 종료 시간이 같습니다.');
    } else if (s.type === 'items') {
      var miss = RETURN_ITEMS.filter(function (n) { return !_d.items[n]; });
      if (miss.length) return err(miss.join(', ') + ' — 반납 또는 분실을 선택해 주세요.');
    } else if (s.type === 'bank') {
      if (!inp.value.trim()) return err('은행명을 입력해 주세요.');
      if (!el('fw-in2').value.trim()) return err('계좌번호를 입력해 주세요.');
      _d.bank = inp.value.trim(); _d.account = el('fw-in2').value.trim();
    } else if (s.type === 'kind') {
      // 항상 선택되어 있음
    } else if (s.type === 'consent') {
      var c = el('fw-consent');
      if (!c || !c.checked) return err('확인 사항에 동의해 주세요.');
      _d.consent = true;
    } else if (s.type === 'agree') {
      if (!inp.value.trim()) return err('확인 이름을 입력해 주세요.');
      if (!window._agreementSignDataURL) return err('합의 서명을 해주세요.');
      _d.agreeName = inp.value.trim();
    } else if (s.type === 'sign') {
      var sv = s.mode === 'submitter' ? window._submitterSignDataURL : s.mode === 'agreement' ? window._agreementSignDataURL : window._signDataURL;
      if (!sv) return err('서명을 해주세요.');
    } else {
      if (!inp || !inp.value.trim()) return err('입력해 주세요.');
      if (s.k === 'birth' && !/^\d{6}$/.test(inp.value.trim())) return err('숫자 6자리로 입력해 주세요.');
      _d[s.k] = inp.value.trim();
    }
    if (_i < list.length - 1) { _i++; render(); }
  };

  // 기존 제출 경로(submitForm)로 보낸다 — 저장·출력 형식은 그대로 유지
  function submit() {
    var today = (typeof getLocalYYYYMMDD === 'function') ? getLocalYYYYMMDD(new Date()) : new Date().toISOString().slice(0, 10);
    var fd;
    if (_type === 'resign') {
      var ret = [], lost = [];
      RETURN_ITEMS.forEach(function (n) { (_d.items[n] === '분실' ? lost : ret).push(n); });
      fd = { name: _name, birth: _d.birth, hireDate: _d.hireDate, resignDate: _d.resignDate,
             resignYMD: fmtD(_d.resignDate), phone: _d.phone, reason: _d.reason,
             returnItems: ret.join(', '), lostItems: lost.join(', '),
             bank: _d.bank, account: _d.account, submitter: _name, submitYMD: fmtD(today),
             interviewer: _admin || '', submitterSign: window._submitterSignDataURL || '',
             agreeName: _d.agreeName, agreeSign: window._agreementSignDataURL || '' };
    } else if (_type === 'earlyLeave') {
      fd = { kind: _d.kind, name: _name, date: _d.date, content: _d.content,
             schStart: _d.schStart, schEnd: _d.schEnd,
             actStart: isOff() ? '' : _d.actStart, actEnd: isOff() ? '' : _d.actEnd,
             consent: !!_d.consent, sign: window._signDataURL || '' };
    } else if (_type === 'late') {
      fd = { name: _name, date: _d.date, content: _d.content,
             schStart: _d.schStart, schEnd: _d.schEnd, actStart: _d.actStart, actEnd: _d.actEnd,
             sign: window._signDataURL || '' };
    } else if (_type === 'absent') {
      fd = { name: _name, date: _d.date, birth: _d.birth, why: _d.why,
             submitterSign: window._submitterSignDataURL || '' };
    } else {
      fd = { name: _name, birth: _d.birth, phone: _d.phone, date: _d.date, sign: window._signDataURL || '' };
    }

    var btn = el('fw-next'); if (btn) { btn.disabled = true; btn.textContent = '제출 중…'; }
    google.script.run
      .withSuccessHandler(function () {
        if (btn) { btn.disabled = false; btn.textContent = '제출하기'; }
        FW.cancel();
        if (typeof closeMyFormsModal === 'function') closeMyFormsModal();
        if (typeof checkMyPendingForms === 'function') checkMyPendingForms();
        var db = document.getElementById('my-docbox'); if (db) db.removeAttribute('data-loaded');
        if (typeof renderMyDocbox === 'function') renderMyDocbox();
        alert('제출이 완료되었습니다. 수고하셨습니다!');
      })
      .withFailureHandler(function (e) {
        if (btn) { btn.disabled = false; btn.textContent = '제출하기'; }
        alert('제출 실패: ' + (e && e.message ? e.message : e));
      })
      .submitForm(_reqId, fd);
  }
})();
