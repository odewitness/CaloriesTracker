// Invoquée toutes les heures par un Cron Job Supabase (voir
// supabase/sql/complements_rappels_setup.sql). Comme water-reminder, pas de
// gate sur une heure unique : chaque complément porte ses propres heures de
// rappel (aliments_custom.rappel). Le gate se fait donc ici, par complément,
// sur l'heure et le jour locaux Europe/Paris.
//
// Un complément est rappelé si :
//   • rappel.enabled = true ET settings.notif_complements_enabled ≠ false
//   • l'heure locale ∈ rappel.heures
//   • rappel.jours vide OU contient le jour de semaine local (0=lun..6=dim)
//   • pas déjà rappelé aujourd'hui pour ce (complément, heure)
//     (settings.complements_reminder_state, anti-doublon)
//   • si rappel.stop_si_pris ≠ false : le complément n'est pas déjà au journal
//     du jour (meal='Compléments', food_ref_id = id du complément)
//
// Fichier volontairement autonome (pas d'import partagé avec
// send-push/daily-reminder/water-reminder) pour permettre un déploiement par
// copier/coller dans l'éditeur du dashboard Supabase, sans la CLI.
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const PUSH_TRIGGER_SECRET = Deno.env.get('PUSH_TRIGGER_SECRET')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

webpush.setVapidDetails('mailto:remplace-moi@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const COMPLEMENT_CATEGORY = 'Compléments alimentaires'
const SUPPLEMENT_MEAL = 'Compléments'

function parisHour(): number {
  return parseInt(
    new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: 'numeric', hour12: false }).format(new Date()),
    10,
  )
}

function parisDateStr(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

// 0 = lundi … 6 = dimanche (convention WEEKDAYS côté client).
function parisWeekday(): number {
  const en = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', weekday: 'short' }).format(new Date())
  const map: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }
  return map[en] ?? 0
}

async function sendToUser(userId: string, payload: { title: string; body: string; url: string }) {
  const { data: subs } = await supabaseAdmin.from('push_subscriptions').select('*').eq('user_id', userId)
  for (const sub of subs || []) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
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

type Rappel = {
  enabled?: boolean
  heures?: number[]
  jours?: number[]
  stop_si_pris?: boolean
}

Deno.serve(async (req) => {
  if (req.headers.get('x-push-secret') !== PUSH_TRIGGER_SECRET) {
    return new Response('unauthorized', { status: 401 })
  }

  const hour = parisHour()
  const today = parisDateStr()
  const dow = parisWeekday()

  // Réglages par utilisatrice : interrupteur maître + état anti-doublon.
  const { data: settingsRows } = await supabaseAdmin
    .from('settings')
    .select('user_id, notif_complements_enabled, complements_reminder_state')
  const byUser = new Map<string, { enabled: boolean; state: Record<string, string> }>()
  for (const row of settingsRows || []) {
    byUser.set(row.user_id, {
      enabled: row.notif_complements_enabled !== false,
      state: row.complements_reminder_state && typeof row.complements_reminder_state === 'object'
        ? row.complements_reminder_state as Record<string, string>
        : {},
    })
  }

  // Tous les compléments qui portent un rappel.
  const { data: sups } = await supabaseAdmin
    .from('aliments_custom')
    .select('id, user_id, nom, rappel, portions')
    .eq('categorie', COMPLEMENT_CATEGORY)
    .not('rappel', 'is', null)

  // Patchs d'état à écrire, groupés par utilisatrice.
  const patches = new Map<string, Record<string, string>>()
  const markState = (userId: string, key: string) => {
    if (!patches.has(userId)) patches.set(userId, {})
    patches.get(userId)![key] = today
  }

  let sent = 0

  for (const s of sups || []) {
    const r = (s.rappel || {}) as Rappel
    if (!r.enabled) continue

    const u = byUser.get(s.user_id)
    if (u && !u.enabled) continue

    if (!Array.isArray(r.heures) || !r.heures.includes(hour)) continue
    if (Array.isArray(r.jours) && r.jours.length > 0 && !r.jours.includes(dow)) continue

    const key = `${s.id}|${hour}`
    const existingState = { ...(u?.state || {}), ...(patches.get(s.user_id) || {}) }
    if (existingState[key] === today) continue

    if (r.stop_si_pris !== false) {
      const { data: taken } = await supabaseAdmin
        .from('journal')
        .select('id')
        .eq('user_id', s.user_id)
        .eq('date', today)
        .eq('meal', SUPPLEMENT_MEAL)
        .eq('food_ref_id', String(s.id))
        .limit(1)
      if (taken && taken.length > 0) { markState(s.user_id, key); continue }
    }

    const doseLabel = Array.isArray(s.portions) && s.portions[0]?.label ? ` (${s.portions[0].label})` : ''
    await sendToUser(s.user_id, {
      title: `💊 ${s.nom}`,
      body: `C'est l'heure de ta dose${doseLabel}.`,
      url: '/today',
    })
    markState(s.user_id, key)
    sent++
  }

  // Flush : on ne garde que les clés du jour (purge des dates passées).
  for (const [userId, patch] of patches) {
    const prev = byUser.get(userId)?.state || {}
    const merged: Record<string, string> = {}
    for (const [k, v] of Object.entries({ ...prev, ...patch })) {
      if (v === today) merged[k] = v
    }
    await supabaseAdmin.from('settings').update({ complements_reminder_state: merged }).eq('user_id', userId)
  }

  return new Response(`complements-reminder: ${sent} sent (paris hour ${hour}, dow ${dow})`)
})
