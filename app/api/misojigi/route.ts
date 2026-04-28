import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    // 환경변수 확인
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return NextResponse.json({ error: 'SUPABASE_URL 환경변수 없음' }, { status: 500 });
    }
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'supabaseAdmin 초기화 실패' }, { status: 500 });
    }

    const { data, error } = await supabaseAdmin
      .from('misojigi')
      .select('*')
      .eq('active', true)
      .order('name');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const result = (data ?? []).map((row: Record<string, any>) => ({
      name: row.name,
      pos: row.pos ? row.pos.split(',').map((p: string) => p.trim()) : [],
      hours: row.hours,
    }));

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// 관리자: 미소지기 PIN 변경
export async function PATCH(req: NextRequest) {
  try {
    const { name, pin } = await req.json();
    if (!name || !pin) return NextResponse.json({ error: '이름과 PIN 필요' }, { status: 400 });
    if (!/^\d{5}$/.test(pin)) return NextResponse.json({ error: 'PIN은 숫자 5자리' }, { status: 400 });

    const { error } = await supabaseAdmin
      .from('misojigi')
      .update({ pin })
      .eq('name', name);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
