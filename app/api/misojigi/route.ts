import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

async function callGAS(action: string, params: any[]) {
  const GAS_URL = process.env.GAS_URL;
  if (!GAS_URL) return;
  try { await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action, params }) }); } catch (_) {}
}

// GET: 활성 미소지기 목록 (앱용)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const all = searchParams.get('all') === '1'; // 관리자: 비활성 포함
    const mode = searchParams.get('mode');

    // ★ 전화번호 맵 조회 (GAS 직원정보 시트)
    if (mode === 'phones') {
      const GAS_URL = process.env.GAS_URL;
      if (!GAS_URL) return NextResponse.json({});
      const res = await fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'getEmployeePhones', params: [] }),
      });
      const txt = await res.text();
      try {
        const json = JSON.parse(txt);
        if (json?.success) return NextResponse.json(json.result || {});
        return NextResponse.json({ error: json?.error || 'GAS 오류' }, { status: 500 });
      } catch {
        return NextResponse.json({ error: '응답 파싱 실패' }, { status: 500 });
      }
    }

    // ★ 날짜별 포지션 맵 조회 (맞교대 카드 IN 포지션 표시용)
    if (mode === 'posMap') {
      const { data, error } = await supabaseAdmin
        .from('app_settings')
        .select('value')
        .eq('key', 'schedule_pos_map')
        .single();
      if (error) return NextResponse.json({});
      return NextResponse.json(data?.value ?? {});
    }

    const query = supabaseAdmin.from('misojigi').select('*').order('name');
    if (!all) query.eq('active', true);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const result = (data ?? []).map((row: Record<string, any>) => ({
      name: row.name,
      pos: row.pos ? row.pos.split(',').map((p: string) => p.trim()) : [],
      base_pos: row.base_pos            // 스케줄 지정 포지션 (콤마 구분 → ' / ' 조인)
        ? row.base_pos.split(',').map((p: string) => p.trim()).join(' / ')
        : null,
      hours: row.hours ?? '5.5',
      active: row.active,
      pin: row.pin ?? '00000',
      contract_days: row.contract_days ?? 5,
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

    const { error } = await supabaseAdmin.from('misojigi').insert({
      name: name.trim(),
      pos: Array.isArray(pos) ? pos.join(',') : (pos || ''),
      hours: hours ?? 5.5,
      active: true,
      pin: '00000',
      employee_id: employeeId ? employeeId.trim() : null,
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
    const { action } = body as { action?: string };

    // ── 스케줄 시트에서 날짜별 포지션 동기화 ────────────────────────
    if (action === 'syncSchedulePos') {
      const { startDate, endDate } = body as { startDate: string; endDate: string };
      if (!startDate || !endDate) return NextResponse.json({ error: 'startDate, endDate 필요 (YYYY-MM-DD)' }, { status: 400 });
      const GAS_URL = process.env.GAS_URL;
      if (!GAS_URL) return NextResponse.json({ error: 'GAS_URL 미설정' }, { status: 500 });

      // GAS에서 날짜별 포지션 맵 조회 { 'M/D': { name: pos } }
      const gasRes = await fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'getSchedulePositionMapByDates', params: [startDate, endDate] }),
      });
      const gasJson = await gasRes.json() as { success: boolean; result: any; error?: string };
      if (!gasJson.success) return NextResponse.json({ error: gasJson.error ?? 'GAS 오류' }, { status: 500 });

      const dateMap = gasJson.result as Record<string, Record<string, string>>;
      if (!dateMap || (dateMap as any).error) {
        return NextResponse.json({ error: (dateMap as any)?.error ?? '포지션 데이터 없음' }, { status: 500 });
      }

      // ── app_settings.schedule_pos_map 저장 (날짜별 맵 전체) ──
      const { error: settingsError } = await supabaseAdmin
        .from('app_settings')
        .upsert({ key: 'schedule_pos_map', value: dateMap as any }, { onConflict: 'key' });
      if (settingsError) return NextResponse.json({ error: settingsError.message }, { status: 500 });

      // ── misojigi.base_pos 업데이트 (이 기간에 등장한 고유 포지션 집계) ──
      const personPos: Record<string, Set<string>> = {};
      for (const dayMap of Object.values(dateMap)) {
        for (const [name, pos] of Object.entries(dayMap)) {
          if (!personPos[name]) personPos[name] = new Set();
          personPos[name].add(pos);
        }
      }

      let updated = 0;
      for (const [name, posSet] of Object.entries(personPos)) {
        const base_pos = [...posSet].join(',');
        const { error } = await supabaseAdmin
          .from('misojigi').update({ base_pos }).eq('name', name);
        if (!error) updated++;
      }

      const dateCount = Object.keys(dateMap).length;
      return NextResponse.json({ ok: true, updated, dateCount, map: dateMap });
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
