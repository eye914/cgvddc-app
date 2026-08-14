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

  // ── 스케줄 신청 취합 미제출자 독려: 신청이 열린 주차가 있으면 미제출자에게 매일 1회 ──
  try {
    const { data: setRow } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'availability_open_week')
      .maybeSingle();
    const openWeek = (setRow?.value as any)?.week_key;
    if (openWeek) {
      const { data: staff } = await supabaseAdmin
        .from('misojigi')
        .select('name')
        .eq('active', true);
      const { data: subs } = await supabaseAdmin
        .from('availability')
        .select('name')
        .eq('week_key', openWeek);
      const submitted = new Set((subs || []).map((r: any) => r.name));
      const missing = (staff || [])
        .map((r: any) => r.name)
        .filter((n: string) => n && !submitted.has(n));
      if (missing.length > 0) {
        const mon = new Date(openWeek + 'T00:00:00');
        const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
        const lbl = `${mon.getMonth() + 1}/${mon.getDate()} ~ ${sun.getMonth() + 1}/${sun.getDate()}`;
        await sendPushToNames(
          missing,
          '스케줄 신청 마감 전 안내',
          `${lbl} 주 근무 신청이 아직 접수되지 않았습니다. 마감 전 앱에서 신청해 주세요.`,
        );
      }
    }
  } catch (_) { /* 독려 실패해도 다른 알림은 계속 진행 */ }

  // ── 근태서류 미제출 확인: 기한(요청일+3일) 지난 미제출 건을 매일 관리자에게 보고 + 당사자 독촉 ──
  try {
    const { data: freq } = await supabaseAdmin
      .from('form_requests')
      .select('id, type, target_name, requested_at, status')
      .eq('status', 'pending');
    const TYPE_KO: Record<string, string> = {
      late: '지각확인서', absent: '결근사유서', resign: '사직원', earlyLeave: '희망조퇴확인서',
      privacy: '개인정보보호 서약서', overtime: '연장·야간·휴일 근로동의서', workCondition: '근로조건 변경동의서',
    };
    const overdue = (freq ?? []).filter((r: any) => {
      if (!r.requested_at) return false;
      return Date.now() > new Date(r.requested_at).getTime() + 3 * 86400000;
    });
    if (overdue.length > 0) {
      // 관리자에게 누가 무엇을 안 냈는지 요약 보고
      const byName: Record<string, string[]> = {};
      overdue.forEach((r: any) => {
        (byName[r.target_name] = byName[r.target_name] || []).push(TYPE_KO[r.type] || '서류');
      });
      const summary = Object.keys(byName)
        .map((n) => `${n}(${byName[n].join(',')})`)
        .join(' · ');
      await sendPushToAdmins(
        '📄 근태서류 미제출 확인',
        `기한 초과 ${overdue.length}건 — ${summary}`,
      );
      // 당사자에게도 매일 1회 독촉
      await sendPushToNames(
        Object.keys(byName),
        '🔔 근태서류 제출 기한 초과',
        '제출 기한이 지난 서류가 있습니다. 앱에서 바로 제출해 주세요.',
        '/?go=forms',
      );
    }
  } catch (_) { /* 서류 확인 실패해도 나머지 알림은 계속 진행 */ }

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
