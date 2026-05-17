import { NextRequest, NextResponse } from 'next/server';
import { sendPushToNames } from '@/lib/push';
import { supabaseAdmin } from '@/lib/supabase';

async function callGASJson(action: string, params: any[] = []) {
  const GAS_URL = process.env.GAS_URL;
  if (!GAS_URL) throw new Error('GAS_URL 미설정');
  const res = await fetch(GAS_URL, {
    method: 'POST',
    body: JSON.stringify({ action, params }),
  });
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    if (json.success) return json.result;
    return { __gasError: json.error || 'GAS 오류' };
  } catch {
    return { __gasError: 'GAS 응답 파싱 실패', raw: text };
  }
}

// GET: weeks | list | completed | my
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('mode');
    const weekKey = searchParams.get('weekKey') || '';

    if (mode === 'weeks') {
      const data = await callGASJson('getContractWeeks');
      return NextResponse.json(data);
    }
    if (mode === 'list') {
      if (!weekKey) return NextResponse.json({ error: 'weekKey 필요' }, { status: 400 });
      let data = await callGASJson('listContractsInWeek', [weekKey]);
      if (data && data.__gasError && String(data.__gasError).indexOf('알 수 없는 action') > -1) {
        data = await callGASJson('getContractsByWeek', [weekKey]);
      }
      return NextResponse.json(data);
    }
    if (mode === 'completed') {
      // 새 함수 우선, 미배포 시 구 함수 폴백
      let data = await callGASJson('listCompletedContractsV2');
      if (data && data.__gasError && String(data.__gasError).indexOf('알 수 없는 action') > -1) {
        data = await callGASJson('getCompletedContracts');
      }
      return NextResponse.json(data);
    }
    // ★ 관리자: 주차별 발송 상태 (누가/언제/서명여부)
    if (mode === 'status') {
      if (!weekKey) return NextResponse.json({ error: 'weekKey 필요' }, { status: 400 });
      const { data, error } = await supabaseAdmin
        .from('contract_requests')
        .select('recipient_name, sent_by, sent_at, signed_at')
        .eq('week_key', weekKey);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      const out = (data ?? []).map((r: any) => ({
        name: r.recipient_name,
        sentBy: r.sent_by,
        sentAt: r.sent_at,
        signedAt: r.signed_at,
      }));
      return NextResponse.json(out);
    }

    // ★ 내 계약서: 발송된 것 모두 (미서명+서명완료). 프론트에서 상태 구분
    if (mode === 'my') {
      const name = searchParams.get('name');
      if (!name) return NextResponse.json({ error: 'name 필요' }, { status: 400 });
      const { data, error } = await supabaseAdmin
        .from('contract_requests')
        .select('id, week_key, doc_id, recipient_name, file_name, sent_at, signed_at')
        .eq('recipient_name', name)
        .order('sent_at', { ascending: false });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      const out = (data ?? []).map((r: any) => ({
        id: r.id,
        weekKey: r.week_key,
        docId: r.doc_id,
        name: r.recipient_name,
        fileName: r.file_name,
        sentAt: r.sent_at,
        signedAt: r.signed_at,
      }));
      return NextResponse.json(out);
    }
    return NextResponse.json({ error: 'mode 필요 (weeks|list|completed|my)' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST: send (발송 기록 + 알림) | sign (서명 + 기록 업데이트)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // 관리자: 계약서 발송
    if (action === 'send') {
      const { weekKey, names, requestedBy } = body;
      if (!weekKey || !Array.isArray(names) || names.length === 0) {
        return NextResponse.json({ error: 'weekKey, names[] 필요' }, { status: 400 });
      }
      // 1) 해당 주차의 docs 조회 (이름 → docId 매핑)
      let docList = await callGASJson('listContractsInWeek', [weekKey]);
      if (docList && docList.__gasError) {
        docList = await callGASJson('getContractsByWeek', [weekKey]);
      }
      const docMap: Record<string, { docId: string; fileName: string }> = {};
      if (Array.isArray(docList)) {
        docList.forEach((d: any) => { if (d?.name) docMap[d.name] = { docId: d.docId, fileName: d.fileName }; });
      }
      // 2) Supabase 에 발송 기록 (upsert로 중복 방지)
      const rows = names.map((nm: string) => ({
        week_key: weekKey,
        recipient_name: nm,
        doc_id: docMap[nm]?.docId ?? null,
        file_name: docMap[nm]?.fileName ?? null,
        sent_by: requestedBy ?? '관리자',
        sent_at: new Date().toISOString(),
        signed_at: null,
      }));
      const { error: upErr } = await supabaseAdmin
        .from('contract_requests')
        .upsert(rows, { onConflict: 'week_key,recipient_name', ignoreDuplicates: false });
      if (upErr) return NextResponse.json({ error: 'DB 기록 실패: ' + upErr.message }, { status: 500 });

      // 3) 푸시 알림
      await sendPushToNames(
        names,
        `📄 ${weekKey} 근로계약서`,
        `관리자(${requestedBy || '관리자'})가 근로계약서 서명을 요청했습니다.`
      );
      return NextResponse.json({ ok: true, sentTo: names });
    }

    // 미소지기: 서명 제출
    if (action === 'sign') {
      const { docId, name, weekKey, nameImage, sigImage } = body;
      if (!docId || !name || !weekKey || !nameImage || !sigImage) {
        return NextResponse.json({ error: '필수 필드 누락' }, { status: 400 });
      }
      const result = await callGASJson('signContract', [{
        docId, name, weekKey, nameImage, sigImage,
      }]);
      if (result && result.ok) {
        // ★ 서명 완료 기록
        await supabaseAdmin
          .from('contract_requests')
          .update({ signed_at: new Date().toISOString() })
          .eq('week_key', weekKey)
          .eq('recipient_name', name);

        await sendPushToNames(
          ['이상순'],
          `✍️ 계약서 서명 완료`,
          `${name}님이 ${weekKey} 근로계약서에 서명을 완료했습니다.`
        );
      }
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: '알 수 없는 action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
