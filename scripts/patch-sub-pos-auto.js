/**
 * 대타 지원 시 포지션 자동 설정
 * - tradeType === "sub" (대타): reqPos 자동 설정, 포지션 선택 UI 숨김
 * - 맞교대: 기존대로 포지션 선택 UI 표시
 */
const fs = require('fs');
const path = require('path');
const appJsPath = path.join(__dirname, '..', 'public', 'cgv-app.js');
let c = fs.readFileSync(appJsPath, 'utf8');

// 고유 마커: 이 줄을 기준으로 찾기
const marker = '                if (t.reqPos) setSupportPositionSilently(t.reqPos);';
const idx = c.indexOf(marker);
if (idx < 0) { console.log('마커 없음'); process.exit(1); }

// 마커 앞 블록 (라벨 업데이트 3줄) 시작점 찾기
const blockStart = c.lastIndexOf('                // 라벨 업데이트: 본인 가능 포지션 명시', idx);
const blockEnd = idx + marker.length;

const newBlock =
'                var posWrap = document.querySelector("#support-pos-container").parentElement;\n' +
'                var posLabelEl = document.querySelector("#support-pos-container").previousElementSibling;\n' +
'\n' +
'                if (t.tradeType === "sub") {\n' +
'                    // 대타: 포지션 = reqPos 자동 고정, 선택 UI 숨김\n' +
'                    if (posWrap) posWrap.classList.add("hidden");\n' +
'                    document.getElementById("support-selected-pos").value = t.reqPos || "";\n' +
'                } else {\n' +
'                    // 맞교대: 포지션 선택 UI 표시\n' +
'                    if (posWrap) posWrap.classList.remove("hidden");\n' +
'                    if (posLabelEl) posLabelEl.innerText = "투입 포지션 선택 (나의 역량: "+currentUserPos.join("/")+")"; \n' +
'                    if (t.reqPos) setSupportPositionSilently(t.reqPos);\n' +
'                }';

c = c.substring(0, blockStart) + newBlock + c.substring(blockEnd);
fs.writeFileSync(appJsPath, c, 'utf8');
console.log('포지션 자동설정 패치: OK');
try { new Function(c); console.log('문법 OK'); } catch(e) { console.log('문법 에러:', e.message); }
