import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAuth, requireAdmin } from '@/lib/session';

// 주간 전체 근무표(시트 스냅샷). 편성은 구글시트에서 하고, 시트 버튼(GAS)이 이 API로 등록한다.
// app_settings 단일 키에 "여러 주"를 날짜 기준으로 누적 저장(최근 N주 유지).
const KEY = 'weekly_roster';
const KEEP_WEEKS = 6;

// "M/D" → 정렬용 숫자 (같은 해 기준). 연말/연초 경계는 최근 N주만 유지하므로 무시 가능.
function mdNum(md: string): number {
  const m = String(md).match(/(\d{1,2})\s*\/\s*(\d{1,2})/);
  return m ? (+m[1]) * 100 + (+m[2]) : 0;
}

// GET: 로그인 사용자면 저장된 모든 주 조회 → { weeks:[ {week_label, first_date, days} ] }
export async function GET(req: NextRequest) {
  const sess = requireAuth(req);
  if (!sess) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const { data, error } = await supabaseAdmin
    .from('app_settings').select('value').eq('key', KEY).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const v = data?.value as any;
  if (!v) return NextResponse.json({ weeks: [] });
  if (Array.isArray(v.weeks)) return NextResponse.json({ weeks: v.weeks });
  // 구버전(단일 주) 호환
  if (Array.isArray(v.days)) {
    const first = v.days[0]?.date || '';
    return NextResponse.json({ weeks: [{ week_label: v.week_label || '', first_date: first, days: v.days }] });
  }
  return NextResponse.json({ weeks: [] });
}

// POST: 관리자(=시트 GAS 버튼)가 한 주 등록. 날짜(첫날) 기준으로 누적/갱신, 최근 N주 유지.
//   payload: { week_label, days:[ {date, dow, rows:[{slot,time,매점,플로어,통합}]} ] }
export async function POST(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  try {
    const body = await req.json();
    if (!body || !Array.isArray(body.days) || !body.days.length) {
      return NextResponse.json({ error: 'days 데이터가 비어 있습니다.' }, { status: 400 });
    }
    const first = String(body.days[0].date || '');
    const last = String(body.days[body.days.length - 1].date || '');
    const week = {
      week_id: first || String(Date.now()),
      week_label: String(body.week_label || (first && last ? first + ' ~ ' + last : '')),
      first_date: first,
      days: body.days,
      updated_at: new Date().toISOString(),
    };

    // 기존 로드
    const { data: cur } = await supabaseAdmin.from('app_settings').select('value').eq('key', KEY).maybeSingle();
    const v = cur?.value as any;
    let weeks: any[] = [];
    if (v && Array.isArray(v.weeks)) weeks = v.weeks;
    else if (v && Array.isArray(v.days)) { // 구버전 마이그레이션
      const f = v.days[0]?.date || 'old';
      weeks = [{ week_id: f, week_label: v.week_label || '', first_date: f, days: v.days, updated_at: v.updated_at }];
    }

    weeks = weeks.filter((w) => w.week_id !== week.week_id); // 같은 주면 교체
    weeks.push(week);
    weeks.sort((a, b) => mdNum(a.first_date) - mdNum(b.first_date));
    if (weeks.length > KEEP_WEEKS) weeks = weeks.slice(weeks.length - KEEP_WEEKS);

    const { error } = await supabaseAdmin
      .from('app_settings')
      .upsert({ key: KEY, value: { weeks, updated_at: new Date().toISOString() } }, { onConflict: 'key' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, week_label: week.week_label, weeks: weeks.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
