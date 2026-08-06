import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

async function callGAS(action: string, params: any[]) {
  const GAS_URL = process.env.GAS_URL;
  if (!GAS_URL) return;
  try { await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action, params }) }); } catch (_) {}
}

// ── 전화번호 캐시 (GAS 직원정보 시트 콜드스타트 30초를 사용자에게서 분리) ──
const PHONES_KEY = 'misojigi_phones_cache';
const PHONES_SOFT_TTL = 6 * 60 * 60 * 1000; // 6시간 지나면 백그라운드 갱신
async function fetchPhonesFromGAS(): Promise<any | null> {
  const GAS_URL = process.env.GAS_URL;
  if (!GAS_URL) return {};
  const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'getEmployeePhones', params: [] }) });
  const txt = await res.text();
  const json = JSON.parse(txt);
  return json?.success ? (json.result || {}) : null;
}

// GET: 활성 미소지기 목록 (앱용)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const all = searchParams.get('all') === '1'; // 관리자: 비활성 포함
    const mode = searchParams.get('mode');

    // ★ 전화번호 맵 조회 (GAS 직원정보 시트) — 캐시 + stale-while-revalidate
    if (mode === 'phones') {
      if (!process.env.GAS_URL) return NextResponse.json({});
      // 캐시 조회
      const { data: row } = await supabaseAdmin.from('app_settings').select('value').eq('key', PHONES_KEY).maybeSingle();
      const cache = row?.value as any;
      const cached = cache && typeof cache.ts === 'number' ? cache : null;
      if (cached) {
        const age = Date.now() - cached.ts;
        // 오래됐으면 백그라운드 갱신(응답은 즉시 캐시로)
        if (age > PHONES_SOFT_TTL) {
          after(async () => {
            try { const fresh = await fetchPhonesFromGAS(); if (fresh) await supabaseAdmin.from('app_settings').upsert({ key: PHONES_KEY, value: { ts: Date.now(), data: fresh } }, { onConflict: 'key' }); } catch {}
          });
        }
        return NextResponse.json(cached.data || {});
      }
      // 캐시 없음 → 최초 1회만 느린 GAS 호출 (이후 캐시)
      try {
        const fresh = await fetchPhonesFromGAS();
        if (fresh) {
          await supabaseAdmin.from('app_settings').upsert({ key: PHONES_KEY, value: { ts: Date.now(), data: fresh } }, { onConflict: 'key' });
          return NextResponse.json(fresh);
        }
        return NextResponse.json({ error: 'GAS 오류' }, { status: 500 });
      } catch {
        return NextResponse.json({ error: '응답 파싱 실패' }, { status: 500 });
      }
    }

    const query = supabaseAdmin.from('misojigi').select('*').order('name');
    if (!all) query.eq('active', true);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const result = (data ?? []).map((row: Record<string, any>) => ({
      name: row.name,
      pos: row.pos ? row.pos.split(',').map((p: string) => p.trim()) : [],
      hours: row.hours ?? '5.5',
      active: row.active,
      pin: row.pin ?? '00000',
      contract_days: row.contract_days ?? 5,
      // 신청 가능 일수: 설정값 우선, 없으면 근로일수로 폴백
      apply_days: row.apply_days ?? (row.contract_days ?? 5),
    }));

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST: 새 미소지기 추가
export async function POST(req: NextRequest) {
  try {
    const { name, pos, hours, employeeId } = await req.json();
    if (!name) return NextResponse.json({ error: '이름 필요' }, { status: 400 });

    // 근로일수 디폴트: 5.5h → 2일, 4.5h(그 외) → 3일
    const hrs = Number(hours ?? 5.5);
    const contractDays = hrs >= 5.5 ? 2 : 3;

    const { error } = await supabaseAdmin.from('misojigi').insert({
      name: name.trim(),
      pos: Array.isArray(pos) ? pos.join(',') : (pos || ''),
      hours: hours ?? 5.5,
      active: true,
      pin: '00000',
      employee_id: employeeId ? employeeId.trim() : null,
      contract_days: contractDays,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // GAS 미소지기DB 동기화
    await callGAS('addMisojigiToDB', [name.trim(), Array.isArray(pos) ? pos.join(',') : (pos || ''), hours ?? 5.5]);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PATCH: 미소지기 정보 수정 (포지션, PIN, active)
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();

    // ── 이름 변경(rename) ─────────────────────────────────────────
    //   동명이인 구분용. name(기존) → newName(신규). 다른 필드와 별개로 처리.
    if (body.newName !== undefined) {
      const oldName = String(body.name || '').trim();
      const newName = String(body.newName).trim();
      if (!oldName || !newName) return NextResponse.json({ error: '기존/새 이름 필요' }, { status: 400 });
      // 중복 방지
      const { data: dup } = await supabaseAdmin.from('misojigi').select('name').eq('name', newName).maybeSingle();
      if (dup) return NextResponse.json({ error: '이미 존재하는 이름: ' + newName }, { status: 400 });
      const { error: renErr } = await supabaseAdmin.from('misojigi').update({ name: newName }).eq('name', oldName);
      if (renErr) return NextResponse.json({ error: renErr.message }, { status: 500 });
      // GAS 미소지기DB 동기화 (이름 열 변경)
      await callGAS('updateMisojigiInDB', [oldName, { name: newName }]);
      return NextResponse.json({ ok: true });
    }

    // ── 일반 PATCH ────────────────────────────────────────────────
    const { name, ...updates } = body as { name: string; [key: string]: any };
    if (!name) return NextResponse.json({ error: '이름 필요' }, { status: 400 });

    // PIN 유효성 검사
    if (updates.pin !== undefined && !/^\d{5}$/.test(updates.pin)) {
      return NextResponse.json({ error: 'PIN은 숫자 5자리' }, { status: 400 });
    }

    // pos 배열 → 문자열 변환
    if (Array.isArray(updates.pos)) {
      updates.pos = updates.pos.join(',');
    }

    const { error } = await supabaseAdmin.from('misojigi').update(updates).eq('name', name);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // GAS 미소지기DB 동기화 (PIN 변경 제외)
    const { pin: _pin, ...gasUpdates } = updates;
    if (Object.keys(gasUpdates).length > 0) {
      await callGAS('updateMisojigiInDB', [name, gasUpdates]);
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE: 미소지기 비활성화(soft) 또는 완전삭제(hard)
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, hard } = body;
    if (!name) return NextResponse.json({ error: '이름 필요' }, { status: 400 });

    if (hard) {
      // 완전 삭제 (비활성 상태인 경우만)
      const { data: existing } = await supabaseAdmin
        .from('misojigi')
        .select('active')
        .eq('name', name)
        .single();
      if (!existing) return NextResponse.json({ error: '미소지기를 찾을 수 없습니다' }, { status: 404 });
      if (existing.active) return NextResponse.json({ error: '활성 미소지기는 삭제할 수 없습니다. 먼저 퇴사 처리하세요.' }, { status: 400 });

      const { error } = await supabaseAdmin
        .from('misojigi')
        .delete()
        .eq('name', name);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      // 소프트 삭제 (비활성화)
      const { error } = await supabaseAdmin
        .from('misojigi')
        .update({ active: false })
        .eq('name', name);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      // GAS 미소지기DB 동기화 (활성=N으로)
      await callGAS('updateMisojigiInDB', [name, { active: false }]);
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
