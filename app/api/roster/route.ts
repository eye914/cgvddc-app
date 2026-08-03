import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAuth, requireAdmin } from '@/lib/session';

// 주간 전체 근무표(시트 스냅샷). 편성은 구글시트에서 하고, 시트 버튼(GAS)이 이 API로 등록한다.
// app_settings 의 단일 키에 최신 1주치만 저장(교체식).
const KEY = 'weekly_roster';

// GET: 로그인 사용자면 최신 근무표 조회
export async function GET(req: NextRequest) {
  const sess = requireAuth(req);
  if (!sess) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const { data, error } = await supabaseAdmin
    .from('app_settings').select('value').eq('key', KEY).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data?.value ?? null);
}

// POST: 관리자(=시트 GAS 버튼)가 근무표 등록. 최신 1주치로 교체.
//   payload: { week_label, updated_at, slots:[{slot,time}], days:[{date,dow,cols:{매점,플로어,통합}by slot}] }
//   유연하게 받아 그대로 저장(렌더는 클라이언트).
export async function POST(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  try {
    const body = await req.json();
    if (!body || !Array.isArray(body.days) || !body.days.length) {
      return NextResponse.json({ error: 'days 데이터가 비어 있습니다.' }, { status: 400 });
    }
    const value = {
      week_label: String(body.week_label || ''),
      slots: Array.isArray(body.slots) ? body.slots : [],
      days: body.days,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabaseAdmin
      .from('app_settings')
      .upsert({ key: KEY, value }, { onConflict: 'key' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, week_label: value.week_label, days: value.days.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
