import type { Metadata, Viewport } from 'next';
import './globals.css';
import fs from 'fs';
import path from 'path';

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

const publicDir = path.join(process.cwd(), 'public');
const cssContent    = fs.readFileSync(path.join(publicDir, 'cgv.css'),     'utf8');
const shimContent   = fs.readFileSync(path.join(publicDir, 'gas-shim.js'), 'utf8');
const appJsContent  = fs.readFileSync(path.join(publicDir, 'cgv-app.js'),  'utf8');

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css"
        />
        {/* CSS 인라인 주입 — 캐시 완전 우회 */}
        <style dangerouslySetInnerHTML={{ __html: cssContent }} />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        {/* Tailwind CDN */}
        <script src="https://cdn.tailwindcss.com" async={false} />
        {/* GAS shim 인라인 */}
        <script dangerouslySetInnerHTML={{ __html: shimContent }} />
        {/* 앱 메인 JS 인라인 */}
        <script dangerouslySetInnerHTML={{ __html: appJsContent }} />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
