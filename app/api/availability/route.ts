import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendPushToAllExcept } from '@/lib/push';

const SETTINGS_KEY = 'availability_open_week';
const CAP_KEY = 'weekend_capacity';

/** 주말 정원 조회 (기본: 토 12, 일 9) — 토=dayIdx5, 일=dayIdx6 */
async function getWeekendCaps(): Promise<{ sat: number; sun: number }> {
  const def = { sat: 12, sun: 9 };
  const { data } = await supabaseAdmin
    .from('app_settings')
    .select('value')
    .eq('key', CAP_KEY)
    .maybeSingle();
  const v = (data?.value as { sat?: number; sun?: number }) || {};
  return { sat: Number(v.sat ?? def.sat), sun: Number(v.sun ?? def.sun) };
}

/** app_settings에서 현재 열린 주차 조회 */
async function getOpenWeek(): Promise<{ weekKey: string | null; openedBy?: string; openedAt?: string }> {
  const { data } = await supabaseAdmin
    .from('app_settings')
    .select('value')
    .eq('key', SETTINGS_KEY)
    .single();
  if (!data?.value || data.value === null) return { weekKey: null };
  const v = data.value as { week_key?: string; opened_by?: string; opened_at?: string };
  return { weekKey: v.week_key ?? null, openedBy: v.opened_by, openedAt: v.opened_at };
}

/**
 * GET /api/availability
 *  ?mode=active                          → 현재 열린 주차 조회
 *  ?weekKey=2026-05-26                   → 해당 주차 전체 신청 목록 (관리자용)
 *  ?weekKey=2026-05-26&name=홍성현       → 특정 미소지기 신청 내역
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mode    = searchParams.get('mode');
    const weekKey = searchParams.get('weekKey');
    const name    = searchParams.get('name');

    // ── 현재 열린 주차 조회 ────────────────────────────────────
    if (mode === 'active') {
      const info = await getOpenWeek();
      const caps = await getWeekendCaps();
      const counts: Record<number, number> = {};
      if (info.weekKey) {
        const { data: avRows } = await supabaseAdmin
          .from('availability')
          .select('name, day_of_week')
          .eq('week_key', info.weekKey);
        const perDay: Record<number, Set<string>> = {};
        (avRows ?? []).forEach((r: any) => {
          (perDay[r.day_of_week] = perDay[r.day_of_week] || new Set()).add(r.name);
        });
        for (let d = 0; d < 7; d++) counts[d] = perDay[d] ? perDay[d].size : 0;
      }
      return NextResponse.json({
        weekKey:  info.weekKey,
        isOpen:   !!info.weekKey,
        openedBy: info.openedBy ?? null,
        openedAt: info.openedAt ?? null,
        counts,
        caps,
      });
    }

    // ── 신청 내역 조회 ─────────────────────────────────────────
    if (!weekKey) {
      return NextResponse.json({ error: 'weekKey 또는 mode=active 필수' }, { status: 400 });
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
 *
 * 관리자 주차 열기:
 *   { action: 'open', weekKey: '2026-06-02', openedBy: '관리자이름' }
 *   → app_settings 저장 + 전체 미소지기 푸시 알림
 *
 * 관리자 주차 마감:
 *   { action: 'close' }
 *   → app_settings 초기화
 *
 * 미소지기 신청 저장:
 *   { name, weekKey, days: [{dayOfWeek, shiftCodes}] }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // ── 관리자: 주차 열기 ──────────────────────────────────────
    if (action === 'open') {
      const { weekKey, openedBy, silent } = body as { weekKey: string; openedBy?: string; silent?: boolean };
      if (!weekKey) return NextResponse.json({ error: 'weekKey 필수' }, { status: 400 });

      const value = {
        week_key:  weekKey,
        opened_by: openedBy ?? '관리자',
        opened_at: new Date().toISOString(),
      };

      const { error } = await supabaseAdmin
        .from('app_settings')
        .upsert({ key: SETTINGS_KEY, value }, { onConflict: 'key' });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // 날짜 포맷 (YYYY-MM-DD → M/D 주간)
      const mon = new Date(weekKey + 'T00:00:00');
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      const label = `${mon.getMonth()+1}/${mon.getDate()}(월) ~ ${sun.getMonth()+1}/${sun.getDate()}(일)`;

      // 전체 미소지기에게 푸시 발송 (silent=true면 알림 생략 — 테스트용)
      if (!silent) {
        try {
          await sendPushToAllExcept(
            [],
            '📅 스케줄 신청이 열렸습니다!',
            `${label} 근무 가능 여부를 앱에서 신청해주세요.`,
          );
        } catch (_) { /* 푸시 실패해도 열기는 성공 처리 */ }
      }

      return NextResponse.json({ ok: true, weekKey, label, pushed: !silent });
    }

    // ── 관리자: 주차 마감 ──────────────────────────────────────
    if (action === 'close') {
      const { silent } = body as { silent?: boolean };
      const { error } = await supabaseAdmin
        .from('app_settings')
        .upsert({ key: SETTINGS_KEY, value: null }, { onConflict: 'key' });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      // 전체 미소지기에게 마감 알림 (silent=true면 생략 — 테스트용)
      if (!silent) {
        try {
          await sendPushToAllExcept(
            [],
            '📋 스케줄 신청이 마감되었습니다',
            '편성이 완료되면 확정 일정을 다시 안내드리겠습니다.',
          );
        } catch (_) { /* 푸시 실패해도 마감은 성공 처리 */ }
      }
      return NextResponse.json({ ok: true, pushed: !silent });
    }

    // ── 관리자: 해당 주차 신청 전체 초기화 (재취합/테스트용) ──────
    if (action === 'resetWeek') {
      const { weekKey } = body as { weekKey: string };
      if (!weekKey) return NextResponse.json({ error: 'weekKey 필수' }, { status: 400 });
      const { error, count } = await supabaseAdmin
        .from('availability')
        .delete({ count: 'exact' })
        .eq('week_key', weekKey);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, deleted: count ?? 0 });
    }

    // ── 미소지기: 신청 저장 ────────────────────────────────────
    const { name, weekKey, days } = body as {
      name: string;
      weekKey: string;
      days: { dayOfWeek: number; shiftCodes: string[] }[];
    };

    if (!name || !weekKey || !Array.isArray(days)) {
      return NextResponse.json({ error: 'name, weekKey, days 필수' }, { status: 400 });
    }

    // 열린 주차인지 확인
    const info = await getOpenWeek();
    if (info.weekKey !== weekKey) {
      return NextResponse.json({ error: '현재 신청 가능한 주차가 아닙니다.' }, { status: 403 });
    }

    // 주말 정원 검사: 본인이 '새로' 추가하는 주말 요일이 정원 초과면 거부 (선착순)
    {
      const caps = await getWeekendCaps();
      const { data: prevRows } = await supabaseAdmin
        .from('availability')
        .select('day_of_week')
        .eq('week_key', weekKey)
        .eq('name', name);
      const prevDays = new Set((prevRows ?? []).map((r: any) => r.day_of_week));
      for (const dow of [5, 6]) { // 토=5, 일=6
        const selectingNow = days.some((d) => d.dayOfWeek === dow && d.shiftCodes.length > 0);
        if (selectingNow && !prevDays.has(dow)) {
          const cap = dow === 5 ? caps.sat : caps.sun;
          const { data: dayRows } = await supabaseAdmin
            .from('availability')
            .select('name')
            .eq('week_key', weekKey)
            .eq('day_of_week', dow);
          const others = new Set((dayRows ?? []).map((r: any) => r.name).filter((n: string) => n !== name));
          if (others.size >= cap) {
            return NextResponse.json(
              { error: `${dow === 5 ? '토요일' : '일요일'} 신청이 정원(${cap}명)이 다 찼습니다. 다른 주말 요일을 선택해 주세요.` },
              { status: 409 }
            );
          }
        }
      }
    }

    const toUpsert = days
      .filter((d) => d.shiftCodes.length > 0)
      .map((d) => ({
        name,
        week_key:    weekKey,
        day_of_week: d.dayOfWeek,
        shift_codes: d.shiftCodes,
      }));

    const toDelete = days
      .filter((d) => d.shiftCodes.length === 0)
      .map((d) => d.dayOfWeek);

    if (toUpsert.length > 0) {
      const { error } = await supabaseAdmin
        .from('availability')
        .upsert(toUpsert, { onConflict: 'name,week_key,day_of_week' });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

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
 * Body: { name, weekKey, dayOfWeek? }
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
