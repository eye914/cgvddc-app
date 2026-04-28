import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendPushToNames, sendPushToAdmins } from '@/lib/push';

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('trades')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { data, error } = await supabaseAdmin
      .from('trades')
      .insert([body])
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...updateData } = body;

    // 업데이트 전 현재 상태 조회 (알림용)
    const { data: before } = await supabaseAdmin
      .from('trades')
      .select('*')
      .eq('id', id)
      .single();

    const { data, error } = await supabaseAdmin
      .from('trades')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // ── 알림 트리거 ──
    const ns = updateData.status;
    const reqName = data.req_name || data.reqName;
    const subName = data.sub_name || data.subName;
    const shiftDate = data.shift_date || data.shiftDate || '';
    const prevSubName = before?.sub_name || before?.subName;

    if (ns === '협의중') {
      // 지원자 생김 → 공고 등록자에게
      await sendPushToNames(
        [reqName],
        '🙋 교대 지원',
        `${subName}님이 ${shiftDate} 교대에 지원했습니다.`
      );
    } else if (ns === '승인대기') {
      // 공고자가 수락 → 관리자 3명에게
      await sendPushToAdmins(
        '📋 교대 승인 요청',
        `${reqName}↔${subName} ${shiftDate} 최종 승인이 필요합니다.`
      );
    } else if (ns === '반려됨') {
      // 공고자가 지원자 거절 → 지원자에게
      await sendPushToNames(
        [prevSubName],
        '😢 교대 거절',
        `${reqName}님이 교대 신청을 거절했습니다.`
      );
    } else if (ns === '승인완료') {
      // 관리자 최종 승인 → 공고자 + 지원자 둘 다
      await sendPushToNames(
        [reqName, subName],
        '✅ 교대 확정!',
        `${shiftDate} 교대가 최종 확정되었습니다.`
      );
    } else if (ns === '모집중' && before?.status === '승인대기') {
      // 관리자 반려 후 재모집 → 공고자 + 이전 지원자
      await sendPushToNames(
        [reqName],
        '🔄 교대 반려',
        `관리자가 ${shiftDate} 교대 신청을 반려했습니다. 재모집 중입니다.`
      );
      if (prevSubName && prevSubName !== '모집중') {
        await sendPushToNames(
          [prevSubName],
          '🔄 교대 반려',
          `${shiftDate} 교대 신청이 관리자에 의해 반려되었습니다.`
        );
      }
    }

    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.days != null) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - body.days);
      const { data, error } = await supabaseAdmin
        .from('trades')
        .delete()
        .lt('created_at', cutoff.toISOString())
        .select();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ deleted: data?.length ?? 0 });
    }
    const { id } = body;
    const { error } = await supabaseAdmin.from('trades').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
