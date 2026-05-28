import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

async function callGAS(action: string, params: any[] = []) {
  const GAS_URL = process.env.GAS_URL;
  if (!GAS_URL) throw new Error('GAS_URL 미설정');
  const r = await fetch(GAS_URL, {
    method: 'POST',
    body: JSON.stringify({ action, params }),
  });
  const txt = await r.text();
  let parsed: any;
  try { parsed = JSON.parse(txt); } catch { throw new Error('GAS 응답 파싱 실패'); }
  if (!parsed?.success) throw new Error(parsed?.error || 'GAS 실패');
  return parsed.result;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('mode');

    if (mode === 'weeks') {
      const weeks = await callGAS('getScheduleWeeks', []);
      return NextResponse.json({ weeks });
    }
    if (mode === 'findWeek') {
      const date = searchParams.get('date');
      if (!date) return NextResponse.json({ error: 'date 필수' }, { status: 400 });
      const weekKey = await callGAS('findWeekByDate', [date]);
      return NextResponse.json({ weekKey });
    }
    if (mode === 'week') {
      const weekKey = searchParams.get('weekKey');
      if (!weekKey) return NextResponse.json({ error: 'weekKey 필수' }, { status: 400 });
      const schedule = await callGAS('getScheduleByWeek', [weekKey]);
      return NextResponse.json({ schedule });
    }
    if (mode === 'today') {
      const date = searchParams.get('date');
      const fresh = searchParams.get('fresh') === '1';
      if (!date) return NextResponse.json({ error: 'date 필수' }, { status: 400 });
      try {
        const res = await callGAS('getScheduleForDate', [date, fresh]);
        return NextResponse.json(res);
      } catch (e: any) {
        if (e.message && e.message.indexOf('알 수 없는 action') > -1) {
          const weekKey = await callGAS('findWeekByDate', [date]);
          if (!weekKey) return NextResponse.json({ weekKey: null, schedule: [] });
          const schedule = await callGAS('getScheduleByWeek', [weekKey, fresh]);
          return NextResponse.json({ weekKey, schedule });
        }
        throw e;
      }
    }
    if (mode === 'debug') {
      const weekKey = searchParams.get('weekKey');
      if (!weekKey) return NextResponse.json({ error: 'weekKey 필수' }, { status: 400 });
      const dump = await callGAS('debugScheduleSheet', [weekKey]);
      return NextResponse.json({ dump });
    }
    return NextResponse.json({ error: 'mode 필수 (weeks|findWeek|week)' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/**
 * POST /api/schedule
 * 편성 저장 / 배정 해제 / 주차 확정+시트동기화
 *
 * action: 'assign'  → 셀에 미소지기 배정 (upsert)
 * action: 'remove'  → 셀 배정 해제
 * action: 'confirm' → 해당 주차 전체 확정 후 GAS 시트 동기화
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // ── 배정 저장 ──────────────────────────────────────────────
    if (action === 'assign') {
      const { weekKey, date, dayOfWeek, shiftCode, position, name, hours } = body as {
        weekKey: string; date: string; dayOfWeek: number;
        shiftCode: string; position: string; name: string; hours: number;
      };

      if (!weekKey || !date || !shiftCode || !position || !name || !hours) {
        return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 });
      }

      const { error } = await supabaseAdmin
        .from('schedule_assignments')
        .upsert(
          { week_key: weekKey, date, day_of_week: dayOfWeek, shift_code: shiftCode, position, name, hours, confirmed: false, synced_to_sheet: false },
          { onConflict: 'week_key,date,shift_code,position' }
        );

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    // ── 배정 해제 ──────────────────────────────────────────────
    if (action === 'remove') {
      const { weekKey, date, shiftCode, position } = body as {
        weekKey: string; date: string; shiftCode: string; position: string;
      };

      if (!weekKey || !date || !shiftCode || !position) {
        return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 });
      }

      const { error } = await supabaseAdmin
        .from('schedule_assignments')
        .delete()
        .eq('week_key', weekKey)
        .eq('date', date)
        .eq('shift_code', shiftCode)
        .eq('position', position);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    // ── 주차 확정 + GAS 시트 동기화 ───────────────────────────
    if (action === 'confirm') {
      const { weekKey } = body as { weekKey: string };
      if (!weekKey) return NextResponse.json({ error: 'weekKey 필수' }, { status: 400 });

      // 해당 주차 배정 목록 조회
      const { data: rows, error: fetchErr } = await supabaseAdmin
        .from('schedule_assignments')
        .select('*')
        .eq('week_key', weekKey);

      if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

      // GAS writeScheduleCell 호출 (각 배정마다)
      const gasErrors: string[] = [];
      for (const row of rows ?? []) {
        try {
          await callGAS('writeScheduleCell', [
            weekKey,      // 주차 키
            row.date,     // 날짜
            row.shift_code,
            row.position,
            row.name,
            row.hours,
          ]);
        } catch (e: any) {
          gasErrors.push(`${row.date} ${row.shift_code} ${row.position}: ${e.message}`);
        }
      }

      // DB confirmed + synced_to_sheet 갱신
      const { error: updateErr } = await supabaseAdmin
        .from('schedule_assignments')
        .update({ confirmed: true, synced_to_sheet: gasErrors.length === 0 })
        .eq('week_key', weekKey);

      if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

      return NextResponse.json({
        ok: true,
        confirmed: rows?.length ?? 0,
        gasErrors: gasErrors.length > 0 ? gasErrors : null,
      });
    }

    return NextResponse.json({ error: 'action 필수 (assign|remove|confirm)' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
