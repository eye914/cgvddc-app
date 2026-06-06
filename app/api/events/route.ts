import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// 이벤트/공휴일 저장 (app_settings의 단일 키에 날짜→정보 맵으로 저장)
// value 예: { "2026-06-06": { label: "현충일", holiday: true, recruitInt: false } }
const KEY = 'schedule_events';

async function getEvents(): Promise<Record<string, any>> {
  const { data } = await supabaseAdmin
    .from('app_settings')
    .select('value')
    .eq('key', KEY)
    .maybeSingle();
  return (data?.value as Record<string, any>) || {};
}

async function saveEvents(map: Record<string, any>) {
  await supabaseAdmin
    .from('app_settings')
    .upsert({ key: KEY, value: map }, { onConflict: 'key' });
}

// GET: 전체 이벤트 맵
export async function GET() {
  try {
    return NextResponse.json({ events: await getEvents() });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST: 특정 날짜 이벤트 설정/수정 (모두 비면 삭제)
export async function POST(req: NextRequest) {
  try {
    const { date, label, holiday, recruitInt } = await req.json();
    if (!date) return NextResponse.json({ error: 'date 필수' }, { status: 400 });
    const map = await getEvents();
    const hasLabel = label && String(label).trim();
    if (!hasLabel && !holiday && !recruitInt) {
      delete map[date];
    } else {
      map[date] = {
        label: hasLabel ? String(label).trim() : '',
        holiday: !!holiday,
        recruitInt: !!recruitInt,
      };
    }
    await saveEvents(map);
    return NextResponse.json({ ok: true, events: map });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE: 특정 날짜 이벤트 삭제
export async function DELETE(req: NextRequest) {
  try {
    const { date } = await req.json();
    if (!date) return NextResponse.json({ error: 'date 필수' }, { status: 400 });
    const map = await getEvents();
    delete map[date];
    await saveEvents(map);
    return NextResponse.json({ ok: true, events: map });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
