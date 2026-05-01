import type { Metadata, Viewport } from 'next';
import './globals.css';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

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
const cssContent = fs.readFileSync(path.join(publicDir, 'cgv.css'), 'utf8');

function fileVer(filename: string): string {
  const buf = fs.readFileSync(path.join(publicDir, filename));
  return crypto.createHash('md5').update(buf).digest('hex').slice(0, 8);
}
const shimVer = fileVer('gas-shim.js');
const appVer  = fileVer('cgv-app.js');

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css"
        />
        {/* CSS 인라인 주입 — 캐시 완전 우회 */}
        <style dangerouslySetInnerHTML={{ __html: cssContent }} />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        {/* Tailwind CDN — async로 페이지 블로킹 방지 */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="https://cdn.tailwindcss.com" async />
        {/* GAS shim + 앱 메인 JS — 외부 파일로 React 수화 간섭 완전 차단 */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src={`/gas-shim.js?v=${shimVer}`} />
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src={`/cgv-app.js?v=${appVer}`} />
      </head>
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
