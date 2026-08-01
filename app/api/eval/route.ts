import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/session';
import { sendPushToAdmins } from '@/lib/push';
import { weekInPeriod, totalScore } from '@/lib/evalConfig';

function monthRange(period: string): [string, string] {
  const [y, m] = period.split('-').map(Number);
  return [new Date(y, m - 1, 1).toISOString(), new Date(y, m, 1).toISOString()];
}

async function computeAuto(period: string) {
  const { data: att } = await supabaseAdmin.from('attendance').select('name, week, late, absent');
  const lateMap: Record<string, number> = {}, absentMap: Record<string, number> = {};
  (att ?? []).forEach((r: any) => {
    if (weekInPeriod(r.week, period)) {
      lateMap[r.name] = (lateMap[r.name] || 0) + (Number(r.late) || 0);
      absentMap[r.name] = (absentMap[r.name] || 0) + (Number(r.absent) || 0);
    }
  });
  const [s, e] = monthRange(period);
  const { data: notices } = await supabaseAdmin.from('notices')
    .select('id').eq('require_signature', true).gte('created_at', s).lt('created_at', e);
  const nIds = (notices ?? []).map((n: any) => n.id);
  const signedMap: Record<string, number> = {};
  if (nIds.length) {
    const { data: sigs } = await supabaseAdmin.from('notice_signatures').select('name, notice_id').in('notice_id', nIds);
    (sigs ?? []).forEach((r: any) => { signedMap[r.name] = (signedMap[r.name] || 0) + 1; });
  }
  return { lateMap, absentMap, noticeReq: nIds.length, signedMap };
}
function ctxFor(name: string, a: any) {
  return { lateN: a.lateMap[name] || 0, absentN: a.absentMap[name] || 0, noticeReq: a.noticeReq, noticeSigned: a.signedMap[name] || 0 };
}
// 최고관리자 여부 (admins.is_super)
async function isSuper(name: string): Promise<boolean> {
  const { data } = await supabaseAdmin.from('admins').select('is_super').eq('name', name).maybeSingle();
  return !!(data && data.is_super);
}

export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: '관리자 권한 필요' }, { status: 403 });
  const sp = new URL(req.url).searchParams;
  const action = sp.get('action');

  if (action === 'managers') {
    if (!(await isSuper(admin.name))) return NextResponse.json({ error: '최고관리자만' }, { status: 403 });
    const { data } = await supabaseAdmin.from('admins').select('name').eq('active', true).order('name');
    return NextResponse.json((data ?? []).map((a: any) => a.name));
  }

  const period = sp.get('period');
  if (!period) return NextResponse.json({ error: 'period 필요' }, { status: 400 });

  if (action === 'overview') {
    const { data: per } = await supabaseAdmin.from('eval_periods').select('*').eq('period', period).maybeSingle();
    const { data: asg } = await supabaseAdmin.from('eval_assignments').select('*').eq('period', period);
    const { data: sc } = await supabaseAdmin.from('eval_scores').select('*').eq('period', period);
    const { data: roster } = await supabaseAdmin.from('misojigi').select('name').eq('active', true).order('name');
    const auto = await computeAuto(period);
    const autoByMiso: Record<string, any> = {};
    (asg ?? []).forEach((a: any) => { autoByMiso[a.miso_name] = ctxFor(a.miso_name, auto); });
    return NextResponse.json({
      me: admin.name,
      isSuper: await isSuper(admin.name),
      period: per || { period, status: 'none' },
      assignments: asg || [],
      scores: sc || [],
      roster: (roster ?? []).map((r: any) => r.name),
      auto: autoByMiso,
    });
  }

  if (action === 'result') {
    if (!(await isSuper(admin.name))) return NextResponse.json({ error: '최고관리자만' }, { status: 403 });
    const { data: asg } = await supabaseAdmin.from('eval_assignments').select('*').eq('period', period);
    const { data: sc } = await supabaseAdmin.from('eval_scores').select('*').eq('period', period);
    const auto = await computeAuto(period);
    const scMap: Record<string, any> = {}; (sc ?? []).forEach((x: any) => { scMap[x.miso_name] = x.grades || {}; });
    const rows: any[] = (asg ?? []).map((a: any) => {
      const ctx = ctxFor(a.miso_name, auto);
      return { miso: a.miso_name, manager: a.manager_name, total: totalScore(scMap[a.miso_name] || {}, ctx), scored: !!scMap[a.miso_name] };
    });
    rows.sort((x, y) => y.total - x.total);
    rows.forEach((r, i) => { r.rank = i + 1; });
    return NextResponse.json(rows);
  }

  return NextResponse.json({ error: 'action?' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: '관리자 권한 필요' }, { status: 403 });
  const b = await req.json();
  const superAdmin = await isSuper(admin.name);

  if (b.action === 'openPeriod' || b.action === 'closePeriod' || b.action === 'assign') {
    if (!superAdmin) return NextResponse.json({ error: '최고관리자만 가능합니다.' }, { status: 403 });
  }

  if (b.action === 'openPeriod') {
    await supabaseAdmin.from('eval_periods').upsert({ period: b.period, status: 'open', opened_at: new Date().toISOString(), closed_at: null }, { onConflict: 'period' });
    const [y, m] = b.period.split('-');
    await sendPushToAdmins('📋 월말평가 시작', `${y}년 ${+m}월 평가가 오픈됐습니다. 배정된 미소지기를 평가해주세요.`);
    return NextResponse.json({ ok: true });
  }
  if (b.action === 'closePeriod') {
    await supabaseAdmin.from('eval_periods').upsert({ period: b.period, status: 'closed', closed_at: new Date().toISOString() }, { onConflict: 'period' });
    const [y, m] = b.period.split('-');
    await sendPushToAdmins('✅ 월말평가 마감', `${y}년 ${+m}월 평가가 마감됐습니다. 순위가 확정됐습니다.`);
    return NextResponse.json({ ok: true });
  }
  if (b.action === 'assign') {
    const rows = b.assignments || [{ miso_name: b.miso, manager_name: b.manager }];
    const payload = rows.map((r: any) => ({ period: b.period, miso_name: r.miso_name || r.miso, manager_name: r.manager_name || r.manager }));
    const { error } = await supabaseAdmin.from('eval_assignments').upsert(payload, { onConflict: 'period,miso_name' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  if (b.action === 'score') {
    if (!superAdmin) {
      const { data: asg } = await supabaseAdmin.from('eval_assignments').select('manager_name').eq('period', b.period).eq('miso_name', b.miso).maybeSingle();
      if (!asg || asg.manager_name !== admin.name) return NextResponse.json({ error: '배정된 인원만 평가할 수 있습니다.' }, { status: 403 });
    }
    const { error } = await supabaseAdmin.from('eval_scores').upsert(
      { period: b.period, miso_name: b.miso, manager_name: admin.name, grades: b.grades || {}, updated_at: new Date().toISOString() },
      { onConflict: 'period,miso_name' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'action?' }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: '관리자 권한 필요' }, { status: 403 });
  const b = await req.json();
  if (b.action === 'assign') {
    if (!(await isSuper(admin.name))) return NextResponse.json({ error: '최고관리자만 가능합니다.' }, { status: 403 });
    await supabaseAdmin.from('eval_assignments').delete().eq('period', b.period).eq('miso_name', b.miso);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'action?' }, { status: 400 });
}
