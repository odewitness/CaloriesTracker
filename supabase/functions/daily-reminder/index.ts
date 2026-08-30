// Invoquée toutes les heures par un Cron Job Supabase (voir
// supabase/sql/push_notifications_setup.sql pour l'appel cron.schedule). Se
// gate elle-même sur l'heure locale Europe/Paris plutôt que de dépendre
// d'une expression cron en UTC — évite d'avoir à ajuster l'heure du cron au
// changement heure d'été/hiver.
//
// Rappels CONTEXTUELS (roadmap §F9) : deux points de contrôle par jour, un
// push maximum à chacun.
//   • 14h  — regarde le petit-déjeuner et le déjeuner
//   • 21h  — regarde le petit-déjeuner, le déjeuner et le dîner
// À chaque check : si un repas ATTENDU (activé dans meal_enabled) n'a aucune
// entrée au journal du jour, on envoie un rappel qui nomme ce qui manque.
// La collation n'est jamais réclamée. L'hydratation a ses propres rappels
// (water-reminder). À défaut de repas manquant, on retombe sur le rappel
// « repas planifié pas encore marqué mangé ».
//
// Anti-doublon par utilisateur : settings.notif_reminder_state
//   { "d": "YYYY-MM-DD", "sent": ["midday"|"evening"] }
// (on ignore la valeur si "d" n'est pas la date du jour).
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

// Points de contrôle : heure locale Europe/Paris → repas à surveiller (dans
// l'ordre d'affichage). La collation n'est jamais réclamée.
const CHECKPOINTS: Record<number, { key: string; meals: string[] }> = {
  14: { key: 'midday', meals: ['Petit-déjeuner', 'Déjeuner'] },
  21: { key: 'evening', meals: ['Petit-déjeuner', 'Déjeuner', 'Dîner'] },
}

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

// "A et B", "A, B et C"
function frList(items: string[]): string {
  if (items.length <= 1) return items[0] || ''
  return items.slice(0, -1).join(', ') + ' et ' + items[items.length - 1]
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

  const hour = parisHour()
  const checkpoint = CHECKPOINTS[hour]
  if (!checkpoint) {
    return new Response('not a checkpoint hour, skipped')
  }

  const today = parisDateStr()

  const { data: eligible } = await supabaseAdmin
    .from('settings')
    .select('user_id, meal_enabled, notif_reminder_state')
    .eq('notif_reminder_enabled', true)

  let sentCount = 0

  for (const row of eligible || []) {
    // État anti-doublon du jour.
    const raw = row.notif_reminder_state && typeof row.notif_reminder_state === 'object' ? row.notif_reminder_state : {}
    const state = raw.d === today ? { d: today, sent: Array.isArray(raw.sent) ? raw.sent : [] } : { d: today, sent: [] }
    if (state.sent.includes(checkpoint.key)) continue

    // Repas attendus à cette heure = ceux du checkpoint qui sont activés
    // (meal_enabled : true par défaut si absent).
    const mealEnabled = row.meal_enabled && typeof row.meal_enabled === 'object' ? row.meal_enabled : {}
    const expected = checkpoint.meals.filter((m) => mealEnabled[m] !== false)

    let title: string | null = null
    let body = ''

    if (expected.length > 0) {
      const { data: todayEntries } = await supabaseAdmin
        .from('journal')
        .select('meal')
        .eq('user_id', row.user_id)
        .eq('date', today)
        .neq('meal', 'Hydratation')

      const logged = new Set((todayEntries || []).map((e) => e.meal))
      const missing = expected.filter((m) => !logged.has(m))

      if (missing.length === expected.length) {
        title = checkpoint.key === 'midday' ? "Rien noté ce matin" : "Rien noté aujourd'hui"
        body = 'Un petit tour dans CaloriesTracker ?'
      } else if (missing.length > 0) {
        title = `${frList(missing)} pas encore noté${missing.length > 1 ? 's' : ''}`
        body = 'Tu veux compléter ta journée ?'
      }
    }

    // Pas de repas manquant → rappel "repas planifié pas encore mangé".
    if (!title) {
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

    if (title) {
      await sendToUser(row.user_id, { title, body, url: '/today' })
      sentCount++
    }

    // On marque le checkpoint traité même si rien n'a été envoyé (journée
    // complète) : inutile de re-checker cet utilisateur avant la prochaine.
    state.sent.push(checkpoint.key)
    await supabaseAdmin
      .from('settings')
      .update({ notif_reminder_state: state, last_reminder_sent_date: today })
      .eq('user_id', row.user_id)
  }

  return new Response(`checkpoint ${checkpoint.key}: ${sentCount} push sent`)
})
