import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendPushToNames, sendPushToAdmins } from '@/lib/push';

async function callGAS(action: string, params: any[]) {
  const GAS_URL = process.env.GAS_URL;
  if (!GAS_URL) return;
  try { await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action, params }) }); } catch (_) {}
}

function makeId(prefix: string) {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
  const rand = Math.random().toString(36).substring(2,6).toUpperCase();
  return `${prefix}-${date}-${rand}`;
}

const TYPE_NAMES: Record<string, string> = {
  late: '지각확인서',
  absent: '결근사유서',
  resign: '사직원',
  earlyLeave: '희망조퇴확인서',
  privacy: '개인정보보호 서약서',
  overtime: '연장·야간·휴일 근로동의서',
  workCondition: '근로조건 변경동의서',
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get('name');
  const mode = searchParams.get('mode'); // 'submissions' or default requests

  try {
    if (mode === 'submissions') {
      const q = supabaseAdmin
        .from('form_submissions')
        .select('*')
        .order('submitted_at', { ascending: false });
      if (name) q.eq('target_name', name);
      const { data, error } = await q;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json(data ?? []);
    }

    const q = supabaseAdmin
      .from('form_requests')
      .select('*')
      .order('requested_at', { ascending: false });
    if (name) q.eq('target_name', name);
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { type, targetName, requestedBy, note } = await req.json();

    if (!type || !targetName || !requestedBy) {
      return NextResponse.json({ error: '필수 필드 누락' }, { status: 400 });
    }

    const id = makeId('FRM');
    const { data, error } = await supabaseAdmin
      .from('form_requests')
      .insert([{
        id,
        type,
        target_name: targetName,
        requested_by: requestedBy,
        note: note || '',
        status: 'pending',
      }])
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const typeName = TYPE_NAMES[type] || '서류';
    await sendPushToNames(
      [targetName],
      `📋 ${typeName} 제출 요청`,
      `관리자(${requestedBy})가 ${typeName} 제출을 요청했습니다. 3일 이내에 제출해주세요.`,
      '/?go=forms'   // 알림 클릭 → 내 서류함
    );
    // GAS 사유서DB 기록
    await callGAS('saveFormRequestToDB', [{ type, targetName, requestedBy, note: note || '' }]);

    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, action, formData } = await req.json();
    if (!id || !action) return NextResponse.json({ error: 'id, action 필요' }, { status: 400 });

    if (action === 'submit') {
      const { data: reqRow, error: fetchErr } = await supabaseAdmin
        .from('form_requests')
        .select('type, target_name, requested_by')
        .eq('id', id)
        .single();

      if (fetchErr || !reqRow) {
        return NextResponse.json({ error: '요청을 찾을 수 없습니다.' }, { status: 404 });
      }

      const subId = makeId('SUB');
      const { error: subError } = await supabaseAdmin
        .from('form_submissions')
        .insert([{
          id: subId,
          request_id: id,
          type: reqRow.type,
          target_name: reqRow.target_name,
          form_data: formData,
        }]);

      if (subError) return NextResponse.json({ error: subError.message }, { status: 500 });

      const { error } = await supabaseAdmin
        .from('form_requests')
        .update({ status: 'submitted' })
        .eq('id', id);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      const typeName = TYPE_NAMES[reqRow.type] || '서류';
      if (reqRow.requested_by) {
        await sendPushToNames(
          [reqRow.requested_by],
          `✅ ${typeName} 제출됨`,
          `${reqRow.target_name}님이 ${typeName}를 제출했습니다.`
        );
      }
      // GAS 사유서DB 상태 업데이트
      await callGAS('updateFormStatusInDB', [reqRow.target_name, reqRow.type, 'submitted']);

      return NextResponse.json({ ok: true, submissionId: subId });
    }

    // 관리자: 미제출자에게 다시 알림(재전송/독촉)
    if (action === 'remind') {
      const { data: r } = await supabaseAdmin
        .from('form_requests')
        .select('type, target_name, status, requested_at')
        .eq('id', id)
        .single();
      if (!r) return NextResponse.json({ error: '요청을 찾을 수 없습니다.' }, { status: 404 });
      if (r.status !== 'pending') {
        return NextResponse.json({ error: '이미 제출된 요청입니다.' }, { status: 400 });
      }
      const typeName = TYPE_NAMES[r.type] || '서류';
      let msg = `${typeName} 제출이 아직 완료되지 않았습니다.`;
      if (r.requested_at) {
        const due = new Date(r.requested_at); due.setDate(due.getDate() + 3);
        const over = Date.now() > due.getTime();
        msg = over
          ? `${typeName} 제출 기한이 지났습니다. 오늘 중으로 제출해주세요.`
          : `${typeName} 제출 기한은 ${due.getMonth() + 1}/${due.getDate()} 까지입니다.`;
      }
      await sendPushToNames([r.target_name], `🔔 ${typeName} 제출 요청 (재알림)`, msg, '/?go=forms');
      return NextResponse.json({ ok: true, name: r.target_name });
    }

    if (action === 'viewed') {
      const { error } = await supabaseAdmin
        .from('form_requests')
        .update({ status: 'viewed' })
        .eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (action === 'cancel') {
      const { error } = await supabaseAdmin
        .from('form_requests')
        .delete()
        .eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: '알 수 없는 action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
