import webpush from 'web-push';
import { supabaseAdmin } from './supabase';

webpush.setVapidDetails(
  'mailto:' + process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

// 구독 문자열 배열 → 기기(endpoint) 기준 중복 제거 후 파싱된 구독 배열 반환
// 한 기기가 여러 이름으로 구독돼 있어도 endpoint 가 같으면 1번만 발송(중복 알림 방지)
function dedupByEndpoint(subs: string[]): any[] {
  const map = new Map<string, any>();
  for (const s of subs) {
    try {
      const p = JSON.parse(s);
      const key = p && p.endpoint ? p.endpoint : s;
      map.set(key, p);
    } catch { /* 파싱 실패 구독은 무시 */ }
  }
  return [...map.values()];
}

async function pushMany(subs: string[], title: string, body: string, url?: string) {
  const targets = dedupByEndpoint(subs);
  if (!targets.length) return;
  const payload = JSON.stringify({ title, body, icon: '/icons/icon-192.png', url: url || '/' });
  const results = await Promise.allSettled(
    targets.map((p: any) => webpush.sendNotification(p, payload))
  );

  // 만료·해지된 구독(404/410)은 DB에서 제거한다.
  //  그대로 두면 그 사람에게는 계속 조용히 발송 실패만 반복되어 "알림이 안 온다"가 된다.
  const dead: string[] = [];
  results.forEach((r, i) => {
    if (r.status !== 'rejected') return;
    const code = (r.reason as any)?.statusCode;
    if (code === 404 || code === 410) dead.push(targets[i]?.endpoint);
    else console.warn('[push] 발송 실패', code, (r.reason as any)?.body);
  });
  for (const ep of dead) {
    if (!ep) continue;
    await supabaseAdmin.from('push_subscriptions').delete().like('subscription', `%${ep}%`);
  }
}

export async function sendPushToNames(names: string[], title: string, body: string, url?: string) {
  const validNames = names.filter(n => n && n !== '모집중');
  if (!validNames.length) return;

  const { data } = await supabaseAdmin
    .from('push_subscriptions')
    .select('name, subscription')
    .in('name', validNames);
  if (!data?.length) return;

  await pushMany(data.map((r: any) => r.subscription), title, body, url);
}

export async function sendPushToAdmins(title: string, body: string) {
  const { data } = await supabaseAdmin
    .from('admins')
    .select('name')
    .eq('active', true);
  if (!data?.length) return;
  const adminNames = data.map((r: Record<string, any>) => r.name);
  await sendPushToNames(adminNames, title, body);
}

/** 등록된 전체 구독자 중 excludeNames 를 제외하고 발송 */
export async function sendPushToAllExcept(excludeNames: string[], title: string, body: string) {
  const { data } = await supabaseAdmin
    .from('push_subscriptions')
    .select('name, subscription');
  if (!data?.length) return;

  // 제외 이름 필터 후, 기기(endpoint) 기준 중복 제거하여 발송
  const subs = data
    .filter((r: any) => !excludeNames.includes(r.name))
    .map((r: any) => r.subscription);
  await pushMany(subs, title, body);
}
