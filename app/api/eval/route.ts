import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAuth, requireAdmin } from '@/lib/session';
import { sendPushToAdmins, sendPushToAllExcept } from '@/lib/push';
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
  // 대타/교대 수락(적극적 참여): 승인완료된 공고 중 수락자(sub_name)가 그 사람이고, 근무일이 해당 월인 건 수
  const { data: trades } = await supabaseAdmin.from('trades').select('sub_name, status, shift_date').eq('status', '승인완료');
  const subMap: Record<string, number> = {};
  const pm = period.split('-')[1]; // "08"
  (trades ?? []).forEach((t: any) => {
    const nm = String(t.sub_name || '').trim();
    if (!nm || nm === '모집중') return;
    const m = String(t.shift_date || '').match(/(\d{1,2})\s*\//);
    if (m && String(Number(m[1])).padStart(2, '0') === pm) subMap[nm] = (subMap[nm] || 0) + 1;
  });
  return { lateMap, absentMap, noticeReq: nIds.length, signedMap, subMap };
}
function ctxFor(name: string, a: any) {
  return { lateN: a.lateMap[name] || 0, absentN: a.absentMap[name] || 0, noticeReq: a.noticeReq, noticeSigned: a.signedMap[name] || 0, subN: (a.subMap && a.subMap[name]) || 0 };
}
// 동점 처리: 총점↓ → 결근↑(적은) → 지각↑(적은) → 공지서명률↓(높은) → 이름
function tieCmp(x: any, y: any): number {
  return (y.total - x.total) || (x._ab - y._ab) || (x._la - y._la) || (y._nr - x._nr) || String(x.miso).localeCompare(String(y.miso), 'ko');
}
// 최고관리자 여부 (admins.is_super)
async function isSuper(name: string): Promise<boolean> {
  const { data } = await supabaseAdmin.from('admins').select('is_super').eq('name', name).maybeSingle();
  return !!(data && data.is_super);
}

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const action = sp.get('action');

  // 리더보드: 공개(비로그인 포함) — 마감된 기간만, 순위+이름+총점만(담당자·세부점수 비공개)
  if (action === 'leaderboard') {
    let period = sp.get('period') || '';
    if (!period) {
      const { data } = await supabaseAdmin.from('eval_periods').select('period').eq('status', 'closed').order('period', { ascending: false }).limit(1).maybeSingle();
      period = data?.period || '';
    }
    if (!period) return NextResponse.json({ period: null, rows: [] });
    const { data: per } = await supabaseAdmin.from('eval_periods').select('status').eq('period', period).maybeSingle();
    if (!per || per.status !== 'closed') return NextResponse.json({ period, rows: [] });
    const { data: asg } = await supabaseAdmin.from('eval_assignments').select('miso_name').eq('period', period);
    const { data: sc } = await supabaseAdmin.from('eval_scores').select('miso_name, grades').eq('period', period);
    const auto = await computeAuto(period);
    const scMap: Record<string, any> = {}; (sc ?? []).forEach((x: any) => { scMap[x.miso_name] = x.grades || {}; });
    const rows: any[] = (asg ?? []).map((a: any) => {
      const c = ctxFor(a.miso_name, auto);
      return { miso: a.miso_name, total: totalScore(scMap[a.miso_name] || {}, c), _ab: c.absentN, _la: c.lateN, _nr: c.noticeReq ? c.noticeSigned / c.noticeReq : 1 };
    });
    rows.sort(tieCmp);
    rows.forEach((r, i) => { r.rank = i + 1; });
    const { data: rc } = await supabaseAdmin.from('eval_rookies').select('miso_name').eq('period', period);
    const cand = new Set((rc ?? []).map((r: any) => r.miso_name));
    const rookieRow = rows.find((r: any) => cand.has(r.miso));
    return NextResponse.json({ period, rows: rows.map((r: any) => ({ rank: r.rank, miso: r.miso, total: r.total })), rookie: rookieRow ? rookieRow.miso : null });
  }

  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: '관리자 권한 필요' }, { status: 403 });

  if (action === 'managers') {
    if (!(await isSuper(admin.name))) return NextResponse.json({ error: '최고관리자만' }, { status: 403 });
    const { data } = await supabaseAdmin.from('admins').select('*').eq('active', true);
    const rows = (data ?? []).slice().sort((a: any, b: any) =>
      ((a.sort ?? 100) - (b.sort ?? 100)) || String(a.name).localeCompare(String(b.name), 'ko'));
    return NextResponse.json(rows.map((a: any) => a.name));
  }

  const period = sp.get('period');
  if (!period) return NextResponse.json({ error: 'period 필요' }, { status: 400 });

  if (action === 'overview') {
    const { data: per } = await supabaseAdmin.from('eval_periods').select('*').eq('period', period).maybeSingle();
    const { data: asg } = await supabaseAdmin.from('eval_assignments').select('*').eq('period', period);
    const { data: sc } = await supabaseAdmin.from('eval_scores').select('*').eq('period', period);
    const { data: roster } = await supabaseAdmin.from('misojigi').select('name').eq('active', true).order('name');
    const { data: tg } = await supabaseAdmin.from('eval_targets').select('miso_name').eq('period', period);
    const { data: rc } = await supabaseAdmin.from('eval_rookies').select('miso_name').eq('period', period);
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
      targets: (tg ?? []).map((t: any) => t.miso_name),
      rookieCandidates: (rc ?? []).map((r: any) => r.miso_name),
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
      return { miso: a.miso_name, manager: a.manager_name, total: totalScore(scMap[a.miso_name] || {}, ctx), scored: !!scMap[a.miso_name], _ab: ctx.absentN, _la: ctx.lateN, _nr: ctx.noticeReq ? ctx.noticeSigned / ctx.noticeReq : 1 };
    });
    rows.sort(tieCmp);
    rows.forEach((r, i) => { r.rank = i + 1; });
    const { data: rc } = await supabaseAdmin.from('eval_rookies').select('miso_name').eq('period', period);
    const cand = new Set((rc ?? []).map((r: any) => r.miso_name));
    const rookieRow = rows.find((r: any) => cand.has(r.miso));
    return NextResponse.json({ rows, rookie: rookieRow ? rookieRow.miso : null });
  }

  return NextResponse.json({ error: 'action?' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: '관리자 권한 필요' }, { status: 403 });
  const b = await req.json();
  const superAdmin = await isSuper(admin.name);

  if (b.action === 'openPeriod' || b.action === 'closePeriod' || b.action === 'assign' || b.action === 'setTargets' || b.action === 'setRookieCandidates') {
    if (!superAdmin) return NextResponse.json({ error: '최고관리자만 가능합니다.' }, { status: 403 });
  }

  if (b.action === 'setRookieCandidates') {
    await supabaseAdmin.from('eval_rookies').delete().eq('period', b.period);
    const rows = (b.misos || []).map((n: string) => ({ period: b.period, miso_name: n }));
    if (rows.length) {
      const { error } = await supabaseAdmin.from('eval_rookies').insert(rows);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (b.action === 'setTargets') {
    await supabaseAdmin.from('eval_targets').delete().eq('period', b.period);
    const rows = (b.misos || []).map((n: string) => ({ period: b.period, miso_name: n }));
    if (rows.length) {
      const { error } = await supabaseAdmin.from('eval_targets').insert(rows);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (b.action === 'openPeriod') {
    // 배정 완료 검증: 모든 평가대상이 배정돼야 오픈 가능
    const { data: tg } = await supabaseAdmin.from('eval_targets').select('miso_name').eq('period', b.period);
    const { data: asg2 } = await supabaseAdmin.from('eval_assignments').select('miso_name').eq('period', b.period);
    const tgs = (tg ?? []).map((t: any) => t.miso_name);
    if (!tgs.length) return NextResponse.json({ error: '평가대상 선정과 배정을 먼저 완료하세요.' }, { status: 400 });
    const aset = new Set((asg2 ?? []).map((a: any) => a.miso_name));
    const un = tgs.filter((n: string) => !aset.has(n));
    if (un.length) return NextResponse.json({ error: '미배정 ' + un.length + '명이 있습니다. 배정을 완료해야 오픈할 수 있습니다.' }, { status: 400 });
    await supabaseAdmin.from('eval_periods').upsert({ period: b.period, status: 'open', opened_at: new Date().toISOString(), closed_at: null }, { onConflict: 'period' });
    const [y, m] = b.period.split('-');
    await sendPushToAdmins('📋 월말평가 시작', `${y}년 ${+m}월 평가가 오픈됐습니다. 배정된 미소지기를 평가해주세요.`);
    return NextResponse.json({ ok: true });
  }
  if (b.action === 'closePeriod') {
    await supabaseAdmin.from('eval_periods').upsert({ period: b.period, status: 'closed', closed_at: new Date().toISOString() }, { onConflict: 'period' });
    const [, m] = b.period.split('-');
    // 순위 산정 → 전체 미소지기에게 우수자 발표 푸시
    const { data: asg } = await supabaseAdmin.from('eval_assignments').select('miso_name').eq('period', b.period);
    const { data: sc } = await supabaseAdmin.from('eval_scores').select('miso_name, grades').eq('period', b.period);
    const autoC = await computeAuto(b.period);
    const scMap: Record<string, any> = {}; (sc ?? []).forEach((x: any) => { scMap[x.miso_name] = x.grades || {}; });
    const rows: any[] = (asg ?? []).map((a: any) => { const c = ctxFor(a.miso_name, autoC); return { miso: a.miso_name, total: totalScore(scMap[a.miso_name] || {}, c), _ab: c.absentN, _la: c.lateN, _nr: c.noticeReq ? c.noticeSigned / c.noticeReq : 1 }; });
    rows.sort(tieCmp);
    const { data: rc } = await supabaseAdmin.from('eval_rookies').select('miso_name').eq('period', b.period);
    const cand = new Set((rc ?? []).map((r: any) => r.miso_name));
    const rookie = rows.find((r: any) => cand.has(r.miso));
    let body = `${+m}월 우수 미소지기 발표! `;
    if (rows[0]) body += `🥇${rows[0].miso}`;
    if (rows[1]) body += ` 🥈${rows[1].miso}`;
    if (rookie) body += ` 🐣신인왕 ${rookie.miso}`;
    await sendPushToAllExcept([], '🏆 월말평가 결과', body);
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
      const { data: existing } = await supabaseAdmin.from('eval_scores').select('id').eq('period', b.period).eq('miso_name', b.miso).maybeSingle();
      if (existing) return NextResponse.json({ error: '이미 평가가 저장되어 수정할 수 없습니다.' }, { status: 403 });
      const { data: per } = await supabaseAdmin.from('eval_periods').select('status').eq('period', b.period).maybeSingle();
      if (!per || per.status !== 'open') return NextResponse.json({ error: '평가가 오픈된 기간에만 저장할 수 있습니다.' }, { status: 403 });
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
