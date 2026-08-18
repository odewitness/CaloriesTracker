// Invoquée toutes les heures par un Cron Job Supabase (voir
// supabase/sql/push_notifications_setup.sql pour l'appel cron.schedule). Se
// gate elle-même sur l'heure locale Europe/Paris plutôt que de dépendre
// d'une expression cron en UTC — évite d'avoir à ajuster l'heure du cron au
// changement heure d'été/hiver.
//
// Fichier volontairement autonome (pas d'import partagé avec
// send-push/index.ts) pour permettre un déploiement par copier/coller dans
// l'éditeur du dashboard Supabase, sans avoir besoin de la CLI.
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const PUSH_TRIGGER_SECRET = Deno.env.get('PUSH_TRIGGER_SECRET')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

webpush.setVapidDetails('mailto:remplace-moi@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const TARGET_HOUR = 17 // heure locale Europe/Paris à laquelle envoyer le rappel

function parisHour(): number {
  return parseInt(
    new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: 'numeric', hour12: false }).format(new Date()),
    10
  )
}

function parisDateStr(): string {
  // Format 'YYYY-MM-DD', comparable directement aux colonnes `date` Postgres.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

async function sendToUser(userId: string, payload: { title: string; body: string; url: string }) {
  const { data: subs } = await supabaseAdmin.from('push_subscriptions').select('*').eq('user_id', userId)
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

Deno.serve(async (req) => {
  // Déployée avec la vérification JWT désactivée (appelée par pg_cron, pas
  // par un navigateur) — ce secret partagé est la seule protection contre un
  // appel externe non désiré, même s'il ne fait "que" déclencher un check.
  if (req.headers.get('x-push-secret') !== PUSH_TRIGGER_SECRET) {
    return new Response('unauthorized', { status: 401 })
  }

  if (parisHour() !== TARGET_HOUR) {
    return new Response('not target hour, skipped')
  }

  const today = parisDateStr()

  const { data: eligible } = await supabaseAdmin
    .from('settings')
    .select('user_id, last_reminder_sent_date')
    .eq('notif_reminder_enabled', true)

  // Anti-doublon : ne renvoie pas si déjà traité aujourd'hui (protège contre
  // un déclenchement manuel/accidentel en plus du cron horaire).
  const candidates = (eligible || []).filter((r) => r.last_reminder_sent_date !== today)

  for (const row of candidates) {
    const { count } = await supabaseAdmin
      .from('journal')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', row.user_id)
      .eq('date', today)

    let title: string | null = null
    let body = ''

    if (!count) {
      title = "Tu n'as encore rien noté aujourd'hui"
      body = 'Un petit tour dans CaloriesTracker ?'
    } else {
      const { data: unplanned } = await supabaseAdmin
        .from('repas_planifies')
        .select('nom')
        .eq('user_id', row.user_id)
        .eq('date', today)
        .eq('mange', false)
        .limit(1)
      if (unplanned && unplanned.length > 0) {
        title = `« ${unplanned[0].nom} » pas encore noté`
        body = 'Tu veux le marquer comme mangé ?'
      }
    }

    if (title) await sendToUser(row.user_id, { title, body, url: '/today' })

    await supabaseAdmin.from('settings').update({ last_reminder_sent_date: today }).eq('user_id', row.user_id)
  }

  return new Response(`checked ${candidates.length} users`)
})
