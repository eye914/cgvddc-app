import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAuth, requireAdmin } from '@/lib/session';
import { sendPushToNames } from '@/lib/push';

// GET:
//   ?mine=1        → 내가 서명한 notice_id 목록 (배지용)
//   ?notice_id=Y   → (관리자) 그 공지의 서명 현황 { signed:[{name,signed_at,signature}], unsigned:[name] }
export async function GET(req: NextRequest) {
  const sess = requireAuth(req);
  if (!sess) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const sp = new URL(req.url).searchParams;

  if (sp.get('mine') === '1') {
    const { data, error } = await supabaseAdmin.from('notice_signatures').select('notice_id').eq('name', sess.name);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json((data ?? []).map((r: any) => r.notice_id));
  }

  const noticeId = sp.get('notice_id');
  if (noticeId) {
    if (sess.role !== 'admin') return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    const { data: sigs } = await supabaseAdmin
      .from('notice_signatures').select('name, signed_at, signature').eq('notice_id', noticeId);
    const { data: staff } = await supabaseAdmin.from('misojigi').select('name').eq('active', true);
    const signedNames = new Set((sigs ?? []).map((s: any) => s.name));
    const unsigned = (staff ?? []).map((s: any) => s.name).filter((n: string) => !signedNames.has(n));
    return NextResponse.json({ signed: sigs ?? [], unsigned });
  }

  return NextResponse.json({ error: 'mine 또는 notice_id 필요' }, { status: 400 });
}

// POST:
//   { notice_id, signature }              → 미소지기 서명 제출 (이름=토큰)
//   { notice_id, action:'remind' }        → (관리자) 미확인자에게 푸시
export async function POST(req: NextRequest) {
  const sess = requireAuth(req);
  if (!sess) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const b = await req.json();
  if (!b.notice_id) return NextResponse.json({ error: 'notice_id 필요' }, { status: 400 });

  if (b.action === 'remind') {
    if (sess.role !== 'admin') return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    const { data: notice } = await supabaseAdmin.from('notices').select('title').eq('id', b.notice_id).single();
    const { data: sigs } = await supabaseAdmin.from('notice_signatures').select('name').eq('notice_id', b.notice_id);
    const { data: staff } = await supabaseAdmin.from('misojigi').select('name').eq('active', true);
    const signedNames = new Set((sigs ?? []).map((s: any) => s.name));
    const unsigned = (staff ?? []).map((s: any) => s.name).filter((n: string) => !signedNames.has(n));
    if (unsigned.length) await sendPushToNames(unsigned, '✍ 공지 확인 요청', (notice?.title ?? '공지') + ' — 확인 서명이 필요합니다.');
    return NextResponse.json({ ok: true, reminded: unsigned.length });
  }

  // 서명 제출 (미소지기)
  if (!b.signature) return NextResponse.json({ error: '서명 필요' }, { status: 400 });
  const { error } = await supabaseAdmin.from('notice_signatures').upsert(
    { notice_id: b.notice_id, name: sess.name, signature: b.signature, signed_at: new Date().toISOString() },
    { onConflict: 'notice_id,name' }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
