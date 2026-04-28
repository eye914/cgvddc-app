import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendPushToNames } from '@/lib/push';

export async function POST(req: NextRequest) {
  try {
    const { name } = await req.json();
    if (!name) return NextResponse.json({ error: '이름 필요' }, { status: 400 });

    // 구독 여부 먼저 확인
    const { data } = await supabaseAdmin
      .from('push_subscriptions')
      .select('id')
      .eq('name', name)
      .limit(1);

    if (!data?.length) {
      return NextResponse.json({ error: '구독 정보 없음. 먼저 🔕 알림 받기를 눌러 구독해주세요.' });
    }

    await sendPushToNames([name], '🔔 CGV교대 알림 테스트', `${name}님, 알림이 정상 작동합니다!`);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
