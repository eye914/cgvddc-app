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
    const { name, week, late, absent, logs } = await req.json();
    const key = `${name}_${week}`;
    const { error } = await supabaseAdmin
      .from('attendance')
      .upsert({ key, name, week, late, absent, logs }, { onConflict: 'key' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // GAS 출결DB 동기화
    await callGAS('saveAttendanceToDB', [name, week, late, absent, logs]);
    return NextResponse.json('성공');
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
