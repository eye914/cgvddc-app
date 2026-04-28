/**
 * push 권한 처리 v3
 * - 권한 허용됐는데 구독 안 된 경우 → 자동 구독
 * - visibilitychange: sessionStorage에서 이름 직접 읽기
 * - 차단됨 클릭 시 재확인 먼저, 아니면 Chrome 사이트 설정 안내
 */
const fs = require('fs');
const path = require('path');
const appJsPath = path.join(__dirname, '..', 'public', 'cgv-app.js');
let c = fs.readFileSync(appJsPath, 'utf8');

const startMarker = '// ── 푸시 알림 ──';
const endMarker = '        function buildAuthNameGrid()';
const si = c.indexOf(startMarker);
const ei = c.indexOf(endMarker);

if (si < 0 || ei < 0) { console.log('마커 없음:', si, ei); process.exit(1); }

const newPushBlock = `// ── 푸시 알림 ──
        var VAPID_PUBLIC_KEY = 'BP1y9f4tcZUHXhoWhMxiiy6Gu4Yft8O6LTW4zeJs5KBVKTaVVS7pj-i9z-sbQQrluG5MyQJXPTfSz7i_BPeTIEs';

        function urlBase64ToUint8Array(base64String) {
            var padding = '='.repeat((4 - base64String.length % 4) % 4);
            var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
            var rawData = window.atob(base64);
            var out = new Uint8Array(rawData.length);
            for (var i = 0; i < rawData.length; ++i) out[i] = rawData.charCodeAt(i);
            return out;
        }

        function getPushName() {
            return sessionStorage.getItem('cgv_currentUser') || sessionStorage.getItem('cgv_admin_name') || '';
        }

        function doSubscribe(name) {
            if (!name) return;
            navigator.serviceWorker.ready.then(function(reg) {
                return reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
                });
            }).then(function(sub) {
                return fetch('/api/push/subscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: name, subscription: sub.toJSON() })
                });
            }).then(function(r) { return r.json(); }).then(function(d) {
                if (d.ok) {
                    sessionStorage.setItem('cgv_push_subscribed', 'true');
                    updatePushBtn(name);
                }
            }).catch(function(e) { console.error('Push 구독 실패:', e); });
        }

        function requestPushPermission(name) {
            if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
                alert('이 브라우저는 푸시 알림을 지원하지 않습니다.'); return;
            }
            var perm = Notification.permission;
            if (perm === 'denied') { showPushDeniedGuide(); return; }
            if (perm === 'granted') { doSubscribe(name); return; }
            Notification.requestPermission().then(function(p) {
                if (p === 'granted') doSubscribe(name);
                else updatePushBtn(name);
            });
        }

        function showPushDeniedGuide() {
            // 다시 한번 현재 권한 체크 (OS 설정에서 바꿨을 수도 있음)
            if (Notification.permission !== 'denied') {
                updatePushBtn(getPushName());
                return;
            }
            var ua = navigator.userAgent.toLowerCase();
            var msg;
            if (/android/.test(ua)) {
                msg = '알림이 Chrome에서 차단되어 있습니다.\\n\\n[Chrome 사이트 설정에서 해제]\\n① Chrome 앱 실행 (앱이 아닌 브라우저)\\n② 주소창에 앱 주소 입력 후 접속\\n③ 주소창 왼쪽 🔒 아이콘 클릭\\n④ 알림 → 허용\\n⑤ 앱 새로고침\\n\\n또는:\\n설정 → 앱 → Chrome → 권한 → 알림 → 허용';
            } else if (/iphone|ipad/.test(ua)) {
                msg = '알림이 차단되어 있습니다.\\n\\n[설정 방법]\\n설정 → Safari → 고급 → 웹사이트 데이터에서\\n이 사이트의 알림을 허용 후 새로고침';
            } else {
                msg = '알림이 차단되어 있습니다.\\n\\n주소창 🔒 아이콘 → 알림 → 허용\\n후 페이지를 새로고침하세요.';
            }
            alert(msg);
        }

        function updatePushBtn(name) {
            var btn = document.getElementById('push-subscribe-btn');
            if (!btn) return;
            if (!('Notification' in window)) { btn.style.display = 'none'; return; }
            var n = name || getPushName();
            var perm = Notification.permission;
            var subscribed = sessionStorage.getItem('cgv_push_subscribed') === 'true';
            if (perm === 'granted') {
                if (!subscribed) {
                    // 권한은 있지만 구독 미등록 → 자동 구독
                    doSubscribe(n);
                    btn.innerHTML = '<span class="text-blue-500 font-black text-xs">🔔 등록중..</span>';
                    btn.onclick = null;
                } else {
                    btn.innerHTML = '<span class="text-green-600 font-black text-xs">🔔 알림 ON</span>';
                    btn.onclick = null;
                    btn.style.cursor = 'default';
                }
            } else if (perm === 'denied') {
                btn.innerHTML = '<span class="font-black text-xs text-red-500">🔕 차단됨</span>';
                btn.onclick = function() { showPushDeniedGuide(); };
                btn.style.cursor = 'pointer';
            } else {
                btn.innerHTML = '<span class="font-black text-xs text-slate-500">🔕 알림 받기</span>';
                btn.onclick = function() { requestPushPermission(n); };
                btn.style.cursor = 'pointer';
            }
        }

        // 앱 복귀 시 자동 감지 (설정 변경 후 돌아올 때)
        document.addEventListener('visibilitychange', function() {
            if (document.visibilityState !== 'visible') return;
            var n = getPushName();
            if (!n) return;
            var perm = Notification.permission;
            var subscribed = sessionStorage.getItem('cgv_push_subscribed') === 'true';
            if (perm === 'granted' && !subscribed) {
                doSubscribe(n);
            } else {
                updatePushBtn(n);
            }
        });

        function testPushNotification(name) {
            var n = name || getPushName();
            fetch('/api/push/test', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: n })
            }).then(function(r) { return r.json(); }).then(function(d) {
                if (d.ok) alert('테스트 알림을 발송했습니다!');
                else alert('실패: ' + (d.error || '먼저 🔕 알림 받기를 눌러 구독해주세요.'));
            });
        }

        `;

c = c.substring(0, si) + newPushBlock + c.substring(ei);
fs.writeFileSync(appJsPath, c, 'utf8');
console.log('push v3 교체: OK');
try { new Function(c); console.log('문법 OK'); } catch(e) { console.log('문법 에러:', e.message); }
