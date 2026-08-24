import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAuth, requireAdmin } from '@/lib/session';

// data:URL(base64) → Storage 업로드 → public URL. 이미 http URL이면 그대로 통과.
async function uploadImages(images: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const img of images || []) {
    if (!img) continue;
    if (/^https?:\/\//.test(img)) { out.push(img); continue; }
    const m = String(img).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!m) continue;
    const ext = m[1].split('/')[1].replace('jpeg', 'jpg');
    const buf = Buffer.from(m[2], 'base64');
    const path = `manuals/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabaseAdmin.storage.from('manuals').upload(path, buf, { contentType: m[1], upsert: false });
    if (error) throw new Error('이미지 업로드 실패: ' + error.message);
    const { data } = supabaseAdmin.storage.from('manuals').getPublicUrl(path);
    out.push(data.publicUrl);
  }
  return out;
}

// GET: 전체 매뉴얼 (로그인 필요). 카테고리·유형 필터는 클라이언트에서.
export async function GET(req: NextRequest) {
  const sess = requireAuth(req);
  if (!sess) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const { data, error } = await supabaseAdmin.from('manuals').select('*').order('sort', { ascending: true }).order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST: 새 매뉴얼 (관리자)
export async function POST(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  try {
    const b = await req.json();
    if (!b.title) return NextResponse.json({ error: '제목 필요' }, { status: 400 });
    const images = await uploadImages(b.images || []);
    const row = {
      title: String(b.title).trim(),
      body: String(b.body ?? ''),
      category: b.category ?? '매점',
      type: b.type ?? '일반',
      images,
      sort: Number(b.sort) || 0,
      author: admin.name || '관리자',
    };
    // ★ author 컬럼이 없는 DB에서도 매뉴얼 등록은 반드시 되어야 한다 → 실패 시 author 제외 재시도
    let { data, error } = await supabaseAdmin.from('manuals').insert(row).select().single();
    if (error) {
      console.warn('[manuals] author 포함 등록 실패 → author 제외하고 재시도:', error.message);
      const { author, ...noAuthor } = row as any;
      const retry = await supabaseAdmin.from('manuals').insert(noAuthor).select().single();
      data = retry.data; error = retry.error;
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, manual: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PATCH: 수정 (관리자) — images에 새 base64 있으면 업로드 후 병합
export async function PATCH(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  try {
    const b = await req.json();
    const { id, ...updates } = b;
    if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 });
    if (Array.isArray(updates.images)) updates.images = await uploadImages(updates.images);
    const { error } = await supabaseAdmin.from('manuals').update(updates).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE: 삭제 (관리자)
export async function DELETE(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 });
  const { error } = await supabaseAdmin.from('manuals').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
