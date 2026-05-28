import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/availability
 *  ?weekKey=2026-05-26               → 해당 주차 전체 신청 목록 (관리자용)
 *  ?weekKey=2026-05-26&name=홍성현   → 특정 미소지기 신청 내역
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const weekKey = searchParams.get('weekKey');
    const name    = searchParams.get('name');

    if (!weekKey) {
      return NextResponse.json({ error: 'weekKey 필수' }, { status: 400 });
    }

    let query = supabaseAdmin
      .from('availability')
      .select('*')
      .eq('week_key', weekKey)
      .order('day_of_week');

    if (name) query = query.eq('name', name);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/**
 * POST /api/availability
 * 미소지기 가용 신청 저장 (upsert)
 *
 * Body: {
 *   name: string
 *   weekKey: string         // '2026-05-26'
 *   days: Array<{
 *     dayOfWeek: number     // 0=월 ~ 6=일
 *     shiftCodes: string[]  // ['M3','N1'] — 빈 배열이면 해당 요일 신청 없음
 *   }>
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, weekKey, days } = body as {
      name: string;
      weekKey: string;
      days: { dayOfWeek: number; shiftCodes: string[] }[];
    };

    if (!name || !weekKey || !Array.isArray(days)) {
      return NextResponse.json({ error: 'name, weekKey, days 필수' }, { status: 400 });
    }

    // 빈 shiftCodes인 요일 = 신청 없음 → 삭제 대상
    const toUpsert = days
      .filter((d) => d.shiftCodes.length > 0)
      .map((d) => ({
        name,
        week_key:     weekKey,
        day_of_week:  d.dayOfWeek,
        shift_codes:  d.shiftCodes,
      }));

    const toDelete = days
      .filter((d) => d.shiftCodes.length === 0)
      .map((d) => d.dayOfWeek);

    // upsert (이미 있으면 shift_codes 갱신)
    if (toUpsert.length > 0) {
      const { error } = await supabaseAdmin
        .from('availability')
        .upsert(toUpsert, { onConflict: 'name,week_key,day_of_week' });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 빈 요일 삭제
    if (toDelete.length > 0) {
      const { error } = await supabaseAdmin
        .from('availability')
        .delete()
        .eq('name', name)
        .eq('week_key', weekKey)
        .in('day_of_week', toDelete);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, upserted: toUpsert.length, deleted: toDelete.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/**
 * DELETE /api/availability
 * 신청 취소
 *
 * Body: {
 *   name: string
 *   weekKey: string
 *   dayOfWeek?: number   // 생략하면 해당 주차 전체 삭제
 * }
 */
export async function DELETE(req: NextRequest) {
  try {
    const { name, weekKey, dayOfWeek } = await req.json();

    if (!name || !weekKey) {
      return NextResponse.json({ error: 'name, weekKey 필수' }, { status: 400 });
    }

    let query = supabaseAdmin
      .from('availability')
      .delete()
      .eq('name', name)
      .eq('week_key', weekKey);

    if (dayOfWeek !== undefined) {
      query = query.eq('day_of_week', dayOfWeek);
    }

    const { error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
