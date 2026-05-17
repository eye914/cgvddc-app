import { NextRequest, NextResponse } from 'next/server';
import { sendPushToNames } from '@/lib/push';

// GAS 호출 (응답 수신) - 기존 doPost 패턴: { action, params: [...] }, 응답 { success, result }
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

// GET: 주차 목록, 주차별 계약서, 완료 트리
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
      // 새 함수 우선 호출, 미배포 시 기존 함수 폴백
      let data = await callGASJson('listContractsInWeek', [weekKey]);
      if (data && data.__gasError && String(data.__gasError).indexOf('알 수 없는 action') > -1) {
        data = await callGASJson('getContractsByWeek', [weekKey]);
      }
      return NextResponse.json(data);
    }
    if (mode === 'completed') {
      const data = await callGASJson('getCompletedContracts');
      return NextResponse.json(data);
    }
    return NextResponse.json({ error: 'mode 필요 (weeks|list|completed)' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST: 발송 알림 또는 서명 제출
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // 관리자: 계약서 발송 알림 (일괄/개별)
    if (action === 'send') {
      const { weekKey, names, requestedBy } = body;
      if (!weekKey || !Array.isArray(names) || names.length === 0) {
        return NextResponse.json({ error: 'weekKey, names[] 필요' }, { status: 400 });
      }
      await sendPushToNames(
        names,
        `📄 ${weekKey} 근로계약서`,
        `관리자(${requestedBy || '관리자'})가 근로계약서 서명을 요청했습니다. 앱에서 확인 후 서명해주세요.`
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
