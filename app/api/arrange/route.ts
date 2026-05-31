import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/arrange?weekKey=2026-06-02
 *
 * 편성(Step 2) 화면에 필요한 데이터를 한 번에 반환합니다.
 *  - staff:        활성 미소지기 목록 (이름/포지션/근로시간/계약일수)
 *  - availability: 취합 신청 맵 { 이름: { 요일(0~6): ['d'|'m'|'n', ...] } }
 *  - submitted:    이번 주차에 신청을 제출한 이름 목록
 *  - assignments:  현재 편성 배정 목록 (Supabase schedule_assignments)
 *
 * 미제출자 = submitted 에 없는 활성 미소지기 → 편성 시 "전체 가능"으로 간주(프론트에서 처리)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const weekKey = searchParams.get('weekKey');
    if (!weekKey) {
      return NextResponse.json({ error: 'weekKey 필수' }, { status: 400 });
    }

    // ── 1) 활성 미소지기 ──────────────────────────────────────
    const { data: misoRows, error: misoErr } = await supabaseAdmin
      .from('misojigi')
      .select('name, pos, hours, contract_days, active')
      .eq('active', true)
      .order('name');
    if (misoErr) return NextResponse.json({ error: misoErr.message }, { status: 500 });

    const staff = (misoRows ?? []).map((r: Record<string, any>) => ({
      name: String(r.name).trim(),
      pos: r.pos ? String(r.pos).split(',').map((p: string) => p.trim()).filter(Boolean) : [],
      hours: String(r.hours ?? '5.5'),
      contractDays: Number(r.contract_days ?? 5),
    }));

    // ── 2) 취합 신청 ──────────────────────────────────────────
    const { data: availRows, error: availErr } = await supabaseAdmin
      .from('availability')
      .select('name, day_of_week, shift_codes')
      .eq('week_key', weekKey);
    if (availErr) return NextResponse.json({ error: availErr.message }, { status: 500 });

    const availability: Record<string, Record<number, string[]>> = {};
    const submittedSet = new Set<string>();
    (availRows ?? []).forEach((r: Record<string, any>) => {
      const nm = String(r.name).trim();
      submittedSet.add(nm);
      if (!availability[nm]) availability[nm] = {};
      availability[nm][Number(r.day_of_week)] = Array.isArray(r.shift_codes) ? r.shift_codes : [];
    });

    // ── 3) 현재 편성 배정 ─────────────────────────────────────
    const { data: asgRows, error: asgErr } = await supabaseAdmin
      .from('schedule_assignments')
      .select('date, day_of_week, shift_code, position, name, hours')
      .eq('week_key', weekKey);
    if (asgErr) return NextResponse.json({ error: asgErr.message }, { status: 500 });

    const assignments = (asgRows ?? []).map((r: Record<string, any>) => ({
      date: r.date,
      dayOfWeek: Number(r.day_of_week),
      shiftCode: r.shift_code,
      position: r.position,
      name: String(r.name).trim(),
      hours: String(r.hours ?? '5.5'),
    }));

    return NextResponse.json({
      weekKey,
      staff,
      availability,
      submitted: Array.from(submittedSet),
      assignments,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
