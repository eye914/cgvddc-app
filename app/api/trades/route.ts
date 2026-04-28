import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// GET: 전체 교대 목록
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('trades')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST: 새 교대 공고 등록
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { data, error } = await supabaseAdmin
    .from('trades')
    .insert([body])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 푸시 알림: 새 공고 등록 알림 (전체)
  await sendPushToAll('새 교대 공고', `${body.req_name}님이 ${body.shift_date} 교대 공고를 등록했습니다.`);

  return NextResponse.json(data);
}

// PATCH: 교대 상태 업데이트
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, ...updateData } = body;

  const { data, error } = await supabaseAdmin
    .from('trades')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 푸시 알림 분기
  if (updateData.status === '승인완료') {
    await sendPushToName(data.req_name, '교대 승인 완료', `${data.shift_date} 교대가 최종 승인되었습니다.`);
    await sendPushToName(data.sub_name, '교대 승인 완료', `${data.shift_date} 교대가 최종 승인되었습니다.`);
  } else if (updateData.status === '반려됨') {
    await sendPushToName(data.req_name, '교대 반려', `${data.shift_date} 교대 공고가 반려되었습니다.`);
  } else if (updateData.status === '협의중') {
    await sendPushToName(data.req_name, '교대 지원', `${data.sub_name}님이 ${data.shift_date} 교대에 지원했습니다.`);
  }

  return NextResponse.json(data);
}

// DELETE: 교대 공고 삭제
export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  const { error } = await supabaseAdmin.from('trades').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// 푸시 알림 헬퍼
async function sendPushToAll(title: string, body: string) {
  const { data } = await supabaseAdmin.from('push_subscriptions').select('*');
  if (!data) return;
  data.forEach((row: Record<string,any>) => sendWebPush(row.subscription, title, body));
}

async function sendPushToName(name: string, title: string, body: string) {
  const { data } = await supabaseAdmin
    .from('push_subscriptions')
    .select('*')
    .eq('name', name);
  if (!data) return;
  data.forEach((row: Record<string,any>) => sendWebPush(row.subscription, title, body));
}

async function sendWebPush(subscriptionStr: string, title: string, body: string) {
  try {
    const webpush = await import('web-push');
    webpush.setVapidDetails(
      'mailto:' + process.env.VAPID_EMAIL!,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    );
    await webpush.sendNotification(
      JSON.parse(subscriptionStr),
      JSON.stringify({ title, body, icon: '/icons/icon-192.png' })
    );
  } catch (e) {
    console.error('Push 발송 오류:', e);
  }
}
