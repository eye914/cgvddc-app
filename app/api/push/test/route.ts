import { NextRequest, NextResponse } from 'next/server';
import { sendPushToNames } from '@/lib/push';

export async function POST(req: NextRequest) {
  try {
    const { name } = await req.json();
    if (!name) return NextResponse.json({ error: '이름 필요' }, { status: 400 });

    await sendPushToNames([name], '🔔 CGV교대 알림 테스트', `${name}님, 알림이 정상 작동합니다!`);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
