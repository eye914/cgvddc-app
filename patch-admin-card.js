// patch-admin-card.js — 관리자 카드 UI 재설계
var fs = require('fs');
var content = fs.readFileSync('public/cgv-app.js', 'utf8');

var startMarker = '                    var _subHoursBadge = _subHours';
var endMarker   = '                    adminGrouped[wkA].push({ html:aCardHtml, date:safeDate, isDone:isD });';

var startIdx = content.indexOf(startMarker);
var endIdx   = content.indexOf(endMarker) + endMarker.length;

if (startIdx === -1 || endIdx === -1) {
  console.error('Markers not found!', startIdx, endIdx); process.exit(1);
}

// 새 블록: _reqOwnPos 추가 + aCardHtml 재설계
var newBlock = `
                    // ── 신청자·수락자 본인 포지션 ──
                    var _reqOwnPos = _reqMiso && Array.isArray(_reqMiso.pos) && _reqMiso.pos.length
                        ? _reqMiso.pos.join(' / ')
                        : (_reqMiso && typeof _reqMiso.pos === 'string' ? _reqMiso.pos : (t.reqPos || ''));

                    // ── 관리자 카드 (재설계) ──────────────────────────────
                    var _approvedRow = (t.approvedBy && isD)
                        ? '<span style="font-size:10px;font-weight:700;color:#94a3b8">승인&nbsp;<b style="color:#475569">' + t.approvedBy + '</b></span>'
                        : '';
                    var _outNameRow =
                        '<div style="display:flex;align-items:center;gap:5px;margin-bottom:5px">'
                        + '<span style="font-size:9px;font-weight:900;color:#ef4444;background:#fef2f2;padding:2px 7px;border-radius:5px;flex-shrink:0">OUT</span>'
                        + '<span style="font-size:14px;font-weight:900;color:#0f172a">' + t.reqName + '</span>'
                        + (_reqHoursVal ? '<span style="font-size:9px;font-weight:900;padding:2px 6px;border-radius:5px;background:#fee2e2;color:#b91c1c">' + _reqHoursVal + 'h</span>' : '')
                        + (_reqOwnPos ? '<span style="margin-left:auto;font-size:9px;font-weight:900;padding:2px 8px;border-radius:5px;background:#fef3c7;color:#92400e;white-space:nowrap">' + _reqOwnPos + '</span>' : '')
                        + '</div>';
                    var _inNameRow =
                        '<div style="display:flex;align-items:center;gap:5px;margin-bottom:5px">'
                        + '<span style="font-size:9px;font-weight:900;color:#2563eb;background:#eff6ff;padding:2px 8px;border-radius:5px;flex-shrink:0">IN</span>'
                        + '<span style="font-size:14px;font-weight:900;color:#0f172a">' + t.subName + '</span>'
                        + (_subHours ? '<span style="font-size:9px;font-weight:900;padding:2px 6px;border-radius:5px;background:#dbeafe;color:#1d4ed8">' + _subHours + 'h</span>' : '')
                        + (_subOwnPos ? '<span style="margin-left:auto;font-size:9px;font-weight:900;padding:2px 8px;border-radius:5px;background:#f3e8ff;color:#7c3aed;white-space:nowrap">' + _subOwnPos + '</span>' : '')
                        + '</div>';
                    var _btnRow = isD ? '' :
                        '<div style="display:flex;gap:8px;margin-top:4px">'
                        + '<button onclick="adminApprove(\'' + t.id + '\')" style="flex:1;padding:11px 0;background:#0f172a;color:white;border:none;border-radius:12px;font-size:12px;font-weight:900;cursor:pointer">✅ 최종 승인</button>'
                        + '<button onclick="adminReject(\'' + t.id + '\')" style="flex:1;padding:11px 0;background:#fef2f2;color:#dc2626;border:1.5px solid #fca5a5;border-radius:12px;font-size:12px;font-weight:900;cursor:pointer">↩ 반려</button>'
                        + '</div>'
                        + '<button onclick="adminCancelTrade(\'' + t.id + '\',\'' + t.reqName + '\')" style="width:100%;margin-top:5px;padding:6px 0;background:transparent;color:#94a3b8;border:none;font-size:10px;font-weight:900;cursor:pointer">공고 취소</button>';

                    var aCardHtml =
                        '<div style="background:white;border-radius:18px;padding:14px 16px;border:2px solid ' + (isD ? '#bbf7d0' : '#bfdbfe') + ';box-shadow:0 2px 10px rgba(0,0,0,.07);margin-bottom:12px">'
                        // 헤더
                        + '<div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:9px;margin-bottom:10px;border-bottom:1px solid #f1f5f9">'
                        + '<span style="font-size:10px;font-weight:900;padding:3px 9px;border-radius:6px;background:' + (isD ? '#dcfce7;color:#16a34a' : '#dbeafe;color:#2563eb') + '">' + (isD ? '✅ 확정완료' : '⏳ 승인대기') + '</span>'
                        + _approvedRow
                        + '</div>'
                        // OUT
                        + '<div style="margin-bottom:8px">'
                        + _outNameRow
                        + '<div style="background:#fef2f2;border-radius:10px;padding:7px 12px;font-size:12px;color:#374151">' + outHtml + '</div>'
                        + '</div>'
                        // 구분선
                        + '<div style="display:flex;align-items:center;gap:8px;margin:6px 0"><div style="flex:1;height:1px;background:#e2e8f0"></div><span style="font-size:12px;color:#cbd5e1">⇅</span><div style="flex:1;height:1px;background:#e2e8f0"></div></div>'
                        // IN
                        + '<div style="margin-bottom:10px">'
                        + _inNameRow
                        + '<div style="background:#eff6ff;border-radius:10px;padding:7px 12px;font-size:12px;color:#374151">' + inHtml + '</div>'
                        + '</div>'
                        // 버튼
                        + _btnRow
                        + '</div>';
                    var wkA = getWeekKey(safeDate);
                    if (!adminGrouped[wkA]) adminGrouped[wkA] = [];
                    adminGrouped[wkA].push({ html:aCardHtml, date:safeDate, isDone:isD });`;

var result = content.slice(0, startIdx) + newBlock + '\n' + content.slice(endIdx);
fs.writeFileSync('public/cgv-app.js', result, 'utf8');
console.log('Done. Size diff:', result.length - content.length);
