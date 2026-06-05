import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendPushToAllExcept } from '@/lib/push';

const SETTINGS_KEY = 'availability_open_week';

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
      return NextResponse.json({
        weekKey:  info.weekKey,
        isOpen:   !!info.weekKey,
        openedBy: info.openedBy ?? null,
        openedAt: info.openedAt ?? null,
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
