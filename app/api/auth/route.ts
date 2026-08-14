import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { signSession, verifySession } from '@/lib/session';

const REMEMBER_TTL = 60 * 60 * 24 * 30;   // PIN 기억하기: 30일

// GET: 저장된 토큰 검증 → 자동 로그인용. 유효하면 세션 정보 반환.
export async function GET(req: NextRequest) {
  const h = req.headers.get('authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  const s = verifySession(token);
  if (!s) return NextResponse.json({ ok: false, error: '만료되었거나 유효하지 않은 로그인입니다.' }, { status: 401 });

  // 계정이 비활성화/삭제됐으면 자동 로그인 거부
  if (s.role === 'admin') {
    const { data } = await supabaseAdmin.from('admins').select('name').eq('name', s.name).eq('active', true).maybeSingle();
    if (!data) return NextResponse.json({ ok: false, error: '사용할 수 없는 계정입니다.' }, { status: 401 });
  } else {
    const { data } = await supabaseAdmin.from('misojigi').select('name').eq('name', s.name).eq('active', true).maybeSingle();
    if (!data) return NextResponse.json({ ok: false, error: '사용할 수 없는 계정입니다.' }, { status: 401 });
  }
  return NextResponse.json({ ok: true, role: s.role, name: s.name, pinDefault: !!s.pd });
}

export async function POST(req: NextRequest) {
  try {
    const { name, pin, role, remember } = await req.json();
    const ttl = remember ? REMEMBER_TTL : undefined;   // 기억하기면 30일, 아니면 기본 12시간

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

      const token = signSession({ name: data.name, role: 'admin' }, ttl);
      return NextResponse.json({ ok: true, role: 'admin', name: data.name, token });
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

    const pinDefault = storedPin === '00000';
    const token = signSession({ name: data.name, role: 'staff', pd: pinDefault }, ttl);
    return NextResponse.json({ ok: true, role: 'staff', name: data.name, token, pinDefault });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
