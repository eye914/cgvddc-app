import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

async function callGAS(action: string, params: any[]) {
  const GAS_URL = process.env.GAS_URL;
  if (!GAS_URL) return;
  try { await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action, params }) }); } catch (_) {}
}

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin.from('attendance').select('*');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const result: Record<string, any> = {};
    (data ?? []).forEach((row: Record<string, any>) => {
      if (!result[row.name]) result[row.name] = {};
      result[row.name][row.week] = {
        late: row.late,
        absent: row.absent,
        miss: row.miss ?? 0,
        logs: row.logs ?? [],
      };
    });
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, week, late, absent, miss, logs } = await req.json();
    const key = `${name}_${week}`;
    // ★ miss 컬럼이 없는 DB에서도 지각·결근 저장은 반드시 성공해야 한다(매일 쓰는 핵심 기능).
    //   컬럼 미존재로 실패하면 miss 를 빼고 한 번 더 시도한다.
    let { error } = await supabaseAdmin
      .from('attendance')
      .upsert({ key, name, week, late, absent, miss: miss ?? 0, logs }, { onConflict: 'key' });
    if (error) {
      console.warn('[attendance] miss 포함 저장 실패 → miss 제외하고 재시도:', error.message);
      const retry = await supabaseAdmin
        .from('attendance')
        .upsert({ key, name, week, late, absent, logs }, { onConflict: 'key' });
      error = retry.error;
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // GAS 출결DB 동기화
    await callGAS('saveAttendanceToDB', [name, week, late, absent, logs]);
    return NextResponse.json('성공');
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
