// 월말평가 설정 (본사 기준). 점수·가중치는 여기서 조정 가능.
export const LETTER: Record<string, number> = { S: 100, A: 90, B: 80, C: 70, D: 60, F: 50 };
export const LETTERS = ['S', 'A', 'B', 'C', 'D', 'F'];

export type CriKind = 'letter' | 'notice' | 'late' | 'absent';
export interface Criterion { key: string; mid: string; sub: string; weight: number; kind: CriKind; }

// 구 배점(2026-08 이전): 정성 70 + 자동 30 = 100
//   → 관리자가 5개 전부 S 를 주면 그 자체로 100점이 되어 가산점이 상한에 막혀 무의미했다.
export const CRITERIA_V1: Criterion[] = [
  { key: 'notice',  mid: '현장관리',       sub: '이벤트·공지사항 숙지', weight: 10, kind: 'notice' },
  { key: 'kakao',   mid: '현장관리',       sub: '카톡공지 숙지',        weight: 10, kind: 'letter' },
  { key: 'service', mid: '현장관리',       sub: '서비스 태도',          weight: 20, kind: 'letter' },
  { key: 'active',  mid: '근무태도(정성)', sub: '적극적 태도',          weight: 20, kind: 'letter' },
  { key: 'rule',    mid: '근무태도(정성)', sub: '내부 규정 준수',       weight: 10, kind: 'letter' },
  { key: 'groom',   mid: '용모/청결',      sub: '유니폼·개인위생',      weight: 10, kind: 'letter' },
  { key: 'late',    mid: '근무태도(정량)', sub: '지각',                 weight: 10, kind: 'late' },
  { key: 'absent',  mid: '근무태도(정량)', sub: '결근',                 weight: 10, kind: 'absent' },
];

// 신 배점(2026-08 부터): 정성 60 + 자동 30 = 90
//   → 완벽 근무 + 전부 S 라도 90점. 나머지 10점은 대타 수락 가산(1건 +3, 4건이면 +12)으로 채운다.
//     대타를 서준 사람과 아닌 사람이 모두 100점이 되던 문제를 해소.
export const CRITERIA_V2: Criterion[] = [
  { key: 'notice',  mid: '현장관리',       sub: '이벤트·공지사항 숙지', weight: 10, kind: 'notice' },
  { key: 'kakao',   mid: '현장관리',       sub: '카톡공지 숙지',        weight:  9, kind: 'letter' },
  { key: 'service', mid: '현장관리',       sub: '서비스 태도',          weight: 17, kind: 'letter' },
  { key: 'active',  mid: '근무태도(정성)', sub: '적극적 태도',          weight: 17, kind: 'letter' },
  { key: 'rule',    mid: '근무태도(정성)', sub: '내부 규정 준수',       weight:  9, kind: 'letter' },
  { key: 'groom',   mid: '용모/청결',      sub: '유니폼·개인위생',      weight:  8, kind: 'letter' },
  { key: 'late',    mid: '근무태도(정량)', sub: '지각',                 weight: 10, kind: 'late' },
  { key: 'absent',  mid: '근무태도(정량)', sub: '결근',                 weight: 10, kind: 'absent' },
];

// 기본값은 신 배점(화면 기본 표시용). 기간별 조회는 criteriaFor() 사용.
export const CRITERIA: Criterion[] = CRITERIA_V2;
export function criteriaFor(period?: string): Criterion[] {
  return period && !usesRulesV2(period) ? CRITERIA_V1 : CRITERIA_V2;
}

export function letterScore(g?: string): number { return g && LETTER[g] != null ? LETTER[g] : 0; }
export function lateScore(count: number): number { return Math.max(0, 100 - 15 * count); }
export function absentScore(count: number): number { return Math.max(0, 100 - 50 * count); }

// 공지 미숙지: 서명은 했으나 현장 확인(질문/테스트)에서 내용을 모른 경우 1회당 차감
export const NOTICE_MISS_PENALTY = 25;
export function noticeScore(required: number, signed: number, miss: number = 0): number {
  const base = required <= 0 ? 100 : Math.round((signed / required) * 100); // 서명필요 공지 없으면 만점
  return Math.max(0, base - NOTICE_MISS_PENALTY * (miss || 0));
}

// 근태 주차키를 period(YYYY-MM)에 매칭 (목요일=과반 달 기준). 두 형식 모두 지원:
//  · "2026년 4/27(월) ~ 5/3(일) 주간"
//  · "2026년 7월 3주차 (7/13(월)~7/19(일))"
export function weekInPeriod(weekKey: string, period: string): boolean {
  const s = String(weekKey);
  const ym = s.match(/(\d{4})\s*년/);          // 연도
  const md = s.match(/(\d{1,2})\s*\/\s*(\d{1,2})/); // 첫 M/D = 그 주 시작일(월요일)
  if (!ym || !md) return false;
  const thu = new Date(+ym[1], +md[1] - 1, +md[2] + 3); // 월+3 = 목요일
  const p = thu.getFullYear() + '-' + String(thu.getMonth() + 1).padStart(2, '0');
  return p === period;
}

// 항목별 자동 점수(정량/공지) 계산
export function autoScore(kind: CriKind, ctx: { lateN: number; absentN: number; noticeReq: number; noticeSigned: number; missN?: number }): number {
  if (kind === 'late') return lateScore(ctx.lateN);
  if (kind === 'absent') return absentScore(ctx.absentN);
  if (kind === 'notice') return noticeScore(ctx.noticeReq, ctx.noticeSigned, ctx.missN || 0);
  return 0;
}

// 대타/교대 수락 보너스(적극적 참여): 1건당 +3점, 최대 +12점
export const SUB_BONUS_PER = 3;
export const SUB_BONUS_CAP = 12;
export function subBonus(count: number): number { return Math.min((count || 0) * SUB_BONUS_PER, SUB_BONUS_CAP); }

// ★ 새 점수 규칙(대타 요청 감점 · 근무일 파서 개선 · 공지 미숙지) 적용 시작 시점.
//   이 기준보다 이전 기간은 당시 발표된 결과가 바뀌지 않도록 예전 계산을 그대로 사용한다.
export const RULES_V2_FROM = '2026-08';
export function usesRulesV2(period: string): boolean {
  return String(period || '') >= RULES_V2_FROM;   // "YYYY-MM" 문자열 비교로 충분
}

// ── 단순대타 '요청' 감점 (A안: 얼마나 미리 냈는지로 차등) ──
//   3일 이상 전 = 정상적인 사전 조정이므로 감점 없음 / 1~2일 전 = −2 / 당일(이후) = −5
//   ※ 맞교대(swap)는 본인도 근무하므로 대상 제외
//   ※ 결근으로 생긴 대타는 결근으로 이미 처벌 → 결근 횟수만큼 무거운 건부터 제외(이중처벌 방지)
export const SUBREQ_FREE_LEAD: number = 3;
export const SUBREQ_PEN_NEAR: number = 2;
export const SUBREQ_PEN_SAMEDAY: number = 5;
export const SUBREQ_PEN_CAP: number = 10;
export function subReqPenalty(leadDays: number[], absentN: number = 0): number {
  const pens: number[] = (leadDays || [])
    .map(d => (d <= 0 ? SUBREQ_PEN_SAMEDAY : d < SUBREQ_FREE_LEAD ? SUBREQ_PEN_NEAR : 0))
    .filter(p => p > 0)
    .sort((a, b) => b - a);              // 무거운 건부터
  const kept = pens.slice(Math.max(0, absentN || 0));  // 결근 건수만큼 상쇄
  return Math.min(SUBREQ_PEN_CAP, kept.reduce((s, p) => s + p, 0));
}

// ── 근태서류 제출 감점 ──
//   기한(요청일 +3일) 내 제출이면 감점 없음. 늦게 냈으면 −2, 끝내 안 냈으면 −5.
//   ※ 사직원(resign)은 퇴사 절차라 대상에서 제외한다.
//   점수는 가볍게 두고(관리 목적은 '확인'), 미제출 파악·독촉을 우선한다.
export const FORM_DUE_DAYS = 3;
export const FORM_PEN_LATE: number = 1;
export const FORM_PEN_MISSING: number = 3;
export const FORM_PEN_CAP: number = 6;
export function formPenalty(lateN: number, missingN: number): number {
  return Math.min(FORM_PEN_CAP, (lateN || 0) * FORM_PEN_LATE + (missingN || 0) * FORM_PEN_MISSING);
}

// 근무일 문자열 → Date. "2026-08-10(월) / D1", "8/10(월) / D1" 두 형식 모두 지원.
export function parseShiftDate(shiftDate: string, fallbackYear?: number): Date | null {
  const s = String(shiftDate || '');
  const iso = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);
  const md = s.match(/(\d{1,2})\s*\/\s*(\d{1,2})/);
  if (md) return new Date(fallbackYear || new Date().getFullYear(), +md[1] - 1, +md[2]);
  return null;
}
// 두 날짜의 일수 차이(근무일 − 등록일). 시각은 버리고 날짜만 비교.
export function leadDaysBetween(created: Date, shift: Date): number {
  const a = new Date(created.getFullYear(), created.getMonth(), created.getDate());
  const b = new Date(shift.getFullYear(), shift.getMonth(), shift.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

// 한 사람의 총점 계산 (grades = {kakao,service,active,rule,groom}, ctx = 자동값)
export function totalScore(grades: Record<string, string>, ctx: { lateN: number; absentN: number; noticeReq: number; noticeSigned: number; subN?: number; missN?: number; subReqPen?: number; formPen?: number; period?: string }): number {
  let total = 0;
  for (const c of criteriaFor(ctx.period)) {   // 기간에 맞는 배점(구:70 / 신:60)
    const s = c.kind === 'letter' ? letterScore(grades[c.key]) : autoScore(c.kind, ctx);
    total += s * c.weight / 100;
  }
  total += subBonus(ctx.subN || 0);   // 대타 수락 = 적극적 참여 보너스
  total -= (ctx.subReqPen || 0);      // 단순대타 요청 = 임박도에 따른 감점
  total -= (ctx.formPen || 0);        // 근태서류 지연/미제출 감점
  return Math.max(0, Math.min(100, Math.round(total)));
}
