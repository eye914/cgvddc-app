import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendPushToAllExcept } from '@/lib/push';

const SETTINGS_KEY = 'availability_open_week';
const CAP_KEY = 'day_capacity';
const EVENTS_KEY = 'schedule_events';
const DOW_NAMES = ['월', '화', '수', '목', '금', '토', '일'];
const GROUP_IDS = ['d', 'm', 'n'];       // 오픈, 미들, 마감
const GROUP_NAMES = ['오픈', '미들', '마감'];
// 기본 정원 [오픈, 미들, 마감] + 이벤트 시간대 보너스
const DEFAULT_CAP = { weekday: [2, 3, 4], sat: [3, 4, 5], sun: [3, 4, 4], eventBonus: 1 };

type CapConfig = { weekday: number[]; sat: number[]; sun: number[]; eventBonus: number };

async function callGAS(action: string, params: any[]) {
  const GAS_URL = process.env.GAS_URL;
  if (!GAS_URL) throw new Error('GAS_URL 미설정');
  const r = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action, params }) });
  const parsed = JSON.parse(await r.text());
  if (!parsed?.success) throw new Error(parsed?.error || 'GAS 실패');
  return parsed.result;
}

/** 정원 설정 조회 (기본: DEFAULT_CAP). value = {weekday:[o,m,n], sat, sun, eventBonus} */
async function getCapConfig(): Promise<CapConfig> {
  const { data } = await supabaseAdmin
    .from('app_settings').select('value').eq('key', CAP_KEY).maybeSingle();
  const v = (data?.value as Partial<CapConfig>) || {};
  const arr = (a: any, def: number[]) =>
    Array.isArray(a) && a.length === 3 ? a.map(Number) : def;
  return {
    weekday: arr(v.weekday, DEFAULT_CAP.weekday),
    sat: arr(v.sat, DEFAULT_CAP.sat),
    sun: arr(v.sun, DEFAULT_CAP.sun),
    eventBonus: Number(v.eventBonus ?? DEFAULT_CAP.eventBonus),
  };
}

/** schedule_events 맵 조회 { 'YYYY-MM-DD': {recruitInt, intGroups, ...} } */
async function getEventsMap(): Promise<Record<string, any>> {
  const { data } = await supabaseAdmin
    .from('app_settings').select('value').eq('key', EVENTS_KEY).maybeSingle();
  return (data?.value as Record<string, any>) || {};
}

/** 주차 월요일 + dayIdx → 'YYYY-MM-DD' */
function dateForDay(weekKey: string, dayIdx: number): string {
  const d = new Date(weekKey + 'T00:00:00');
  d.setDate(d.getDate() + dayIdx);
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

/** 요일(0~6)×시간대(0~2) 유효 정원 7×3 (이벤트 보너스 반영) */
function buildCapMatrix(cfg: CapConfig, weekKey: string, events: Record<string, any>): number[][] {
  const out: number[][] = [];
  for (let dow = 0; dow < 7; dow++) {
    const base = dow === 5 ? cfg.sat : dow === 6 ? cfg.sun : cfg.weekday;
    const ev = events[dateForDay(weekKey, dow)];
    const evGroups: string[] = ev && ev.recruitInt
      ? (Array.isArray(ev.intGroups) && ev.intGroups.length ? ev.intGroups : GROUP_IDS)
      : [];
    out.push(GROUP_IDS.map((g, gi) => base[gi] + (evGroups.indexOf(g) > -1 ? cfg.eventBonus : 0)));
  }
  return out;
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
      const cfg = await getCapConfig();
      // counts/caps = 7×3 (요일 × [오픈,미들,마감])
      const counts: number[][] = Array.from({ length: 7 }, () => [0, 0, 0]);
      let caps: number[][] = Array.from({ length: 7 }, () => [0, 0, 0]);
      if (info.weekKey) {
        const events = await getEventsMap();
        caps = buildCapMatrix(cfg, info.weekKey, events);
        const { data: avRows } = await supabaseAdmin
          .from('availability')
          .select('name, day_of_week, shift_codes')
          .eq('week_key', info.weekKey);
        // 시간대별 distinct 인원 집계
        const sets: Record<string, Set<string>> = {};
        (avRows ?? []).forEach((r: any) => {
          (r.shift_codes ?? []).forEach((g: string) => {
            const gi = GROUP_IDS.indexOf(g);
            if (gi < 0) return;
            const key = r.day_of_week + ':' + gi;
            (sets[key] = sets[key] || new Set()).add(r.name);
          });
        });
        for (let d = 0; d < 7; d++)
          for (let gi = 0; gi < 3; gi++)
            counts[d][gi] = sets[d + ':' + gi] ? sets[d + ':' + gi].size : 0;
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

    // ── 관리자: 신청현황 시트로 내보내기 (매트릭스 탭) ──────────
    if (action === 'exportSheet') {
      const { weekKey } = body as { weekKey: string };
      if (!weekKey) return NextResponse.json({ error: 'weekKey 필수' }, { status: 400 });
      const { data: miso } = await supabaseAdmin
        .from('misojigi').select('name').eq('active', true).order('name');
      const names = (miso ?? []).map((r: any) => String(r.name).trim());
      const { data: avRows } = await supabaseAdmin
        .from('availability').select('name, day_of_week, shift_codes').eq('week_key', weekKey);
      const byName: Record<string, Record<number, string[]>> = {};
      (avRows ?? []).forEach((r: any) => {
        (byName[r.name] = byName[r.name] || {})[r.day_of_week] = r.shift_codes || [];
      });
      const KR = ['월', '화', '수', '목', '금', '토', '일'];
      const mon = new Date(weekKey + 'T00:00:00');
      const dates: string[] = [];
      for (let i = 0; i < 7; i++) { const d = new Date(mon); d.setDate(mon.getDate() + i); dates.push((d.getMonth() + 1) + '/' + d.getDate() + '(' + KR[i] + ')'); }
      const GLB: Record<string, string> = { d: '오픈', m: '미들', n: '마감' };
      const lbl = (codes: string[]) => !codes || !codes.length ? '' : (codes.length >= 3 ? '전부' : codes.map((c) => GLB[c] || c).join('·'));
      const totals = [0, 0, 0, 0, 0, 0, 0];
      const rows = names.map((nm: string) => {
        const submitted = !!byName[nm];
        const days: string[] = [];
        for (let i = 0; i < 7; i++) { const codes = (byName[nm] || {})[i] || []; days.push(lbl(codes)); if (codes.length) totals[i]++; }
        return { name: nm, submitted, days };
      });
      try {
        const result = await callGAS('writeAvailabilityMatrix', [weekKey, { dates, rows, totals }]);
        return NextResponse.json({ ok: true, result });
      } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
      }
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

    // 근로일수 초과 차단: 선택 요일 수 ≤ 본인 근로일수
    {
      const { data: misoRow } = await supabaseAdmin
        .from('misojigi').select('contract_days').eq('name', name).maybeSingle();
      const contractDays = Number(misoRow?.contract_days ?? 5);
      const selDays = days.filter((d) => d.shiftCodes.length > 0).length;
      if (selDays > contractDays) {
        return NextResponse.json(
          { error: `근로일수(${contractDays}일)보다 많은 요일을 선택할 수 없습니다. ${contractDays}일 이내로 선택해 주세요.` },
          { status: 400 }
        );
      }
    }

    // 시간대별 정원 검사: 본인이 '새로' 추가하는 (요일×시간대)가 정원 초과면 거부 (선착순)
    {
      const cfg = await getCapConfig();
      const events = await getEventsMap();
      const capMatrix = buildCapMatrix(cfg, weekKey, events);
      // 본인이 이미 신청한 (요일→시간대 Set)
      const { data: prevRows } = await supabaseAdmin
        .from('availability')
        .select('day_of_week, shift_codes')
        .eq('week_key', weekKey)
        .eq('name', name);
      const prevSelf: Record<number, Set<string>> = {};
      (prevRows ?? []).forEach((r: any) => {
        prevSelf[r.day_of_week] = new Set(r.shift_codes ?? []);
      });
      // 이번 주 전체 신청 1회 조회 → (요일×시간대) 인원(본인 제외) 메모리 집계
      const { data: allRows } = await supabaseAdmin
        .from('availability')
        .select('name, day_of_week, shift_codes')
        .eq('week_key', weekKey);
      const othersSets: Record<string, Set<string>> = {};
      (allRows ?? []).forEach((r: any) => {
        if (r.name === name) return;
        (r.shift_codes ?? []).forEach((g: string) => {
          const key = r.day_of_week + ':' + g;
          (othersSets[key] = othersSets[key] || new Set()).add(r.name);
        });
      });
      for (const d of days) {
        const dow = d.dayOfWeek;
        for (const g of (d.shiftCodes || [])) {
          const gi = GROUP_IDS.indexOf(g);
          if (gi < 0) continue;
          const had = prevSelf[dow] && prevSelf[dow].has(g);
          if (had) continue; // 이미 신청한 시간대는 통과
          const cap = capMatrix[dow][gi];
          const cnt = othersSets[dow + ':' + g] ? othersSets[dow + ':' + g].size : 0;
          if (cnt >= cap) {
            return NextResponse.json(
              { error: `${DOW_NAMES[dow]}요일 ${GROUP_NAMES[gi]} 정원(${cap}명)이 다 찼습니다. 다른 시간대를 선택해 주세요.` },
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
