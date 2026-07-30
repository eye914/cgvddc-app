import { supabaseAdmin } from '@/lib/supabase';

// data:URL(base64) → Storage 업로드 → public URL. 이미 http URL이면 그대로 통과.
export async function uploadImages(images: string[], bucket = 'manuals'): Promise<string[]> {
  const out: string[] = [];
  for (const img of images || []) {
    if (!img) continue;
    if (/^https?:\/\//.test(img)) { out.push(img); continue; }
    const m = String(img).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!m) continue;
    const ext = m[1].split('/')[1].replace('jpeg', 'jpg');
    const buf = Buffer.from(m[2], 'base64');
    const path = `${bucket}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabaseAdmin.storage.from(bucket).upload(path, buf, { contentType: m[1], upsert: false });
    if (error) throw new Error('이미지 업로드 실패: ' + error.message);
    const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
    out.push(data.publicUrl);
  }
  return out;
}
