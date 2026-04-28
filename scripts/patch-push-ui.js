/**
 * cgv-app.js에 push 알림 관련 UI/로직 추가
 * 1. authSuccess 후 알림 받기 버튼 표시
 * 2. 관리자 탭에 테스트 버튼 추가
 */
const fs = require('fs');
const path = require('path');
const appJsPath = path.join(__dirname, '..', 'public', 'cgv-app.js');
let c = fs.readFileSync(appJsPath, 'utf8');

// ── 1. push 알림 함수들 추가 (buildAuthNameGrid 앞에) ──
const insertBefore = 'function buildAuthNameGrid()';
const pushFunctions = `// ── 푸시 알림 ──
        var VAPID_PUBLIC_KEY = 'BP1y9f4tcZUHXhoWhMxiiy6Gu4Yft8O6LTW4zeJs5KBVKTaVVS7pj-i9z-sbQQrluG5MyQJXPTfSz7i_BPeTIEs';

        function urlBase64ToUint8Array(base64String) {
            var padding = '='.repeat((4 - base64String.length % 4) % 4);
            var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
            var rawData = window.atob(base64);
            var outputArray = new Uint8Array(rawData.length);
            for (var i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
            return outputArray;
        }

        function requestPushPermission(name) {
            if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
                alert('이 브라우저는 푸시 알림을 지원하지 않습니다.');
                return;
            }
            Notification.requestPermission().then(function(permission) {
                if (permission !== 'granted') {
                    alert('알림 권한이 거부되었습니다.');
                    return;
                }
                navigator.serviceWorker.ready.then(function(reg) {
                    return reg.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
                    });
                }).then(function(sub) {
                    fetch('/api/push/subscribe', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: name, subscription: sub.toJSON() })
                    }).then(function(r) { return r.json(); }).then(function(d) {
                        if (d.ok) {
                            sessionStorage.setItem('cgv_push_subscribed', 'true');
                            updatePushBtn(name);
                            alert('알림이 등록되었습니다!');
                        }
                    });
                }).catch(function(e) {
                    console.error('Push 구독 실패:', e);
                    alert('알림 등록 실패: ' + e.message);
                });
            });
        }

        function updatePushBtn(name) {
            var btn = document.getElementById('push-subscribe-btn');
            if (!btn) return;
            var subscribed = sessionStorage.getItem('cgv_push_subscribed') === 'true';
            btn.innerHTML = subscribed
                ? '<span class="text-green-600 font-black text-xs">🔔 알림 ON</span>'
                : '<span class="font-black text-xs text-slate-500">🔕 알림 받기</span>';
            btn.onclick = subscribed ? null : function() { requestPushPermission(name); };
        }

        function testPushNotification(name) {
            fetch('/api/push/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name })
            }).then(function(r) { return r.json(); }).then(function(d) {
                if (d.ok) alert('테스트 알림을 발송했습니다! 잠시 후 알림이 옵니다.');
                else alert('실패: ' + d.error);
            });
        }

        `;

if (c.indexOf(insertBefore) > -1 && c.indexOf('requestPushPermission') < 0) {
    c = c.replace(insertBefore, pushFunctions + insertBefore);
    console.log('1. push 함수 추가: OK');
} else if (c.indexOf('requestPushPermission') > -1) {
    console.log('1. push 함수: 이미 있음');
} else {
    console.log('1. push 함수: 패턴 없음');
}

// ── 2. authSuccess: 로그인 후 알림 버튼 업데이트 ──
const oldAuthSuccess = `            } else {
                sessionStorage.setItem('cgv_currentUser', authSelectedName);
                sessionStorage.setItem('cgv_locked_user', authSelectedName); // PIN 로그인 이름 고정
                selectUser(authSelectedName);
            }
            fetchData();`;

const newAuthSuccess = `            } else {
                sessionStorage.setItem('cgv_currentUser', authSelectedName);
                sessionStorage.setItem('cgv_locked_user', authSelectedName); // PIN 로그인 이름 고정
                selectUser(authSelectedName);
            }
            fetchData();
            // 알림 버튼 상태 업데이트
            var loginName = sessionStorage.getItem('cgv_currentUser') || sessionStorage.getItem('cgv_admin_name');
            if (loginName) setTimeout(function(){ updatePushBtn(loginName); }, 300);`;

if (c.indexOf(oldAuthSuccess) > -1) {
    c = c.replace(oldAuthSuccess, newAuthSuccess);
    console.log('2. authSuccess push 버튼 업데이트: OK');
} else {
    console.log('2. authSuccess: 패턴 없음');
}

// ── 3. window.onload 세션 복원 시 push 버튼 복원 ──
const oldRestore = `                if (sessionStorage.getItem("cgv_admin") === "true") isAdmin = true;
                var saved = sessionStorage.getItem("cgv_currentUser");
                if (saved) selectUser(saved);
                fetchData();`;

const newRestore = `                if (sessionStorage.getItem("cgv_admin") === "true") isAdmin = true;
                var saved = sessionStorage.getItem("cgv_currentUser");
                if (saved) selectUser(saved);
                fetchData();
                var rName = sessionStorage.getItem('cgv_currentUser') || sessionStorage.getItem('cgv_admin_name');
                if (rName) setTimeout(function(){ updatePushBtn(rName); }, 300);`;

if (c.indexOf(oldRestore) > -1) {
    c = c.replace(oldRestore, newRestore);
    console.log('3. 세션 복원 push 버튼: OK');
} else {
    console.log('3. 세션 복원: 패턴 없음');
}

fs.writeFileSync(appJsPath, c, 'utf8');

// 문법 검사
try { new Function(c); console.log('\n문법 OK'); } catch(e) { console.log('\n문법 에러:', e.message); }
