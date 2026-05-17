import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendPushToNames, sendPushToAdmins, sendPushToAllExcept } from '@/lib/push';

const toSnake = (obj: Record<string, any>) => {
  const map: Record<string, string> = {
    reqName: 'req_name', reqPos: 'req_pos',
    subName: 'sub_name', subPos: 'sub_pos',
    desiredShift: 'desired_shift', shiftDate: 'shift_date', tradeType: 'trade_type',
    approvedBy: 'approved_by',
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
  approvedBy: row.approved_by ?? null,
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

    const row = toCamel(data);
    // 공고 등록 → 등록자 제외 전체 미소지기에게 알림 발송
    const typeLabel = row.tradeType === 'sub' ? '대타' : '맞교대';
    const shiftShort = (row.shiftDate ?? '').split(' / ')[0];
    await sendPushToAllExcept(
      [row.reqName],
      `📢 새 ${typeLabel} 공고`,
      `${row.reqName}님의 ${shiftShort} [${row.reqPos}] 공고가 등록됐습니다.`
    );

    // GAS 요청DB 시트에 비동기 기록 (실패해도 등록은 완료, 서버 로그만)
    const saveRes = await callGASWithCheck('saveTradeToDB', [row]);
    if (!saveRes.ok) console.warn('[trades POST] GAS saveTradeToDB failed:', saveRes.msg);

    return NextResponse.json(row);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GAS 호출 + 응답 검증 헬퍼
async function callGASWithCheck(action: string, params: any[]): Promise<{ ok: boolean; msg?: string; raw?: any }> {
  const GAS_URL = process.env.GAS_URL;
  if (!GAS_URL) return { ok: false, msg: 'GAS_URL 미설정' };
  try {
    const r = await fetch(GAS_URL, {
      method: 'POST',
      body: JSON.stringify({ action, params }),
    });
    const txt = await r.text();
    let parsed: any;
    try { parsed = JSON.parse(txt); } catch { return { ok: false, msg: 'GAS 응답 파싱 실패: ' + txt.substring(0, 200) }; }
    if (!parsed?.success) return { ok: false, msg: parsed?.error || 'GAS success=false', raw: parsed };
    const result = parsed.result;
    // applySwapFromData 같은 경우 result.out/result.in 형태로 응답
    if (result && typeof result === 'object' && ('out' in result || 'in' in result)) {
      const outOk = result.out?.ok !== false;
      const inOk = result.in?.ok !== false;
      if (!outOk || !inOk) {
        const msgs = [result.out?.msg, result.in?.msg].filter(Boolean).join(' / ');
        return { ok: false, msg: msgs || 'GAS 시트 적용 실패', raw: result };
      }
    }
    // error 필드가 있으면 실패
    if (result?.error) return { ok: false, msg: result.error, raw: result };
    return { ok: true, raw: result };
  } catch (e: any) {
    return { ok: false, msg: 'GAS 통신 오류: ' + e.message };
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

    const ns = snakeUpdate.status;

    // ✅ '승인완료' 는 GAS 시트 적용을 먼저 시도 → 성공 시에만 Supabase 업데이트 (트랜잭션 일관성)
    if (ns === '승인완료') {
      const reqName = updateData.reqName ?? before?.req_name;
      const subName = updateData.subName ?? before?.sub_name;
      // ★ 5.5h/4.5h 구분을 위해 양쪽 hours 조회
      const { data: misoRows } = await supabaseAdmin
        .from('misojigi')
        .select('name, hours')
        .in('name', [reqName, subName].filter(Boolean));
      const hoursMap: Record<string, string> = {};
      (misoRows ?? []).forEach((r: any) => { hoursMap[r.name] = String(r.hours ?? '5.5'); });
      // 미리 row 를 구성 (현재 before 값 + 업데이트값 병합)
      const previewRow = {
        id,
        reqName,
        shiftDate: updateData.shiftDate ?? before?.shift_date,
        reqPos: updateData.reqPos ?? before?.req_pos,
        desiredShift: updateData.desiredShift ?? before?.desired_shift,
        reason: updateData.reason ?? before?.reason,
        tradeType: updateData.tradeType ?? before?.trade_type,
        subName,
        subPos: updateData.subPos ?? before?.sub_pos,
        status: '승인완료',
        approvedBy: updateData.approvedBy ?? before?.approved_by,
        reqHours: hoursMap[reqName] ?? '5.5',
        subHours: hoursMap[subName] ?? '5.5',
      };
      const gasResult = await callGASWithCheck('applySwapFromData', [previewRow]);
      if (!gasResult.ok) {
        return NextResponse.json(
          { error: `시트 적용 실패: ${gasResult.msg}. 시트가 존재하는지 확인 후 다시 승인해 주세요.`, gasDetail: gasResult.raw },
          { status: 409 }
        );
      }
    }

    const { data, error } = await supabaseAdmin
      .from('trades')
      .update(snakeUpdate)
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const row = toCamel(data);
    const prevSubName = before?.sub_name;

    if (ns === '협의중') {
      await sendPushToNames([row.reqName], '🙋 교대 지원', `${row.subName}님이 ${row.shiftDate} 교대에 지원했습니다.`);
    } else if (ns === '승인대기') {
      await sendPushToAdmins('📋 교대 승인 요청', `${row.reqName}↔${row.subName} ${row.shiftDate} 최종 승인이 필요합니다.`);
    } else if (ns === '반려됨') {
      await sendPushToNames([prevSubName], '😢 교대 거절', `${row.reqName}님이 교대 신청을 거절했습니다.`);
    } else if (ns === '승인완료') {
      // 시트 적용은 위에서 이미 성공. 알림만 발송.
      await sendPushToNames([row.reqName, row.subName], '✅ 교대 확정!', `${row.shiftDate} 교대가 최종 확정되었습니다.`);
      const approver = row.approvedBy ?? '관리자';
      const { data: adminRows } = await supabaseAdmin.from('admins').select('name').eq('active', true);
      const otherAdmins = (adminRows ?? [])
        .map((r: Record<string, any>) => r.name)
        .filter((n: string) => n !== approver);
      if (otherAdmins.length) {
        await sendPushToNames(otherAdmins, '✅ 교대 승인 완료', `${approver}이(가) ${row.reqName}↔${row.subName} ${row.shiftDate} 교대를 승인했습니다.`);
      }
    } else if (ns === '모집중' && before?.status === '승인대기') {
      await sendPushToNames([row.reqName], '🔄 교대 반려', `관리자가 ${row.shiftDate} 교대 신청을 반려했습니다. 재모집 중입니다.`);
      if (prevSubName && prevSubName !== '모집중') {
        await sendPushToNames([prevSubName], '🔄 교대 반려', `${row.shiftDate} 교대 신청이 관리자에 의해 반려되었습니다.`);
      }
    }

    // GAS 요청DB(시트) 상태·수락자 실시간 동기화 — 비차단(상태 동기화는 부가 작업)
    if (ns) {
      const gasUpdate: Record<string, any> = { status: ns };
      if (updateData.subName !== undefined) gasUpdate.subName = updateData.subName;
      if (updateData.subPos  !== undefined) gasUpdate.subPos  = updateData.subPos;
      if (updateData.desiredShift !== undefined) gasUpdate.desiredShift = updateData.desiredShift;
      const syncRes = await callGASWithCheck('updateTradeInDB', [id, gasUpdate]);
      if (!syncRes.ok) {
        // 요청DB 시트 동기화 실패는 승인완료에 영향 주지 않음 — 서버 로그로만 남김
        console.warn('[trades PATCH] GAS updateTradeInDB sync failed:', syncRes.msg);
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
    // GAS 요청DB 시트에서도 삭제 (실패 시 로그)
    const delRes = await callGASWithCheck('deleteTradeFromDB', [id]);
    if (!delRes.ok) console.warn('[trades DELETE] GAS deleteTradeFromDB failed:', delRes.msg);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
