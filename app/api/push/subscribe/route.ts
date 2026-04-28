import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { name, subscription } = await req.json();
    if (!name || !subscription) return NextResponse.json({ error: '이름과 구독 정보 필요' }, { status: 400 });

    // UNIQUE 제약 없이도 동작하도록 delete → insert 패턴 사용
    await supabaseAdmin.from('push_subscriptions').delete().eq('name', name);
    const { error } = await supabaseAdmin
      .from('push_subscriptions')
      .insert({ name, subscription: JSON.stringify(subscription) });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { name } = await req.json();
    await supabaseAdmin.from('push_subscriptions').delete().eq('name', name);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
