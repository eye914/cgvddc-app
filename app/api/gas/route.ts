import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';

export const maxDuration = 60; // PDF 변환·드라이브 저장이 느릴 수 있어 여유 확보

// 관리자 전용 GAS 프록시 (허용된 action만). google.script.run 미등록 메서드를 안전하게 호출하기 위한 경로.
const ALLOWED = new Set(['saveFormsPdfToDrive', 'saveFormPdfBase64']);

export async function POST(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  const GAS_URL = process.env.GAS_URL;
  if (!GAS_URL) return NextResponse.json({ error: 'GAS_URL 미설정' }, { status: 500 });
  try {
    const { action, params } = await req.json();
    if (!ALLOWED.has(action)) return NextResponse.json({ error: '허용되지 않은 action' }, { status: 400 });
    const r = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action, params: params || [] }) });
    const txt = await r.text();
    let parsed: any;
    try { parsed = JSON.parse(txt); } catch { return NextResponse.json({ error: 'GAS 응답 파싱 실패', raw: txt.substring(0, 200) }, { status: 502 }); }
    if (!parsed?.success) return NextResponse.json({ error: parsed?.error || 'GAS 실패' }, { status: 502 });
    return NextResponse.json(parsed.result ?? {});
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
