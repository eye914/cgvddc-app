import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendPushToNames, sendPushToAdmins } from '@/lib/push';

export async function GET(req: NextRequest) {
  // Vercel Cron 보안: CRON_SECRET 헤더 검증
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // KST 내일 날짜 계산 (UTC+9)
  const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const tomorrow = new Date(nowKST);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10); // "YYYY-MM-DD"

  // ── 승인 대기 리마인더: 관리자가 아직 승인 안 한 매칭 건(근무일 안 지난 것)은 매일 관리자에게 알림 ──
  try {
    const todayStr = nowKST.toISOString().slice(0, 10);
    const { data: pending } = await supabaseAdmin
      .from('trades')
      .select('id, shift_date')
      .eq('status', '승인대기')
      .gte('shift_date', todayStr)
      .order('shift_date', { ascending: true });
    if (pending && pending.length > 0) {
      const nearest = String(pending[0].shift_date).slice(0, 10);
      await sendPushToAdmins(
        '🔔 승인 대기 중인 교대',
        `승인 대기 ${pending.length}건 (가장 임박: ${nearest}). 앱에서 승인 또는 반려해 주세요.`,
      );
    }
  } catch (_) { /* 리마인더 실패해도 마감 알림은 계속 진행 */ }

  // 내일 교대인 미체결(모집중) 공고 조회
  const { data: trades, error } = await supabaseAdmin
    .from('trades')
    .select('id, req_name, shift_date, desired_shift, trade_type')
    .eq('status', '모집중')
    .like('shift_date', `${tomorrowStr}%`);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!trades?.length) return NextResponse.json({ sent: 0, message: '내일 마감 공고 없음' });

  // reqName별로 그룹화 (한 사람이 여러 공고 올릴 수 있음)
  const grouped: Record<string, typeof trades> = {};
  for (const t of trades) {
    if (!grouped[t.req_name]) grouped[t.req_name] = [];
    grouped[t.req_name].push(t);
  }

  // 각 reqName에게 알림 발송
  const names = Object.keys(grouped);
  await Promise.allSettled(
    names.map(name => {
      const count = grouped[name].length;
      const label = count > 1 ? `${count}건의 공고` : '공고';
      return sendPushToNames(
        [name],
        '⏰ 교대 마감 임박',
        `내일(${tomorrowStr}) ${label}가 22시에 마감됩니다. 아직 대타를 못 구했어요!`
      );
    })
  );

  // 관리자에게도 요약 알림
  if (trades.length > 0) {
    await sendPushToAdmins(
      '📋 내일 마감 미체결 공고',
      `내일(${tomorrowStr}) 마감 미체결 공고 ${trades.length}건이 있습니다.`
    );
  }

  return NextResponse.json({ sent: names.length, adminAlerted: true, trades: trades.length });
}
