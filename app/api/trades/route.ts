import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendPushToNames, sendPushToAdmins } from '@/lib/push';

const toSnake = (obj: Record<string, any>) => {
  const map: Record<string, string> = {
    reqName: 'req_name', reqPos: 'req_pos',
    subName: 'sub_name', subPos: 'sub_pos',
    desiredShift: 'desired_shift', shiftDate: 'shift_date', tradeType: 'trade_type',
  };
  const r: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) r[map[k] ?? k] = v;
  return r;
};

const toCamel = (row: Record<string, any>) => ({
  id: row.id,
  reqName: row.req_name,
  shiftDate: row.shift_date,
  reqPos: row.req_pos,
  desiredShift: row.desired_shift,
  reason: row.reason,
  tradeType: row.trade_type,
  subName: row.sub_name,
  subPos: row.sub_pos,
  status: row.status,
  createdAt: row.created_at,
});

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('trades')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data ?? []).map(toCamel));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { data, error } = await supabaseAdmin
      .from('trades')
      .insert([toSnake(body)])
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(toCamel(data));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...updateData } = body;
    const snakeUpdate = toSnake(updateData);

    const { data: before } = await supabaseAdmin
      .from('trades')
      .select('*')
      .eq('id', id)
      .single();

    const { data, error } = await supabaseAdmin
      .from('trades')
      .update(snakeUpdate)
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const ns = snakeUpdate.status;
    const row = toCamel(data);
    const prevSubName = before?.sub_name;

    if (ns === '협의중') {
      await sendPushToNames([row.reqName], '🙋 교대 지원', `${row.subName}님이 ${row.shiftDate} 교대에 지원했습니다.`);
    } else if (ns === '승인대기') {
      await sendPushToAdmins('📋 교대 승인 요청', `${row.reqName}↔${row.subName} ${row.shiftDate} 최종 승인이 필요합니다.`);
    } else if (ns === '반려됨') {
      await sendPushToNames([prevSubName], '😢 교대 거절', `${row.reqName}님이 교대 신청을 거절했습니다.`);
    } else if (ns === '승인완료') {
      await sendPushToNames([row.reqName, row.subName], '✅ 교대 확정!', `${row.shiftDate} 교대가 최종 확정되었습니다.`);
    } else if (ns === '모집중' && before?.status === '승인대기') {
      await sendPushToNames([row.reqName], '🔄 교대 반려', `관리자가 ${row.shiftDate} 교대 신청을 반려했습니다. 재모집 중입니다.`);
      if (prevSubName && prevSubName !== '모집중') {
        await sendPushToNames([prevSubName], '🔄 교대 반려', `${row.shiftDate} 교대 신청이 관리자에 의해 반려되었습니다.`);
      }
    }

    return NextResponse.json(row);
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
