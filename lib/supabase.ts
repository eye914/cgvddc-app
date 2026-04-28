import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

// 빌드 타임에는 클라이언트 생성 스킵
const isDummy = !supabaseUrl || !supabaseAnonKey;

export const supabase = isDummy
  ? null as any
  : createClient(supabaseUrl, supabaseAnonKey);

export const supabaseAdmin = isDummy || !serviceRoleKey
  ? null as any
  : createClient(supabaseUrl, serviceRoleKey);
