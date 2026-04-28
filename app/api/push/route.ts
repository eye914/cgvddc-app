import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// 푸시 구독 등록
export async function POST(req: NextRequest) {
  const { name, subscription } = await req.json();
  if (!name || !subscription) {
    return NextResponse.json({ error: '이름과 구독 정보가 필요합니다.' }, { status: 400 });
  }

  // 기존 구독 삭제 후 새로 등록 (같은 이름)
  await supabaseAdmin.from('push_subscriptions').delete().eq('name', name);

  const { error } = await supabaseAdmin
    .from('push_subscriptions')
    .insert([{ name, subscription: JSON.stringify(subscription) }]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// 구독 해제
export async function DELETE(req: NextRequest) {
  const { name } = await req.json();
  const { error } = await supabaseAdmin
    .from('push_subscriptions')
    .delete()
    .eq('name', name);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
