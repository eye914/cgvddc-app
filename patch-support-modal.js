const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'public', 'cgv-app.js');
let content = fs.readFileSync(filePath, 'utf8');
const nl = '\r\n';

// ── 코드 칩 onclick 교체 (포지션-시간 교차 제한 제거) ──
const oldCode = [
  '                b.onclick = function(){',
  '                    var curPos = document.getElementById("support-selected-pos").value;',
  '                    // 매점 포지션 → N 코드 선택 불가',
  '                    if (curPos === "\\uB9E4\\uC810" && i.code.startsWith("N")) {',
  '                        alert("\\uB9E4\\uC810 \\uD3EC\\uC9C0\\uC158\\uC740 \\uB9C8\\uAC10(N) \\uC2DC\\uAC04\\uB300\\uB97C \\uC120\\uD0DD\\uD560 \\uC218 \\uC5C6\\uC2B5\\uB2C8\\uB2E4."); return;',
  '                    }',
  '                    // 매점마감 포지션 → D/M 코드 선택 불가',
  '                    if (curPos === "\\uB9E4\\uC810\\uB9C8\\uAC10" && !i.code.startsWith("N")) {',
  '                        alert("\\uB9E4\\uC810\\uB9C8\\uAC10 \\uD3EC\\uC9C0\\uC158\\uC740 \\uB9C8\\uAC10(N) \\uC2DC\\uAC04\\uB300\\uB9CC \\uC120\\uD0DD \\uAC00\\uB2A5\\uD569\\uB2C8\\uB2E4."); return;',
  '                    }',
  '                    codeGrid.querySelectorAll(".support-code-chip").forEach(function(c){ c.classList.remove("selected","bg-blue-100","border-blue-400"); });',
  '                    b.classList.add("selected","bg-blue-100","border-blue-400");',
  '                    document.getElementById("support-selected-code").value = cStr;',
  '                    // N 선택 시 매점 포지션 해제',
  '                    if (i.code.startsWith("N")) {',
  '                        var cp = document.getElementById("support-selected-pos").value;',
  '                        if (cp === "\\uB9E4\\uC810") {',
  '                            posContainer.querySelectorAll(".support-pos-chip").forEach(function(c){ c.classList.remove("pos-selected"); });',
  '                            document.getElementById("support-selected-pos").value = "";',
  '                            alert("\\uB9C8\\uAC10(N) \\uC2DC\\uAC04\\uB300\\uC5D0\\uB294 \\uB9E4\\uC810\\uC744 \\uC120\\uD0DD\\uD560 \\uC218 \\uC5C6\\uC5B4 \\uD3EC\\uC9C0\\uC158\\uC774 \\uCD08\\uAE30\\uD654\\uB418\\uC5C8\\uC2B5\\uB2C8\\uB2E4.");',
  '                        }',
  '                    }',
  '                    // D/M 선택 시 매점마감 포지션 해제',
  '                    if (!i.code.startsWith("N")) {',
  '                        var cp = document.getElementById("support-selected-pos").value;',
  '                        if (cp === "\\uB9E4\\uC810\\uB9C8\\uAC10") {',
  '                            posContainer.querySelectorAll(".support-pos-chip").forEach(function(c){ c.classList.remove("pos-selected"); });',
  '                            document.getElementById("support-selected-pos").value = "";',
  '                            alert("\\uB9C8\\uAC10(N) \\uC2DC\\uAC04\\uB300\\uAC00 \\uC544\\uB2C8\\uBA74 \\uB9E4\\uC810\\uB9C8\\uAC10\\uC744 \\uC120\\uD0DD\\uD560 \\uC218 \\uC5C6\\uC2B5\\uB2C8\\uB2E4.");',
  '                        }',
  '                    }',
  '                };',
].join(nl);

const newCode = [
  '                b.onclick = function(){',
  '                    // 지원 모달: 공고자가 정의한 조합 허용 (포지션-시간 교차 제한 없음)',
  '                    codeGrid.querySelectorAll(".support-code-chip").forEach(function(c){ c.classList.remove("selected","bg-blue-100","border-blue-400"); });',
  '                    b.classList.add("selected","bg-blue-100","border-blue-400");',
  '                    document.getElementById("support-selected-code").value = cStr;',
  '                };',
].join(nl);

if (content.indexOf(oldCode) === -1) {
  console.error('ERROR: oldCode not found');
  process.exit(1);
}
content = content.replace(oldCode, newCode);
console.log('Code onclick replaced OK');

// ── 포지션 칩 onclick 교차 제한 제거 ──
const oldPos = [
  '                b.onclick = function(){',
  '                    var isTotal = currentUserPos.indexOf("\\uD1B5\\uD569") > -1;',
  '                    var canMM = currentUserPos.indexOf("\\uB9E4\\uC810") > -1 || isTotal;',
  '                    if (!isTotal && currentUserPos.indexOf(p) === -1 && !(p === "\\uB9E4\\uC810\\uB9C8\\uAC10" && canMM)){ alert("\\uBCF8\\uC778 \\uC5ED\\uB7C9 \\uBC16\\uC758 \\uD3EC\\uC9C0\\uC158\\uC785\\uB2C8\\uB2E4."); return; }',
  '                    var sc = document.getElementById("support-selected-code").value;',
  '                    // 매점 → N 코드 선택된 경우 차단',
  '                    if (p === "\\uB9E4\\uC810" && sc.startsWith("N")) {',
  '                        alert("\\uB9C8\\uAC10(N) \\uC2DC\\uAC04\\uB300\\uB294 \\uB9E4\\uC810 \\uB300\\uC2E0 \\uB9E4\\uC810\\uB9C8\\uAC10, \\uD1B5\\uD569, \\uD50C\\uB85C\\uC5B4\\uB9CC \\uC120\\uD0DD \\uAC00\\uB2A5\\uD569\\uB2C8\\uB2E4."); return;',
  '                    }',
  '                    // 매점마감 → D/M 코드 선택된 경우 차단',
  '                    if (p === "\\uB9E4\\uC810\\uB9C8\\uAC10" && sc && !sc.startsWith("N")) {',
  '                        alert("\\uB9E4\\uC810\\uB9C8\\uAC10\\uC740 \\uB9C8\\uAC10(N) \\uC2DC\\uAC04\\uB300\\uC5D0\\uC11C\\uB9CC \\uC120\\uD0DD \\uAC00\\uB2A5\\uD569\\uB2C8\\uB2E4."); return;',
  '                    }',
  '                    posContainer.querySelectorAll(".support-pos-chip").forEach(function(c){ c.classList.remove("pos-selected","bg-slate-800","text-white"); });',
  '                    b.classList.add("pos-selected","bg-slate-800","text-white");',
  '                    document.getElementById("support-selected-pos").value = p;',
  '                };',
].join(nl);

const newPos = [
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
].join(nl);

if (content.indexOf(oldPos) === -1) {
  console.error('ERROR: oldPos not found');
  process.exit(1);
}
content = content.replace(oldPos, newPos);
console.log('Pos onclick replaced OK');

// ── allowedPos에 trim() 추가 ──
const oldAllowedPos = 'var allowedPos = opt.pos ? opt.pos.split("/") : ["\\uD1B5\\uD569","\\uB9E4\\uC810","\\uB9E4\\uC810\\uB9C8\\uAC10","\\uD50C\\uB85C\\uC5B4"];';
const newAllowedPos = 'var allowedPos = opt.pos ? opt.pos.split("/").map(function(s){ return s.trim(); }) : ["\\uD1B5\\uD569","\\uB9E4\\uC810","\\uB9E4\\uC810\\uB9C8\\uAC10","\\uD50C\\uB85C\\uC5B4"];';
if (content.indexOf(oldAllowedPos) !== -1) {
  content = content.replace(oldAllowedPos, newAllowedPos);
  console.log('allowedPos trim added OK');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done!');
