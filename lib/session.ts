import crypto from 'crypto';

const SECRET = process.env.SESSION_SECRET ?? '';

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

export interface Session {
  name: string;
  role: 'staff' | 'admin';
  pd?: boolean; // pin default(00000) 여부 (민감자료 차단용)
  exp: number;
}

// 로그인 성공 시 서명된 토큰 발급 (기본 12시간)
export function signSession(payload: { name: string; role: 'staff' | 'admin'; pd?: boolean }, ttlSec = 60 * 60 * 12): string {
  if (!SECRET) throw new Error('SESSION_SECRET 환경변수가 설정되지 않았습니다.');
  const body: Session = { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSec };
  const p = b64url(Buffer.from(JSON.stringify(body)));
  const sig = b64url(crypto.createHmac('sha256', SECRET).update(p).digest());
  return p + '.' + sig;
}

export function verifySession(token?: string | null): Session | null {
  if (!SECRET || !token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [p, sig] = parts;
  const expect = b64url(crypto.createHmac('sha256', SECRET).update(p).digest());
  if (sig.length !== expect.length) return null;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  } catch {
    return null;
  }
  try {
    const body = JSON.parse(b64urlDecode(p).toString()) as Session;
    if (!body.exp || body.exp < Math.floor(Date.now() / 1000)) return null;
    return body;
  } catch {
    return null;
  }
}

function tokenOf(req: Request): string | null {
  const h = req.headers.get('authorization') || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

// 유효한 로그인 세션(관리자/미소지기). pd(초기PIN)면 민감자료 접근 차단.
export function requireAuth(req: Request): Session | null {
  const s = verifySession(tokenOf(req));
  if (!s) return null;
  if (s.role === 'staff' && s.pd) return null; // 초기 PIN(00000) 사용자는 열람 불가
  return s;
}

export function requireAdmin(req: Request): Session | null {
  const s = verifySession(tokenOf(req));
  return s && s.role === 'admin' ? s : null;
}
