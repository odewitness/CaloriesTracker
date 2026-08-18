// Helper partagé entre les Edge Functions send-push et daily-reminder.
// Déployé manuellement (copié dans le dashboard Supabase ou via CLI) — voir
// supabase/sql/push_notifications_setup.sql pour le reste de la mise en place.
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Sujet VAPID requis par la spec push (contact en cas d'abus signalé par un
// service push) — remplacer par une adresse que tu surveilles réellement.
webpush.setVapidDetails('mailto:remplace-moi@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

type PushPayload = { title: string; body?: string; url?: string }

// Envoie à tous les appareils abonnés des utilisateurs donnés ; désabonne
// automatiquement un appareil dont le service push répond 404/410 (abonnement
// expiré ou révoqué côté navigateur — cas normal, pas une erreur à logger).
export async function sendToUsers(userIds: string[], payload: PushPayload) {
  if (!userIds?.length) return

  const { data: subs } = await supabaseAdmin
    .from('push_subscriptions')
    .select('*')
    .in('user_id', userIds)

  for (const sub of subs || []) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      )
    } catch (err) {
      const statusCode = (err as { statusCode?: number })?.statusCode
      if (statusCode === 404 || statusCode === 410) {
        await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id)
      } else {
        console.error('push send error', sub.id, err)
      }
    }
  }
}
