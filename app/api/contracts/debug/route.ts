import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const GAS_URL = process.env.GAS_URL;
  if (!GAS_URL) {
    return NextResponse.json({ step: 1, error: 'GAS_URL 환경변수가 비어있음' });
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') || 'getContractWeeks';
  const paramsRaw = searchParams.get('params');
  let params: any[] = [];
  if (paramsRaw) {
    try { params = JSON.parse(paramsRaw); } catch { params = [paramsRaw]; }
  }

  const urlPreview = GAS_URL.slice(-30);
  try {
    const res = await fetch(GAS_URL, {
      method: 'POST',
      body: JSON.stringify({ action, params }),
    });
    const text = await res.text();
    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch {}
    return NextResponse.json({
      step: 'OK',
      action,
      gasUrlTail: '...' + urlPreview,
      httpStatus: res.status,
      gasResponse: parsed || text.slice(0, 2000),
    });
  } catch (e: any) {
    return NextResponse.json({
      step: 'FETCH_ERROR',
      gasUrlTail: '...' + urlPreview,
      error: e.message,
    });
  }
}
