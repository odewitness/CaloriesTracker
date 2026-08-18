// Endpoint générique appelé par les triggers SQL (via pg_net) pour pousser
// une notification à un ou plusieurs utilisateurs — voir push_notify() dans
// supabase/sql/push_notifications_setup.sql. Pas de JWT Supabase standard :
// l'appelant est Postgres, pas un navigateur, authentifié par un secret
// partagé (PUSH_TRIGGER_SECRET) plutôt que le service_role key directement,
// pour limiter les dégâts si ce secret venait à fuiter.
//
// Fichier volontairement autonome (pas d'import partagé avec
// daily-reminder/index.ts) pour permettre un déploiement par copier/coller
// dans l'éditeur du dashboard Supabase, sans avoir besoin de la CLI.
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const PUSH_TRIGGER_SECRET = Deno.env.get('PUSH_TRIGGER_SECRET')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Sujet VAPID requis par la spec push (contact en cas d'abus signalé par un
// service push) — remplacer par une adresse que tu surveilles réellement.
webpush.setVapidDetails('mailto:remplace-moi@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

Deno.serve(async (req) => {
  if (req.headers.get('x-push-secret') !== PUSH_TRIGGER_SECRET) {
    return new Response('unauthorized', { status: 401 })
  }

  const { user_ids, title, body, url } = await req.json()
  if (!Array.isArray(user_ids) || user_ids.length === 0 || !title) {
    return new Response('bad request', { status: 400 })
  }

  const { data: subs } = await supabaseAdmin
    .from('push_subscriptions')
    .select('*')
    .in('user_id', user_ids)

  for (const sub of subs || []) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title, body, url })
      )
    } catch (err) {
      // 404/410 = abonnement expiré ou révoqué côté navigateur, cas normal.
      const statusCode = (err as { statusCode?: number })?.statusCode
      if (statusCode === 404 || statusCode === 410) {
        await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id)
      } else {
        console.error('push send error', sub.id, err)
      }
    }
  }

  return new Response('ok')
})
