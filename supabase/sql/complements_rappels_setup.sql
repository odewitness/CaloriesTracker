-- =============================================
-- RAPPELS DE COMPLÉMENTS — mise en place
-- Écrit le 2026-08-31. À exécuter une fois, à la main, dans le SQL editor
-- Supabase (pas de CLI connectée — voir CLAUDE.md). Référence pour Claude Code
-- par la suite, pas un script à rejouer tel quel sur une base déjà migrée.
--
-- Pré-requis (identiques à water_tracker_setup.sql) :
--   1. Notifications push déjà en place (push_notifications_setup.sql) :
--      extensions pg_cron / pg_net, secrets VAPID_* et PUSH_TRIGGER_SECRET,
--      Edge Function send-push déployée.
--   2. La nouvelle Edge Function complements-reminder doit être déployée AVEC
--      LA VÉRIFICATION JWT DÉSACTIVÉE (appelée par pg_cron, protégée par le
--      header x-push-secret).
--   3. PUSH_TRIGGER_SECRET identique à la valeur en dur ci-dessous.
-- =============================================

-- 1. COLONNE aliments_custom.rappel --------------------------------------
-- Rappel(s) d'un complément. Pertinent seulement pour
-- categorie = 'Compléments alimentaires'. Forme :
--   { "enabled": true, "heures": [8, 21], "jours": [0,1,2,3,4,5,6],
--     "stop_si_pris": true }
-- heures : entiers 0-23 (cron horaire, pas de minutes).
-- jours  : 0=lundi..6=dimanche ; vide/absent = tous les jours.
-- stop_si_pris (défaut true) : pas de rappel si déjà noté au journal ce jour.
-- null / enabled:false = aucun rappel.
alter table aliments_custom add column if not exists rappel jsonb;

-- 2. COLONNES settings --------------------------------------------------
-- Interrupteur maître (écran Profil > Notifications > Rappels compléments).
alter table settings add column if not exists notif_complements_enabled boolean not null default true;

-- Anti-doublon écrit par l'Edge Function (jamais lu côté client) :
--   { "<aliment_id>|<heure>": "YYYY-MM-DD" } = dernier envoi de chaque créneau.
alter table settings add column if not exists complements_reminder_state jsonb not null default '{}'::jsonb;

-- 3. CRON — rappels de compléments ------------------------------------
-- Toutes les heures à la minute 6 (daily-reminder minute 0, water-reminder
-- minute 3 — on décale pour ne pas empiler les appels). complements-reminder
-- se gate elle-même sur l'heure/jour locaux Europe/Paris et sur le rappel de
-- chaque complément.
select cron.schedule(
  'complements-reminder-hourly',
  '6 * * * *',
  $$
  select net.http_post(
    url := 'https://afczgttnakutfqoctumu.supabase.co/functions/v1/complements-reminder',
    headers := '{"Content-Type": "application/json", "x-push-secret": "VbaSQ8Kz_puHmTQDsKdvZ0NYk40AZHsN"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Pour retirer le cron plus tard :
--   select cron.unschedule('complements-reminder-hourly');
