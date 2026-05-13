import { NextResponse } from 'next/server';

export async function GET() {
  const GAS_URL = process.env.GAS_URL;

  // 1. 환경변수 체크
  if (!GAS_URL) {
    return NextResponse.json({ step: 1, error: 'GAS_URL 환경변수가 비어있음' });
  }

  // 2. URL 일부 표시 (보안: 끝부분만)
  const urlPreview = GAS_URL.slice(-30);

  // 3. GAS에 직접 호출
  try {
    const res = await fetch(GAS_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'getContractWeeks', params: [] }),
    });
    const text = await res.text();
    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch {}

    return NextResponse.json({
      step: 'OK',
      gasUrlTail: '...' + urlPreview,
      httpStatus: res.status,
      gasResponse: parsed || text.slice(0, 500),
    });
  } catch (e: any) {
    return NextResponse.json({
      step: 'FETCH_ERROR',
      gasUrlTail: '...' + urlPreview,
      error: e.message,
    });
  }
}
