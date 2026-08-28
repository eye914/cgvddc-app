const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'public', 'cgv-app.js');
let content = fs.readFileSync(filePath, 'utf8');
const nl = '\r\n';

// ── Fix 1: allowedPos 기본값을 전체가 아닌 reqPos 기준으로 ──
// ── Fix 2: 포지션 1개이면 자동 선택, 코드 선택 시도 포지션 자동 선택 ──

const oldPosSection = [
  '            posContainer.innerHTML = "";',
  '            var allowedPos = opt.pos ? opt.pos.split("/").map(function(s){ return s.trim(); }) : ["\\uD1B5\\uD569","\\uB9E4\\uC810","\\uB9E4\\uC810\\uB9C8\\uAC10","\\uD50C\\uB85C\\uC5B4"];',
  '            allowedPos.forEach(function(p){',
  '                var b = document.createElement("div");',
  '                var isTotal = currentUserPos.indexOf("\\uD1B5\\uD569") > -1;',
  '                var canDo = isTotal',
  '                    || currentUserPos.indexOf(p) > -1',
  '                    || (p === "\\uB9E4\\uC810\\uB9C8\\uAC10" && currentUserPos.indexOf("\\uB9E4\\uC810") > -1);',
  '                b.className = "support-pos-chip chip py-3 px-4 rounded-xl font-black text-xs text-slate-700 transition-all border shadow-sm bg-white border-slate-200" + (canDo ? "" : " locked");',
  '                b.innerHTML = p;',
  '                b.onclick = function(){',
  '                    var isTotal2 = currentUserPos.indexOf("\\uD1B5\\uD569") > -1;',
  '                    var canMM = currentUserPos.indexOf("\\uB9E4\\uC810") > -1 || isTotal2;',
  '                    // 역량 체크만 수행 — 시간대와의 교차 제한 없음',
  '                    if (!isTotal2 && currentUserPos.indexOf(p) === -1 && !(p === "\\uB9E4\\uC810\\uB9C8\\uAC10" && canMM)){',
  '                        alert("\\uBCF8\\uC778 \\uC5ED\\uB7C9 \\uBC16\\uC758 \\uD3EC\\uC9C0\\uC158\\uC785\\uB2C8\\uB2E4."); return;',
  '                    }',
  '                    posContainer.querySelectorAll(".support-pos-chip").forEach(function(c){ c.classList.remove("pos-selected","bg-slate-800","text-white"); });',
  '                    b.classList.add("pos-selected","bg-slate-800","text-white");',
  '                    document.getElementById("support-selected-pos").value = p;',
  '                };',
  '                posContainer.appendChild(b);',
  '            });',
  '        }',
].join(nl);

const newPosSection = [
  '            posContainer.innerHTML = "";',
  '            // opt.pos가 없으면 공고자의 reqPos를 기본 포지션으로 사용',
  '            var _trade = trades.find(function(tr){ return tr.id === selectedTradeId; });',
  '            var _defaultPos = (_trade && _trade.reqPos) ? _trade.reqPos : "\\uD1B5\\uD569";',
  '            var allowedPos = opt.pos ? opt.pos.split("/").map(function(s){ return s.trim(); }) : [_defaultPos];',
  '            allowedPos.forEach(function(p){',
  '                var b = document.createElement("div");',
  '                var isTotal = currentUserPos.indexOf("\\uD1B5\\uD569") > -1;',
  '                var canDo = isTotal',
  '                    || currentUserPos.indexOf(p) > -1',
  '                    || (p === "\\uB9E4\\uC810\\uB9C8\\uAC10" && currentUserPos.indexOf("\\uB9E4\\uC810") > -1);',
  '                b.className = "support-pos-chip chip py-3 px-4 rounded-xl font-black text-xs text-slate-700 transition-all border shadow-sm bg-white border-slate-200" + (canDo ? "" : " locked");',
  '                b.innerHTML = p;',
  '                b.onclick = function(){',
  '                    var isTotal2 = currentUserPos.indexOf("\\uD1B5\\uD569") > -1;',
  '                    var canMM = currentUserPos.indexOf("\\uB9E4\\uC810") > -1 || isTotal2;',
  '                    if (!isTotal2 && currentUserPos.indexOf(p) === -1 && !(p === "\\uB9E4\\uC810\\uB9C8\\uAC10" && canMM)){',
  '                        alert("\\uBCF8\\uC778 \\uC5ED\\uB7C9 \\uBC16\\uC758 \\uD3EC\\uC9C0\\uC158\\uC785\\uB2C8\\uB2E4."); return;',
  '                    }',
  '                    posContainer.querySelectorAll(".support-pos-chip").forEach(function(c){ c.classList.remove("pos-selected","bg-slate-800","text-white"); });',
  '                    b.classList.add("pos-selected","bg-slate-800","text-white");',
  '                    document.getElementById("support-selected-pos").value = p;',
  '                };',
  '                posContainer.appendChild(b);',
  '            });',
  '            // 포지션이 1개뿐이면 자동 선택',
  '            if (allowedPos.length === 1) {',
  '                var _autoChip = posContainer.querySelector(".support-pos-chip");',
  '                if (_autoChip) _autoChip.click();',
  '            }',
  '        }',
].join(nl);

if (content.indexOf(oldPosSection) === -1) {
  console.error('oldPosSection not found');
  process.exit(1);
}
content = content.replace(oldPosSection, newPosSection);
console.log('Pos section replaced OK');

// ── Fix 2: 코드 칩 선택 시 포지션이 1개면 자동 선택 ──
const oldCodeOnclick = [
  '                b.onclick = function(){',
  '                    // 지원 모달: 공고자가 정의한 조합 허용 (포지션-시간 교차 제한 없음)',
  '                    codeGrid.querySelectorAll(".support-code-chip").forEach(function(c){ c.classList.remove("selected","bg-blue-100","border-blue-400"); });',
  '                    b.classList.add("selected","bg-blue-100","border-blue-400");',
  '                    document.getElementById("support-selected-code").value = cStr;',
  '                };',
].join(nl);

const newCodeOnclick = [
  '                b.onclick = function(){',
  '                    // 지원 모달: 공고자가 정의한 조합 허용 (포지션-시간 교차 제한 없음)',
  '                    codeGrid.querySelectorAll(".support-code-chip").forEach(function(c){ c.classList.remove("selected","bg-blue-100","border-blue-400"); });',
  '                    b.classList.add("selected","bg-blue-100","border-blue-400");',
  '                    document.getElementById("support-selected-code").value = cStr;',
  '                    // 포지션 1개일 때 자동 선택 (아직 선택 안 된 경우)',
  '                    var _chips = posContainer.querySelectorAll(".support-pos-chip");',
  '                    if (_chips.length === 1 && !document.getElementById("support-selected-pos").value) {',
  '                        _chips[0].click();',
  '                    }',
  '                };',
].join(nl);

if (content.indexOf(oldCodeOnclick) === -1) {
  console.error('oldCodeOnclick not found');
  process.exit(1);
}
content = content.replace(oldCodeOnclick, newCodeOnclick);
console.log('Code onclick updated OK');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done!');
