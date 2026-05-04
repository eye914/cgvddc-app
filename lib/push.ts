import webpush from 'web-push';
import { supabaseAdmin } from './supabase';

webpush.setVapidDetails(
  'mailto:' + process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function sendPushToNames(names: string[], title: string, body: string) {
  const validNames = names.filter(n => n && n !== '모집중');
  if (!validNames.length) return;

  const { data } = await supabaseAdmin
    .from('push_subscriptions')
    .select('name, subscription')
    .in('name', validNames);
  if (!data?.length) return;

  // 동일 이름의 중복 구독 제거 — 마지막 row만 사용
  const dedupMap = new Map<string, string>();
  for (const row of data) dedupMap.set(row.name, row.subscription);

  await Promise.allSettled(
    [...dedupMap.values()].map((sub: string) =>
      webpush.sendNotification(
        JSON.parse(sub),
        JSON.stringify({ title, body, icon: '/icons/icon-192.png' })
      )
    )
  );
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

  // 동일 이름 중복 제거 후 제외 목록 필터
  const dedupMap = new Map<string, string>();
  for (const row of data) dedupMap.set(row.name, row.subscription);

  const targets = [...dedupMap.entries()].filter(([name]) => !excludeNames.includes(name));
  if (!targets.length) return;

  await Promise.allSettled(
    targets.map(([, sub]) =>
      webpush.sendNotification(
        JSON.parse(sub),
        JSON.stringify({ title, body, icon: '/icons/icon-192.png' })
      )
    )
  );
}
