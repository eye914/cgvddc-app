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
    .select('subscription')
    .in('name', validNames);
  if (!data?.length) return;

  await Promise.allSettled(
    data.map((row: Record<string, any>) =>
      webpush.sendNotification(
        JSON.parse(row.subscription),
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
