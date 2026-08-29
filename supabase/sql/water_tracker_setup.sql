-- =============================================
-- TRACKER D'EAU — mise en place
-- Écrit le 2026-08-29. À exécuter une fois, à la main, dans le SQL editor
-- Supabase (pas de CLI connectée depuis Claude Code — voir CLAUDE.md).
-- Référence pour Claude Code par la suite, pas un script à rejouer tel quel
-- sur une base déjà migrée (mêmes conventions que supabase_schema.sql et
-- push_notifications_setup.sql).
--
-- Pré-requis :
--   1. La partie notifications push doit déjà être en place
--      (supabase/sql/push_notifications_setup.sql) : extensions pg_cron /
--      pg_net actives, secrets VAPID_* et PUSH_TRIGGER_SECRET définis,
--      Edge Function send-push déployée.
--   2. La nouvelle Edge Function water-reminder doit être déployée AVEC LA
--      VÉRIFICATION JWT DÉSACTIVÉE (appelée par pg_cron, pas par le
--      navigateur — protégée par le header x-push-secret).
--   3. PUSH_TRIGGER_SECRET doit être IDENTIQUE à la valeur codée en dur
--      ci-dessous (même convention que les identifiants Supabase déjà en
--      dur dans src/lib/supabase.js).
-- =============================================

-- 1. COLONNES SETTINGS ------------------------------------------------------

-- Bloc JSON unique (même pattern que settings.meal_enabled / meal_overrides).
-- Le client (src/lib/water.js WATER_DEFAULTS + mergeWaterSettings) fusionne
-- toujours avec ses propres valeurs par défaut, donc un bloc partiel est
-- toléré côté app — le default ci-dessous sert surtout aux lignes créées
-- directement en SQL et à l'Edge Function.
alter table settings add column if not exists water jsonb not null default
  '{
    "goal_ml": 2000,
    "default_food_ref_id": null,
    "portions": [
      {"id": "verre", "label": "Verre", "ml": 250},
      {"id": "bouteille", "label": "Bouteille", "ml": 500},
      {"id": "gourde", "label": "Gourde", "ml": 750}
    ],
    "card_visible": true,
    "notif": {
      "enabled": false, "mode": "interval", "every_h": 2,
      "start_h": 8, "end_h": 21, "once_h": 13, "smart_h": 17,
      "smart_threshold": 60, "stop_when_done": true
    }
  }'::jsonb;

-- Colonne à part (comme settings.last_reminder_sent_date) : l'Edge Function
-- water-reminder l'écrit à chaque envoi sans avoir à réécrire tout le blob
-- `water` (que le client édite de son côté).
alter table settings add column if not exists water_last_reminder_at timestamptz;

-- 2. CRON — rappels d'hydratation -----------------------------------------
-- Tourne toutes les heures à la minute 3 (daily-reminder tourne à la minute
-- 0 — on décale pour ne pas empiler les deux appels). water-reminder se gate
-- elle-même sur l'heure locale Europe/Paris et sur les réglages de chaque
-- utilisatrice (mode interval / once / smart), comme daily-reminder.
select cron.schedule(
  'water-reminder-hourly',
  '3 * * * *',
  $$
  select net.http_post(
    url := 'https://afczgttnakutfqoctumu.supabase.co/functions/v1/water-reminder',
    headers := '{"Content-Type": "application/json", "x-push-secret": "VbaSQ8Kz_puHmTQDsKdvZ0NYk40AZHsN"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Pour retirer le cron plus tard :
--   select cron.unschedule('water-reminder-hourly');
