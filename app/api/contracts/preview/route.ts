import { NextRequest } from 'next/server';

// Google Docs 를 PDF로 변환해 스트리밍 — 모바일 브라우저 PDF 뷰어가 핀치-줌 지원
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const docId = searchParams.get('docId');
  if (!docId) return new Response('docId 필요', { status: 400 });

  // 안전: docId 형식만 통과
  if (!/^[a-zA-Z0-9_-]+$/.test(docId)) return new Response('잘못된 docId', { status: 400 });

  try {
    const url = `https://docs.google.com/document/d/${docId}/export?format=pdf`;
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) return new Response('PDF 변환 실패: ' + res.status, { status: 502 });
    const buf = await res.arrayBuffer();
    return new Response(buf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="contract.pdf"',
        'Cache-Control': 'private, max-age=600',
      },
    });
  } catch (e: any) {
    return new Response('오류: ' + e.message, { status: 500 });
  }
}
