import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendPushToNames, sendPushToAdmins } from '@/lib/push';

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // KST 오늘 날짜 계산 (UTC+9) — 22:05에 실행되므로 "오늘"이 교대 전날
  const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const tomorrow = new Date(nowKST);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10); // "YYYY-MM-DD"

  // 오늘 22:00 마감 → 내일 교대인 모집중 공고 만료 처리
  const { data: trades, error: fetchErr } = await supabaseAdmin
    .from('trades')
    .select('id, req_name, shift_date')
    .eq('status', '모집중')
    .like('shift_date', `${tomorrowStr}%`);

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!trades?.length) return NextResponse.json({ expired: 0, message: '만료 공고 없음' });

  type TradeRow = { id: string; req_name: string; shift_date: string };
  const ids = (trades as TradeRow[]).map(t => t.id);

  // 상태를 '만료'로 일괄 업데이트
  const { error: updateErr } = await supabaseAdmin
    .from('trades')
    .update({ status: '만료' })
    .in('id', ids);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // reqName 중복 제거
  const names = [...new Set((trades as TradeRow[]).map(t => t.req_name))];

  // 당사자 개별 알림
  await Promise.allSettled(
    names.map(name =>
      sendPushToNames(
        [name],
        '⚠️ 교대 공고 만료',
        '교대 미체결로 공고 만료. 출근 불가 시 근무 전 031-868-8092~4 연락 필수, 다음 출근 시 결근사유서 제출.'
      )
    )
  );

  // 관리자 요약 알림
  const nameList = names.join(', ');
  await sendPushToAdmins(
    '📋 교대 미체결 만료',
    `${nameList} 외 총 ${trades.length}건의 공고가 마감됐습니다. 결근계 제출 안내가 발송됐습니다.`
  );

  return NextResponse.json({ expired: trades.length, notified: names.length });
}
