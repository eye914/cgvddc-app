import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

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
    return NextResponse.json('성공');
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
