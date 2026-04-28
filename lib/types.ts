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
