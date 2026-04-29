/**
 * 푸시 알림 가이드 메시지 수정
 * - PWA 설치 앱 기준으로 안내
 * - requestPushPermission: default 상태에서도 가이드 보여주기 (일부 기기 팝업 안 뜨는 경우 대비)
 */
const fs = require('fs');
const path = require('path');
const appJsPath = path.join(__dirname, '..', 'public', 'cgv-app.js');
let c = fs.readFileSync(appJsPath, 'utf8');

const startMarker = '        function requestPushPermission(name) {';
const endMarker = '        function updatePushBtn(name) {';
const si = c.indexOf(startMarker);
const ei = c.indexOf(endMarker);
if (si < 0 || ei < 0) { console.log('마커 없음:', si, ei); process.exit(1); }

const newBlock =
'        function requestPushPermission(name) {\n' +
'            if (!(\'serviceWorker\' in navigator) || !(\'PushManager\' in window)) {\n' +
'                alert(\'이 브라우저는 푸시 알림을 지원하지 않습니다.\\n크롬 브라우저 또는 PWA 앱에서 이용해주세요.\'); return;\n' +
'            }\n' +
'            var perm = Notification.permission;\n' +
'            if (perm === \'denied\') { showPushDeniedGuide(); return; }\n' +
'            if (perm === \'granted\') { doSubscribe(name); return; }\n' +
'            // default: 권한 요청 팝업\n' +
'            Notification.requestPermission().then(function(p) {\n' +
'                if (p === \'granted\') doSubscribe(name);\n' +
'                else if (p === \'denied\') showPushDeniedGuide();\n' +
'                else updatePushBtn(name);\n' +
'            });\n' +
'        }\n' +
'\n' +
'        function showPushDeniedGuide() {\n' +
'            if (Notification.permission !== \'denied\') {\n' +
'                updatePushBtn(getPushName()); return;\n' +
'            }\n' +
'            var ua = navigator.userAgent.toLowerCase();\n' +
'            var isStandalone = window.matchMedia(\'(display-mode: standalone)\').matches || window.navigator.standalone;\n' +
'            var msg;\n' +
'            if (/android/.test(ua)) {\n' +
'                if (isStandalone) {\n' +
'                    // PWA로 설치된 경우\n' +
'                    msg = \'알림 권한이 차단되어 있습니다.\\n\\n[설정 방법]\\n' +
'① 기기의 설정 앱 열기\\n' +
'② 앱 → Chrome 찾기\\n' +
'③ 권한 → 알림 → 허용\\n\\n' +
'또는:\\n' +
'크롬 브라우저 → 주소창 오른쪽 ⋮ 메뉴\\n' +
'→ 설정 → 사이트 설정 → 알림\\n' +
'→ 이 사이트 주소 찾아서 허용\\n\\n' +
'설정 후 앱을 새로고침하세요.\';\n' +
'                } else {\n' +
'                    // 브라우저에서 접속한 경우\n' +
'                    msg = \'알림 권한이 차단되어 있습니다.\\n\\n[설정 방법]\\n' +
'주소창 왼쪽 🔒 아이콘 클릭\\n' +
'→ 알림 → 허용\\n\\n' +
'설정 후 페이지를 새로고침하세요.\';\n' +
'                }\n' +
'            } else if (/iphone|ipad/.test(ua)) {\n' +
'                msg = \'알림 권한이 차단되어 있습니다.\\n\\n[iPhone 설정 방법]\\n' +
'① 기기 설정 앱 열기\\n' +
'② 화면 맨 아래로 스크롤\\n' +
'③ Safari 또는 앱 이름 찾기\\n' +
'→ 알림 → 허용\\n\\n' +
'설정 후 앱을 새로고침하세요.\';\n' +
'            } else {\n' +
'                msg = \'알림 권한이 차단되어 있습니다.\\n\\n[설정 방법]\\n' +
'주소창 왼쪽 🔒 아이콘 클릭\\n' +
'→ 알림 → 허용\\n\\n' +
'설정 후 페이지를 새로고침하세요.\';\n' +
'            }\n' +
'            alert(msg);\n' +
'        }\n' +
'\n';

c = c.substring(0, si) + newBlock + c.substring(ei);
fs.writeFileSync(appJsPath, c, 'utf8');
console.log('push 가이드 교체: OK');
try { new Function(c); console.log('문법 OK'); } catch(e) { console.log('문법 에러:', e.message); }
