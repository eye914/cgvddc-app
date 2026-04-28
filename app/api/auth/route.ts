import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { name, pin, role } = await req.json();

    // ── 관리자 PIN (admins 테이블) ──
    if (role === 'admin') {
      const { data, error } = await supabaseAdmin
        .from('admins')
        .select('name, pin')
        .eq('pin', pin)
        .eq('active', true)
        .maybeSingle();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!data) return NextResponse.json({ error: '관리자 PIN이 올바르지 않습니다.' }, { status: 401 });

      return NextResponse.json({ ok: true, role: 'admin', name: data.name });
    }

    // ── 미소지기 PIN (5자리) ──
    if (!name) return NextResponse.json({ error: '이름을 선택해주세요.' }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from('misojigi')
      .select('name, pin')
      .eq('name', name)
      .eq('active', true)
      .single();

    if (error || !data) return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });

    const storedPin = data.pin || '00000';
    if (pin !== storedPin) return NextResponse.json({ error: 'PIN이 올바르지 않습니다.' }, { status: 401 });

    return NextResponse.json({ ok: true, role: 'staff', name: data.name });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
