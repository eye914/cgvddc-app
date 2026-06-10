import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// 관리자(admins) 명단 관리 — 이름 + 본인 PIN. 관리자 로그인 시 PIN으로 매칭됩니다.

// GET: 관리자 목록 (PIN은 노출하지 않음)
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('admins')
      .select('name, active')
      .order('name');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ admins: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST: 관리자 추가/수정 ({ name, pin })
export async function POST(req: NextRequest) {
  try {
    const { name, pin } = await req.json();
    const nm = String(name ?? '').trim();
    const pn = String(pin ?? '').trim();
    if (!nm) return NextResponse.json({ error: '이름 필수' }, { status: 400 });
    if (!/^\d{4,6}$/.test(pn)) return NextResponse.json({ error: 'PIN은 숫자 4~6자리' }, { status: 400 });

    const { data: existing } = await supabaseAdmin
      .from('admins')
      .select('name')
      .eq('name', nm)
      .maybeSingle();

    if (existing) {
      const { error } = await supabaseAdmin
        .from('admins')
        .update({ pin: pn, active: true })
        .eq('name', nm);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      const { error } = await supabaseAdmin
        .from('admins')
        .insert({ name: nm, pin: pn, active: true });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE: 관리자 삭제 ({ name })
export async function DELETE(req: NextRequest) {
  try {
    const { name } = await req.json();
    const nm = String(name ?? '').trim();
    if (!nm) return NextResponse.json({ error: '이름 필수' }, { status: 400 });
    const { error } = await supabaseAdmin.from('admins').delete().eq('name', nm);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
