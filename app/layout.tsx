import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
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
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css"
        />
        <link rel="stylesheet" href="/cgv.css" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <Script src="https://cdn.tailwindcss.com" strategy="beforeInteractive" />
        <Script src="/gas-shim.js" strategy="beforeInteractive" />
      </head>
      <body>
        {children}
        <Script src="/cgv-app.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
