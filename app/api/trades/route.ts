import { NextRequest, NextResponse, after } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendPushToNames, sendPushToAdmins, sendPushToAllExcept } from '@/lib/push';

export const maxDuration = 30; // 승인 시 GAS 시트 적용이 느릴 수 있어 여유 확보

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
  lastRemindAt: row.last_remind_at ?? null,
});

// KST 기준 오늘 날짜(YYYY-MM-DD)
function kstDay(d: Date | string | number): string {
  return new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
}

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

    // ── 관리자: 모집중 공고 재알림(리마인더). 하루 1회 제한 ──
    if (body.action === 'remind') {
      const { id } = body;
      if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 });
      const { data: t } = await supabaseAdmin.from('trades').select('*').eq('id', id).single();
      if (!t) return NextResponse.json({ error: '공고를 찾을 수 없습니다.' }, { status: 404 });
      if (t.status !== '모집중') {
        return NextResponse.json({ error: '모집 중인 공고만 재알림할 수 있습니다.' }, { status: 400 });
      }
      // 하루 1회: 마지막 재알림이 KST 오늘이면 차단
      if (t.last_remind_at && kstDay(t.last_remind_at) >= kstDay(new Date())) {
        return NextResponse.json({ error: '오늘은 이미 재알림을 보냈습니다. 내일 다시 보낼 수 있습니다.' }, { status: 429 });
      }
      const row = toCamel(t);
      const typeLabel = row.tradeType === 'sub' ? '대타' : '맞교대';
      const shiftShort = (row.shiftDate ?? '').split(' / ')[0];
      const exclude = [row.reqName];
      if (row.subName && row.subName !== '모집중') exclude.push(row.subName);
      await sendPushToAllExcept(
        exclude,
        `🔔 ${typeLabel} 공고 재안내`,
        `${shiftShort} [${row.reqPos}] ${typeLabel} 아직 모집 중입니다. 가능하신 분은 지금 앱에서 지원해 주세요!`
      );
      await supabaseAdmin.from('trades').update({ last_remind_at: new Date().toISOString() }).eq('id', id);
      return NextResponse.json({ ok: true });
    }

    const { urgent, ...tradeBody } = body; // urgent는 DB 컬럼 아님 — 푸시 문구용
    const snake = toSnake(tradeBody);

    // 서버측 중복 방어: 같은 사람·같은 근무(OUT)·같은 유형이 최근 60초 내 이미 등록됐으면
    //   새로 만들지 않고 기존 공고를 그대로 반환(멱등) + 중복 푸시도 생략 → 연타/재전송 시 중복 차단
    if (snake.req_name && snake.shift_date) {
      const sinceIso = new Date(Date.now() - 60_000).toISOString();
      const { data: dup } = await supabaseAdmin
        .from('trades')
        .select('*')
        .eq('req_name', snake.req_name)
        .eq('shift_date', snake.shift_date)
        .eq('req_pos', snake.req_pos ?? '')
        .eq('trade_type', snake.trade_type ?? '')
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (dup) return NextResponse.json(toCamel(dup));
    }

    const { data, error } = await supabaseAdmin
      .from('trades')
      .insert([snake])
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const row = toCamel(data);
    // 공고 등록 → 등록자 제외 전체 미소지기에게 알림 발송 (긴급이면 🆘 강조)
    const typeLabel = row.tradeType === 'sub' ? '대타' : '맞교대';
    const shiftShort = (row.shiftDate ?? '').split(' / ')[0];
    if (urgent) {
      await sendPushToAllExcept(
        [row.reqName],
        '🆘 긴급 대타 요청!',
        `${shiftShort} [${row.reqPos}] 긴급 대타 구합니다! 가능하신 분은 지금 앱에서 지원해 주세요.`
      );
    } else {
      await sendPushToAllExcept(
        [row.reqName],
        `📢 새 ${typeLabel} 공고`,
        `${row.reqName} 님이 ${shiftShort} [${row.reqPos}] ${typeLabel} 공고를 등록했습니다.`
      );
    }

    // GAS 요청DB 시트에 비동기 기록 (실패해도 등록은 완료, 서버 로그만)
    const saveRes = await callGASWithCheck('saveTradeToDB', [row]);
    if (!saveRes.ok) console.warn('[trades POST] GAS saveTradeToDB failed:', saveRes.msg);

    return NextResponse.json(row);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GAS 호출 + 응답 검증 헬퍼
async function callGASWithCheck(action: string, params: any[]): Promise<{ ok: boolean; parseError?: boolean; msg?: string; raw?: any }> {
  const GAS_URL = process.env.GAS_URL;
  if (!GAS_URL) return { ok: false, msg: 'GAS_URL 미설정' };
  try {
    const r = await fetch(GAS_URL, {
      method: 'POST',
      body: JSON.stringify({ action, params }),
    });
    const txt = await r.text();
    let parsed: any;
    // doPost 는 성공/실패 모두 JSON 반환 → 파싱 실패는 전송/플랫폼 문제(느린 실행 등). 로직 실패와 구분해서 표시.
    try { parsed = JSON.parse(txt); } catch { return { ok: false, parseError: true, msg: 'GAS 응답 파싱 실패: ' + txt.substring(0, 200) }; }
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
    let swapPreview: any = null;   // 승인완료 시 시트 스왑에 쓸 데이터(백그라운드 적용)

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
      swapPreview = previewRow;   // 시트 반영은 응답 후 백그라운드로 (아래 after) → 승인 즉시 완료
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

    // 무거운 작업(시트 스왑 반영·상태 동기화·푸시)은 응답 후 백그라운드로 → 앱은 즉시 완료
    after(async () => {
      try {
        // 1) 시트 스왑 반영 (승인완료). 진짜 실패 시에만 관리자에게 경고 푸시.
        if (swapPreview) {
          const gasResult = await callGASWithCheck('applySwapFromData', [swapPreview]);
          if (!gasResult.ok && !gasResult.parseError) {
            console.error('[trades approve] 시트 적용 실패:', gasResult.msg);
            await sendPushToAdmins('⚠️ 시트 반영 실패', `${row.reqName}↔${row.subName} ${row.shiftDate} 교대는 승인됐으나 시트 반영에 실패했습니다. 수동 확인이 필요합니다.`);
          }
        }
        // 2) 상태별 푸시 알림
        if (ns === '협의중') {
          await sendPushToNames([row.reqName], '🙋 교대 지원', `${row.subName} 님이 ${row.shiftDate} 교대에 지원했습니다.`);
        } else if (ns === '승인대기') {
          await sendPushToAdmins('📋 교대 승인 요청', `${row.reqName} 님 ↔ ${row.subName} 님 ${row.shiftDate} 최종 승인이 필요합니다.`);
        } else if (ns === '반려됨') {
          await sendPushToNames([prevSubName], '😢 교대 거절', `${row.reqName} 님이 교대 신청을 거절했습니다.`);
        } else if (ns === '승인완료') {
          await sendPushToNames([row.reqName, row.subName], '✅ 교대 확정!', `${row.shiftDate} 교대가 최종 확정되었습니다.`);
          const approver = row.approvedBy ?? '관리자';
          const { data: adminRows } = await supabaseAdmin.from('admins').select('name').eq('active', true);
          const otherAdmins = (adminRows ?? [])
            .map((r: Record<string, any>) => r.name)
            .filter((n: string) => n !== approver);
          if (otherAdmins.length) {
            await sendPushToNames(otherAdmins, '✅ 교대 승인 완료', `${approver} 님이 ${row.reqName} 님 ↔ ${row.subName} 님 ${row.shiftDate} 교대를 승인했습니다.`);
          }
        } else if (ns === '모집중' && before?.status === '승인대기') {
          await sendPushToNames([row.reqName], '🔄 교대 반려', `관리자가 ${row.shiftDate} 교대 신청을 반려했습니다. 재모집 중입니다.`);
          if (prevSubName && prevSubName !== '모집중') {
            await sendPushToNames([prevSubName], '🔄 교대 반려', `${row.shiftDate} 교대 신청이 관리자에 의해 반려되었습니다.`);
          }
        }
        // 3) 요청DB(시트) 상태·수락자 동기화
        if (ns) {
          const gasUpdate: Record<string, any> = { status: ns };
          if (updateData.subName !== undefined) gasUpdate.subName = updateData.subName;
          if (updateData.subPos  !== undefined) gasUpdate.subPos  = updateData.subPos;
          if (updateData.desiredShift !== undefined) gasUpdate.desiredShift = updateData.desiredShift;
          const syncRes = await callGASWithCheck('updateTradeInDB', [id, gasUpdate]);
          if (!syncRes.ok) console.warn('[trades PATCH] GAS updateTradeInDB sync failed:', syncRes.msg);
        }
      } catch (e: any) {
        console.error('[trades PATCH after] 백그라운드 처리 오류:', e?.message);
      }
    });

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
