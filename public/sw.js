// Service Worker — CGV동두천 맞교대 PWA
// ⚠️ CACHE_VER 를 올리면 모든 캐시 초기화 → 모바일 강제 업데이트
const CACHE_VER = 'cgv-v7';

self.addEventListener('install', (e) => {
  self.skipWaiting(); // 대기 없이 즉시 활성화
});

self.addEventListener('activate', (e) => {
  // 이전 버전 캐시 전체 삭제
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VER).map(k => caches.delete(k))))
      .then(() => clients.claim())
  );
});

// ── fetch 핸들러 ──
self.addEventListener('fetch', (e) => {
  const url = e.request.url;

  // ① API / 외부 서비스는 SW 개입 금지 → 브라우저가 직접 처리
  //    (Supabase, Next.js API Routes, GAS, 푸시 서버 등)
  const isApi = url.includes('/api/')
    || url.includes('supabase.co')
    || url.includes('script.google.com')
    || url.includes('googleapis.com')
    || url.includes('fcm.googleapis')
    || e.request.method !== 'GET';   // POST/PATCH/DELETE 는 항상 통과
  if (isApi) return;

  // ② HTML / JS / CSS → 네트워크 우선, 실패 시 캐시 폴백
  const isAsset = url.includes('.js') || url.includes('.css') || url.includes('.html');
  const isNavigate = e.request.mode === 'navigate';
  if (isNavigate || isAsset) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // ③ 이미지·폰트 등 정적 자산 → 캐시 우선, 없으면 네트워크
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).catch(() => new Response('', { status: 408, statusText: 'Network Error' }));
    })
  );
});

// 푸시 알림 수신
self.addEventListener('push', (e) => {
  if (!e.data) return;
  const data = e.data.json();
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      vibrate: [200, 100, 200],
      data: { url: '/' }
    })
  );
});

// 알림 클릭 시 앱 열기
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});
