// Invoquée toutes les heures par un Cron Job Supabase (voir
// supabase/sql/water_tracker_setup.sql). Contrairement à daily-reminder, pas
// de gate sur une heure unique : chaque utilisatrice choisit quand être
// rappelée (mode "interval" toutes les X h dans une plage horaire, "once" une
// fois par jour, "smart" seulement si elle n'a pas assez bu). Le gate se fait
// donc ici, par utilisatrice, sur l'heure locale Europe/Paris.
//
// Fichier volontairement autonome (pas d'import partagé avec
// send-push/daily-reminder) pour permettre un déploiement par copier/coller
// dans l'éditeur du dashboard Supabase, sans la CLI.
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const PUSH_TRIGGER_SECRET = Deno.env.get('PUSH_TRIGGER_SECRET')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

webpush.setVapidDetails('mailto:remplace-moi@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const WATER_MEAL = 'Hydratation'

function parisHour(): number {
  return parseInt(
    new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: 'numeric', hour12: false }).format(new Date()),
    10,
  )
}

function parisDateStr(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

const litres = (ml: number) => (Math.max(0, ml) / 1000).toFixed(1).replace('.', ',')

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

type WaterNotif = {
  enabled?: boolean
  mode?: 'interval' | 'once' | 'smart'
  every_h?: number
  start_h?: number
  end_h?: number
  once_h?: number
  smart_h?: number
  smart_threshold?: number
  stop_when_done?: boolean
}

function shouldSend(n: WaterNotif, hour: number, lastAtISO: string | null, todayStr: string, pct: number): boolean {
  if (!n.enabled) return false
  if (n.stop_when_done !== false && pct >= 1) return false

  const lastAt = lastAtISO ? new Date(lastAtISO) : null
  const lastWasToday = lastAt ? parisDateStr(lastAt) === todayStr : false

  if (n.mode === 'once') {
    return hour === (n.once_h ?? 13) && !lastWasToday
  }
  if (n.mode === 'smart') {
    return hour === (n.smart_h ?? 17) && !lastWasToday && pct * 100 < (n.smart_threshold ?? 60)
  }
  // interval (défaut)
  const start = n.start_h ?? 8
  const end = n.end_h ?? 21
  const every = n.every_h ?? 2
  if (hour < start || hour > end) return false
  if (!lastAt) return true
  const hoursSince = (Date.now() - lastAt.getTime()) / 3_600_000
  return hoursSince >= every - 0.01
}

Deno.serve(async (req) => {
  if (req.headers.get('x-push-secret') !== PUSH_TRIGGER_SECRET) {
    return new Response('unauthorized', { status: 401 })
  }

  const hour = parisHour()
  const today = parisDateStr()

  const { data: rows } = await supabaseAdmin
    .from('settings')
    .select('user_id, water, water_last_reminder_at')

  let sent = 0
  for (const row of rows || []) {
    const cfg = (row.water || {}) as { goal_ml?: number; notif?: WaterNotif }
    const notif = cfg.notif || {}
    if (!notif.enabled) continue

    const goalMl = cfg.goal_ml || 2000

    const { data: entries } = await supabaseAdmin
      .from('journal')
      .select('qty_g')
      .eq('user_id', row.user_id)
      .eq('date', today)
      .eq('meal', WATER_MEAL)

    const totalMl = (entries || []).reduce((s, e) => s + (Number(e.qty_g) || 0), 0)
    const pct = goalMl > 0 ? totalMl / goalMl : 0

    if (!shouldSend(notif, hour, row.water_last_reminder_at, today, pct)) continue

    const body = pct >= 0.5
      ? `Plus que ${litres(goalMl - totalMl)} L pour atteindre ton objectif`
      : `${litres(totalMl)} L sur ${litres(goalMl)} L aujourd'hui`

    await sendToUser(row.user_id, { title: 'Pense à boire 💧', body, url: '/today' })
    await supabaseAdmin.from('settings').update({ water_last_reminder_at: new Date().toISOString() }).eq('user_id', row.user_id)
    sent++
  }

  return new Response(`water-reminder: ${sent} sent (paris hour ${hour})`)
})
