import { NextResponse } from 'next/server';
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
