import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { name, subscription } = await req.json();
    if (!name || !subscription) return NextResponse.json({ error: '이름과 구독 정보 필요' }, { status: 400 });

    const { error } = await supabaseAdmin
      .from('push_subscriptions')
      .upsert({ name, subscription: JSON.stringify(subscription) }, { onConflict: 'name' });

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
