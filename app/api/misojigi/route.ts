import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// GET: 활성 미소지기 목록 (앱용)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const all = searchParams.get('all') === '1'; // 관리자: 비활성 포함

    const query = supabaseAdmin.from('misojigi').select('*').order('name');
    if (!all) query.eq('active', true);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const result = (data ?? []).map((row: Record<string, any>) => ({
      name: row.name,
      pos: row.pos ? row.pos.split(',').map((p: string) => p.trim()) : [],
      hours: row.hours ?? 5.5,
      active: row.active,
      pin: row.pin ?? '00000',
    }));

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST: 새 미소지기 추가
export async function POST(req: NextRequest) {
  try {
    const { name, pos, hours, employeeId } = await req.json();
    if (!name) return NextResponse.json({ error: '이름 필요' }, { status: 400 });

    const { error } = await supabaseAdmin.from('misojigi').insert({
      name: name.trim(),
      pos: Array.isArray(pos) ? pos.join(',') : (pos || ''),
      hours: hours ?? 5.5,
      active: true,
      pin: '00000',
      employee_id: employeeId ? employeeId.trim() : null,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PATCH: 미소지기 정보 수정 (포지션, PIN, active)
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, ...updates } = body;
    if (!name) return NextResponse.json({ error: '이름 필요' }, { status: 400 });

    // PIN 유효성 검사
    if (updates.pin !== undefined && !/^\d{5}$/.test(updates.pin)) {
      return NextResponse.json({ error: 'PIN은 숫자 5자리' }, { status: 400 });
    }

    // pos 배열 → 문자열 변환
    if (Array.isArray(updates.pos)) {
      updates.pos = updates.pos.join(',');
    }

    const { error } = await supabaseAdmin.from('misojigi').update(updates).eq('name', name);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE: 미소지기 비활성화(soft) 또는 완전삭제(hard)
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, hard } = body;
    if (!name) return NextResponse.json({ error: '이름 필요' }, { status: 400 });

    if (hard) {
      // 완전 삭제 (비활성 상태인 경우만)
      const { data: existing } = await supabaseAdmin
        .from('misojigi')
        .select('active')
        .eq('name', name)
        .single();
      if (!existing) return NextResponse.json({ error: '미소지기를 찾을 수 없습니다' }, { status: 404 });
      if (existing.active) return NextResponse.json({ error: '활성 미소지기는 삭제할 수 없습니다. 먼저 퇴사 처리하세요.' }, { status: 400 });

      const { error } = await supabaseAdmin
        .from('misojigi')
        .delete()
        .eq('name', name);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      // 소프트 삭제 (비활성화)
      const { error } = await supabaseAdmin
        .from('misojigi')
        .update({ active: false })
        .eq('name', name);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
