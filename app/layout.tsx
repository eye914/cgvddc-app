import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CGV동두천 미소지기 교대 신청',
  description: 'CGV동두천 미소지기 근무 교대 신청 시스템',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'CGV교대',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#e71a0f',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css"
        />
        <link rel="stylesheet" href="/cgv.css?v=20250430" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        {/* Tailwind CDN - head에서 먼저 로드 */}
        <script src="https://cdn.tailwindcss.com" async={false} />
        {/* GAS shim - google.script.run → fetch */}
        <script src="/gas-shim.js?v=20250430" async={false} />
        {/* 앱 메인 JS - defer: DOM 파싱 완료 후, window.onload 이전에 실행 */}
        <script src="/cgv-app.js?v=20250430" defer={true} />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
