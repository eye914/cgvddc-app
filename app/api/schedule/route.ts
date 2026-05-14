import { NextRequest, NextResponse } from 'next/server';

async function callGAS(action: string, params: any[] = []) {
  const GAS_URL = process.env.GAS_URL;
  if (!GAS_URL) throw new Error('GAS_URL 미설정');
  const r = await fetch(GAS_URL, {
    method: 'POST',
    body: JSON.stringify({ action, params }),
  });
  const txt = await r.text();
  let parsed: any;
  try { parsed = JSON.parse(txt); } catch { throw new Error('GAS 응답 파싱 실패'); }
  if (!parsed?.success) throw new Error(parsed?.error || 'GAS 실패');
  return parsed.result;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('mode');

    if (mode === 'weeks') {
      const weeks = await callGAS('getScheduleWeeks', []);
      return NextResponse.json({ weeks });
    }
    if (mode === 'findWeek') {
      const date = searchParams.get('date');
      if (!date) return NextResponse.json({ error: 'date 필수' }, { status: 400 });
      const weekKey = await callGAS('findWeekByDate', [date]);
      return NextResponse.json({ weekKey });
    }
    if (mode === 'week') {
      const weekKey = searchParams.get('weekKey');
      if (!weekKey) return NextResponse.json({ error: 'weekKey 필수' }, { status: 400 });
      const schedule = await callGAS('getScheduleByWeek', [weekKey]);
      return NextResponse.json({ schedule });
    }
    if (mode === 'debug') {
      const weekKey = searchParams.get('weekKey');
      if (!weekKey) return NextResponse.json({ error: 'weekKey 필수' }, { status: 400 });
      const dump = await callGAS('debugScheduleSheet', [weekKey]);
      return NextResponse.json({ dump });
    }
    return NextResponse.json({ error: 'mode 필수 (weeks|findWeek|week)' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
