import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAuth, requireAdmin } from '@/lib/session';
import { sendPushToNames, sendPushToAllExcept, sendPushToAdmins } from '@/lib/push';

const POSITIONS = ['매점', '플로어', '통합'] as const;
type Pos = (typeof POSITIONS)[number];

const quotaKey = (p: string) =>
  p === '매점' ? 'quota_store' : p === '플로어' ? 'quota_floor' : 'quota_total';

function makeId() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `RST-${ymd}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

// "8/23(토)" 형태 라벨
function dateLabel(ymd: string) {
  const [y, m, d] = String(ymd).split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${m}/${d}(${['일', '월', '화', '수', '목', '금', '토'][dt.getDay()]})`;
}

// 정원 문구: "매점 1명 · 플로어 1명"
function quotaText(p: any) {
  return POSITIONS
    .map((pos) => ({ pos, n: Number(p[quotaKey(pos)]) || 0 }))
    .filter((x) => x.n > 0)
    .map((x) => `${x.pos} ${x.n}명`)
    .join(' · ');
}

// 마감 시각: 근무일 당일 09:00 (KST = UTC+9 → UTC 00:00)
function deadlineOf(ymd: string) {
  return new Date(`${ymd}T00:00:00.000Z`).toISOString();
}

async function claimsOf(postId: string) {
  const { data } = await supabaseAdmin
    .from('restday_claims')
    .select('*')
    .eq('post_id', postId)
    .neq('status', 'canceled');
  return data ?? [];
}

// GET: list(관리자 현황) | open(미소지기용 모집중) | mine
export async function GET(req: NextRequest) {
  const sess = requireAuth(req);
  if (!sess) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const mode = sp.get('mode') || 'open';

  const { data: posts } = await supabaseAdmin
    .from('restday_posts')
    .select('*')
    .order('work_date', { ascending: false })
    .limit(mode === 'list' ? 60 : 20);

  const list = posts ?? [];
  if (!list.length) return NextResponse.json([]);

  const { data: allClaims } = await supabaseAdmin
    .from('restday_claims')
    .select('*')
    .in('post_id', list.map((p: any) => p.id))
    .neq('status', 'canceled');

  const byPost: Record<string, any[]> = {};
  (allClaims ?? []).forEach((c: any) => { (byPost[c.post_id] ||= []).push(c); });

  const now = Date.now();
  const rows = list.map((p: any) => {
    const cs = byPost[p.id] ?? [];
    const filled: Record<string, number> = {};
    POSITIONS.forEach((pos) => { filled[pos] = cs.filter((c) => c.position === pos).length; });
    return {
      id: p.id,
      workDate: p.work_date,
      label: dateLabel(p.work_date),
      shiftCode: p.shift_code || '',
      deadline: p.deadline,
      expired: new Date(p.deadline).getTime() <= now,
      status: p.status,
      createdBy: p.created_by,
      quota: { 매점: p.quota_store || 0, 플로어: p.quota_floor || 0, 통합: p.quota_total || 0 },
      filled,
      claims: cs.map((c) => ({
        id: c.id, name: c.name, position: c.position, status: c.status,
        claimedAt: c.claimed_at, approvedBy: c.approved_by, sheetDone: c.sheet_done,
      })),
    };
  });

  if (mode === 'mine') {
    const me = sp.get('name') || sess.name;
    return NextResponse.json(rows.filter((r: any) => r.claims.some((c: any) => c.name === me)));
  }
  if (mode === 'open') {
    // 미소지기: 아직 마감 전이고 열려 있는 것만
    return NextResponse.json(rows.filter((r: any) => r.status === 'open' && !r.expired));
  }
  return NextResponse.json(rows);   // list (관리자 현황)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // ── 미소지기: 선착순 신청 ──
    if (action === 'claim') {
      const sess = requireAuth(req);
      if (!sess) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
      const { postId, position } = body;
      const name = body.name || sess.name;
      if (!postId || !position || !name) return NextResponse.json({ error: '필수 값 누락' }, { status: 400 });
      if (!POSITIONS.includes(position)) return NextResponse.json({ error: '포지션이 올바르지 않습니다.' }, { status: 400 });

      const { data: post } = await supabaseAdmin.from('restday_posts').select('*').eq('id', postId).single();
      if (!post) return NextResponse.json({ error: '모집을 찾을 수 없습니다.' }, { status: 404 });
      if (post.status !== 'open') return NextResponse.json({ error: '이미 마감된 모집입니다.' }, { status: 400 });
      if (new Date(post.deadline).getTime() <= Date.now()) {
        return NextResponse.json({ error: '신청이 마감되었습니다. (당일 오전 9시 마감)' }, { status: 400 });
      }
      const quota = Number(post[quotaKey(position)]) || 0;
      if (quota <= 0) return NextResponse.json({ error: `${position} 은(는) 모집하지 않습니다.` }, { status: 400 });

      // 선착순 자리 확보: 먼저 insert 하고, 초과분이면 되돌린다.
      //   unique(post_id, name) 이 중복 신청을 막아준다.
      const { data: ins, error: insErr } = await supabaseAdmin
        .from('restday_claims')
        .insert({ post_id: postId, position, name })
        .select('id')
        .single();
      if (insErr) {
        const dup = String(insErr.message || '').includes('duplicate') || (insErr as any).code === '23505';
        return NextResponse.json({ error: dup ? '이미 신청하셨습니다.' : insErr.message }, { status: 400 });
      }

      // 내 순번이 정원 안인지 확인 (동시 신청 시 초과분 정리)
      const { data: sameRows } = await supabaseAdmin
        .from('restday_claims')
        .select('id')
        .eq('post_id', postId)
        .eq('position', position)
        .neq('status', 'canceled')
        .order('id', { ascending: true });
      const order = (sameRows ?? []).findIndex((r: any) => r.id === ins.id);
      if (order < 0 || order >= quota) {
        await supabaseAdmin.from('restday_claims').delete().eq('id', ins.id);
        return NextResponse.json({ error: '정원이 마감되었습니다.', full: true }, { status: 409 });
      }

      // 이 신청으로 전 포지션이 다 찼는지 확인 → 다 찼으면 마감 처리 + 탈락 통지 대상 없음
      const cs = await claimsOf(postId);
      const allFull = POSITIONS.every((pos) => {
        const q = Number(post[quotaKey(pos)]) || 0;
        return q === 0 || cs.filter((c: any) => c.position === pos).length >= q;
      });
      if (allFull) {
        await supabaseAdmin.from('restday_posts').update({ status: 'closed' }).eq('id', postId);
      }

      await sendPushToNames([name], '✅ 쉼데이 신청 완료',
        `${dateLabel(post.work_date)} ${position} 쉼데이를 신청했습니다. 승인 후 확인서가 발송됩니다.`);
      await sendPushToAdmins('🌿 쉼데이 신청',
        `${name} 님이 ${dateLabel(post.work_date)} ${position} 쉼데이를 신청했습니다.`);
      return NextResponse.json({ ok: true, closed: allFull });
    }

    // ── 관리자 전용 ──
    const admin = requireAdmin(req);
    if (!admin) return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });

    // 모집 등록
    if (action === 'create') {
      const { workDate, shiftCode, quota } = body;
      if (!workDate) return NextResponse.json({ error: '날짜 필요' }, { status: 400 });
      const q = quota || {};
      const store = Number(q['매점']) || 0, floor = Number(q['플로어']) || 0, total = Number(q['통합']) || 0;
      if (store + floor + total <= 0) return NextResponse.json({ error: '정원을 1명 이상 설정하세요.' }, { status: 400 });

      const row = {
        id: makeId(),
        work_date: workDate,
        shift_code: shiftCode || '',
        quota_store: store, quota_floor: floor, quota_total: total,
        deadline: deadlineOf(workDate),
        status: 'open',
        created_by: admin.name,
      };
      const { error } = await supabaseAdmin.from('restday_posts').insert(row);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      await sendPushToAllExcept([], '🌿 쉼데이 신청받습니다',
        `${dateLabel(workDate)} ${quotaText(row)}\n선착순 · 오늘 오전 9시 마감`);
      return NextResponse.json({ ok: true, id: row.id });
    }

    // 승인 (확인서 발송은 별도 단계에서 연결)
    if (action === 'approve') {
      const { claimId } = body;
      if (!claimId) return NextResponse.json({ error: 'claimId 필요' }, { status: 400 });
      const { data: c } = await supabaseAdmin.from('restday_claims').select('*').eq('id', claimId).single();
      if (!c) return NextResponse.json({ error: '신청을 찾을 수 없습니다.' }, { status: 404 });
      if (c.status === 'approved') return NextResponse.json({ ok: true, duplicate: true });

      const { data: claimed } = await supabaseAdmin
        .from('restday_claims')
        .update({ status: 'approved', approved_by: admin.name, approved_at: new Date().toISOString() })
        .eq('id', claimId).eq('status', 'claimed').select('id');
      if (!claimed || !claimed.length) return NextResponse.json({ ok: true, duplicate: true });

      const { data: post } = await supabaseAdmin.from('restday_posts').select('work_date').eq('id', c.post_id).single();
      await sendPushToNames([c.name], '✅ 쉼데이 확정',
        `${post ? dateLabel(post.work_date) : ''} 쉼데이가 확정됐습니다.\n확인서 서명 요청이 곧 발송됩니다.`);
      return NextResponse.json({ ok: true });
    }

    // 마감 (수동) — 탈락자 통지
    if (action === 'close') {
      const { postId } = body;
      if (!postId) return NextResponse.json({ error: 'postId 필요' }, { status: 400 });
      const { data: post } = await supabaseAdmin.from('restday_posts').select('*').eq('id', postId).single();
      if (!post) return NextResponse.json({ error: '모집을 찾을 수 없습니다.' }, { status: 404 });
      await supabaseAdmin.from('restday_posts').update({ status: 'closed' }).eq('id', postId);
      return NextResponse.json({ ok: true });
    }

    // 신청 취소 / 반려
    if (action === 'cancelClaim') {
      const { claimId } = body;
      if (!claimId) return NextResponse.json({ error: 'claimId 필요' }, { status: 400 });
      const { data: c } = await supabaseAdmin.from('restday_claims').select('*').eq('id', claimId).single();
      await supabaseAdmin.from('restday_claims').update({ status: 'canceled' }).eq('id', claimId);
      if (c) {
        const { data: post } = await supabaseAdmin.from('restday_posts').select('work_date').eq('id', c.post_id).single();
        await sendPushToNames([c.name], '🙏 쉼데이 취소',
          `${post ? dateLabel(post.work_date) : ''} 쉼데이 신청이 취소되었습니다.`);
      }
      return NextResponse.json({ ok: true });
    }

    // 모집 삭제
    if (action === 'delete') {
      const { postId } = body;
      if (!postId) return NextResponse.json({ error: 'postId 필요' }, { status: 400 });
      await supabaseAdmin.from('restday_posts').delete().eq('id', postId);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: '알 수 없는 action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
