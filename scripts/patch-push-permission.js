/**
 * push 권한 거부/재허용 처리 개선
 */
const fs = require('fs');
const path = require('path');
const appJsPath = path.join(__dirname, '..', 'public', 'cgv-app.js');
let c = fs.readFileSync(appJsPath, 'utf8');

// ── 기존 push 함수 블록 전체 교체 ──
const startMarker = '// ── 푸시 알림 ──';
const endMarker = '        function buildAuthNameGrid()';

const si = c.indexOf(startMarker);
const ei = c.indexOf(endMarker);

if (si < 0 || ei < 0) {
    console.log('마커 없음:', si, ei);
    process.exit(1);
}

const newPushBlock = `// ── 푸시 알림 ──
        var VAPID_PUBLIC_KEY = 'BP1y9f4tcZUHXhoWhMxiiy6Gu4Yft8O6LTW4zeJs5KBVKTaVVS7pj-i9z-sbQQrluG5MyQJXPTfSz7i_BPeTIEs';
        var _pushName = '';

        function urlBase64ToUint8Array(base64String) {
            var padding = '='.repeat((4 - base64String.length % 4) % 4);
            var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
            var rawData = window.atob(base64);
            var outputArray = new Uint8Array(rawData.length);
            for (var i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
            return outputArray;
        }

        function doSubscribe(name) {
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
            }).catch(function(e) {
                console.error('Push 구독 실패:', e);
            });
        }

        function requestPushPermission(name) {
            if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
                alert('이 브라우저는 푸시 알림을 지원하지 않습니다.');
                return;
            }
            var perm = Notification.permission;
            if (perm === 'denied') {
                showPushDeniedGuide();
                return;
            }
            if (perm === 'granted') {
                doSubscribe(name);
                return;
            }
            Notification.requestPermission().then(function(permission) {
                if (permission === 'granted') {
                    doSubscribe(name);
                } else {
                    updatePushBtn(name);
                }
            });
        }

        function showPushDeniedGuide() {
            var msg = '알림이 차단되어 있습니다.\\n\\n';
            var ua = navigator.userAgent.toLowerCase();
            if (/android/.test(ua)) {
                msg += '[Android 설정 방법]\\n① 이 앱(Chrome) 길게 누르기 → 앱 정보\\n② 알림 → 허용\\n③ 앱으로 돌아오면 자동 감지됩니다.';
            } else if (/iphone|ipad/.test(ua)) {
                msg += '[iPhone 설정 방법]\\n① 설정 → Safari → 알림 → CGV교대 → 허용\\n② 앱으로 돌아오면 자동 감지됩니다.';
            } else {
                msg += '[Chrome 설정 방법]\\n① 주소창 왼쪽 🔒 아이콘 클릭\\n② 알림 → 허용\\n③ 페이지 새로고침';
            }
            alert(msg);
        }

        function updatePushBtn(name) {
            if (name) _pushName = name;
            var btn = document.getElementById('push-subscribe-btn');
            if (!btn) return;
            if (!('Notification' in window)) {
                btn.style.display = 'none';
                return;
            }
            var perm = Notification.permission;
            var subscribed = sessionStorage.getItem('cgv_push_subscribed') === 'true';
            if (perm === 'granted' && subscribed) {
                btn.innerHTML = '<span class="text-green-600 font-black text-xs">🔔 알림 ON</span>';
                btn.onclick = null;
                btn.style.cursor = 'default';
            } else if (perm === 'denied') {
                btn.innerHTML = '<span class="font-black text-xs text-red-500">🔕 차단됨</span>';
                btn.onclick = function() { showPushDeniedGuide(); };
                btn.style.cursor = 'pointer';
            } else {
                btn.innerHTML = '<span class="font-black text-xs text-slate-500">🔕 알림 받기</span>';
                btn.onclick = function() { requestPushPermission(_pushName || name); };
                btn.style.cursor = 'pointer';
            }
        }

        // 설정 변경 후 앱으로 돌아올 때 자동 감지
        document.addEventListener('visibilitychange', function() {
            if (document.visibilityState !== 'visible' || !_pushName) return;
            var perm = Notification.permission;
            var subscribed = sessionStorage.getItem('cgv_push_subscribed') === 'true';
            if (perm === 'granted' && !subscribed) {
                // 방금 허용됨 → 자동 구독
                doSubscribe(_pushName);
            } else {
                updatePushBtn(_pushName);
            }
        });

        function testPushNotification(name) {
            fetch('/api/push/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name })
            }).then(function(r) { return r.json(); }).then(function(d) {
                if (d.ok) alert('테스트 알림을 발송했습니다!');
                else alert('실패: ' + (d.error || '구독 정보 없음. 먼저 알림 받기를 눌러주세요.'));
            });
        }

        `;

c = c.substring(0, si) + newPushBlock + c.substring(ei);

fs.writeFileSync(appJsPath, c, 'utf8');
console.log('push 권한 처리 교체: OK');

try { new Function(c); console.log('문법 OK'); } catch(e) { console.log('문법 에러:', e.message); }
