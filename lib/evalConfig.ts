// 월말평가 설정 (본사 기준). 점수·가중치는 여기서 조정 가능.
export const LETTER: Record<string, number> = { S: 100, A: 90, B: 80, C: 70, D: 60, F: 50 };
export const LETTERS = ['S', 'A', 'B', 'C', 'D', 'F'];

export type CriKind = 'letter' | 'notice' | 'late' | 'absent';
export interface Criterion { key: string; mid: string; sub: string; weight: number; kind: CriKind; }

export const CRITERIA: Criterion[] = [
  { key: 'notice',  mid: '현장관리',       sub: '이벤트·공지사항 숙지', weight: 10, kind: 'notice' },
  { key: 'kakao',   mid: '현장관리',       sub: '카톡공지 숙지',        weight: 10, kind: 'letter' },
  { key: 'service', mid: '현장관리',       sub: '서비스 태도',          weight: 20, kind: 'letter' },
  { key: 'active',  mid: '근무태도(정성)', sub: '적극적 태도',          weight: 20, kind: 'letter' },
  { key: 'rule',    mid: '근무태도(정성)', sub: '내부 규정 준수',       weight: 10, kind: 'letter' },
  { key: 'groom',   mid: '용모/청결',      sub: '유니폼·개인위생',      weight: 10, kind: 'letter' },
  { key: 'late',    mid: '근무태도(정량)', sub: '지각',                 weight: 10, kind: 'late' },
  { key: 'absent',  mid: '근무태도(정량)', sub: '결근',                 weight: 10, kind: 'absent' },
];

export function letterScore(g?: string): number { return g && LETTER[g] != null ? LETTER[g] : 0; }
export function lateScore(count: number): number { return Math.max(0, 100 - 15 * count); }
export function absentScore(count: number): number { return Math.max(0, 100 - 50 * count); }
export function noticeScore(required: number, signed: number): number {
  if (required <= 0) return 100; // 그 달 서명필요 공지 없으면 만점
  return Math.round((signed / required) * 100);
}

// 근태 주차키("2026년 4/27(월) ~ 5/3(일) 주간")가 해당 period(YYYY-MM)에 속하는지 (목요일=과반 달 기준)
export function weekInPeriod(weekKey: string, period: string): boolean {
  const m = String(weekKey).match(/(\d{4})년\s*(\d{1,2})\/(\d{1,2})/);
  if (!m) return false;
  const thu = new Date(+m[1], +m[2] - 1, +m[3] + 3);
  const p = thu.getFullYear() + '-' + String(thu.getMonth() + 1).padStart(2, '0');
  return p === period;
}

// 항목별 자동 점수(정량/공지) 계산
export function autoScore(kind: CriKind, ctx: { lateN: number; absentN: number; noticeReq: number; noticeSigned: number }): number {
  if (kind === 'late') return lateScore(ctx.lateN);
  if (kind === 'absent') return absentScore(ctx.absentN);
  if (kind === 'notice') return noticeScore(ctx.noticeReq, ctx.noticeSigned);
  return 0;
}

// 한 사람의 총점 계산 (grades = {kakao,service,active,rule,groom}, ctx = 자동값)
export function totalScore(grades: Record<string, string>, ctx: { lateN: number; absentN: number; noticeReq: number; noticeSigned: number }): number {
  let total = 0;
  for (const c of CRITERIA) {
    const s = c.kind === 'letter' ? letterScore(grades[c.key]) : autoScore(c.kind, ctx);
    total += s * c.weight / 100;
  }
  return Math.round(total);
}
