import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAuth, requireAdmin } from '@/lib/session';
import { sendPushToAllExcept } from '@/lib/push';
import { uploadImages } from '@/lib/storage';

function todayStr(): string {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// 노출기간 판정: (시작 없음 or 시작<=오늘) and (종료 없음 or 종료>=오늘)
function isVisible(n: any, today: string): boolean {
  if (n.start_date && String(n.start_date) > today) return false;
  if (n.end_date && String(n.end_date) < today) return false;
  return true;
}

// GET: 목록. 미소지기=노출중인 것만, 관리자(all=1)=전체
export async function GET(req: NextRequest) {
  const sess = requireAuth(req);
  if (!sess) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const all = new URL(req.url).searchParams.get('all') === '1' && sess.role === 'admin';
  const { data, error } = await supabaseAdmin.from('notices').select('*').order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const today = todayStr();
  let list = data ?? [];
  if (!all) list = list.filter((n: any) => isVisible(n, today));
  // 핀 고정 우선 정렬
  list.sort((a: any, b: any) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
  return NextResponse.json(list);
}

// POST: 새 공지 (관리자)
export async function POST(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });

  const b = await req.json();
  if (!b.title) return NextResponse.json({ error: '제목 필요' }, { status: 400 });

  const row = {
    title: String(b.title).trim(),
    body: String(b.body ?? ''),
    category: b.category ?? '전체',
    start_date: b.start_date || null,
    end_date: b.end_date || null,
    pinned: !!b.pinned,
    important: !!b.important,
    require_signature: !!b.require_signature,
    images: await uploadImages(b.images || []),
  };
  const { data, error } = await supabaseAdmin.from('notices').insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 중요 공지 → 전체 푸시
  if (row.important) {
    const sigTxt = row.require_signature ? ' (확인 서명 필요)' : '';
    await sendPushToAllExcept([], '📢 중요 공지', row.title + sigTxt);
  }
  return NextResponse.json({ ok: true, notice: data });
}

// PATCH: 수정 (관리자)
export async function PATCH(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });

  const b = await req.json();
  const { id, ...updates } = b;
  if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 });
  if ('start_date' in updates) updates.start_date = updates.start_date || null;
  if ('end_date' in updates) updates.end_date = updates.end_date || null;
  if (Array.isArray(updates.images)) updates.images = await uploadImages(updates.images);

  const { error } = await supabaseAdmin.from('notices').update(updates).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE: 삭제 (관리자)
export async function DELETE(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 });
  const { error } = await supabaseAdmin.from('notices').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
