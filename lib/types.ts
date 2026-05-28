export interface Trade {
  id: string;
  req_name: string;
  shift_date: string;
  req_pos: string;
  desired_shift: string;
  reason: string;
  trade_type: string;
  sub_name: string;
  sub_pos: string;
  status: string;
  created_at?: string;
}

export interface Misojigi {
  id?: number;
  name: string;
  pos: string[];
  hours: string;
  active: boolean;
}

export interface Attendance {
  id?: number;
  key: string;
  name: string;
  week: string;
  late: number;
  absent: number;
  logs: AttendanceLog[];
}

export interface AttendanceLog {
  date: string;
  type: string;
  note: string;
}

export interface PushSubscription {
  id?: number;
  name: string;
  subscription: string;
  created_at?: string;
}

// ── 스케줄 취합/편성 ──────────────────────────────

/** 미소지기가 신청한 하루치 가용 데이터 */
export interface Availability {
  id?: number;
  name: string;
  week_key: string;       // 주차 시작 월요일 'YYYY-MM-DD'
  day_of_week: number;    // 0=월 ~ 6=일
  shift_codes: string[];  // ['M3','N1'] 등 선택된 타임슬롯 코드
  created_at?: string;
  updated_at?: string;
}

/** 관리자가 배정 확정한 스케줄 */
export interface ScheduleAssignment {
  id?: number;
  week_key: string;
  date: string;           // 'YYYY-MM-DD'
  day_of_week: number;    // 0=월 ~ 6=일
  shift_code: string;     // 'M3' 등
  position: string;       // 'mart' | 'mart-close' | 'floor' | 'int'
  name: string;
  hours: number;          // 4.5 | 5.5
  confirmed: boolean;
  synced_to_sheet: boolean;
  created_at?: string;
  updated_at?: string;
}
