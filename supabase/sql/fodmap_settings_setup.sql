-- =============================================
-- SETTINGS.FODMAP — réglages de l'affichage FODMAP (chantier FODMAP,
-- Palier 1 — voir docs/fodmap.md).
--
-- Écrit le 2026-09-26. À exécuter une fois, à la main, dans le SQL editor
-- Supabase, AVANT le merge sur main de la branche feature/fodmap-fiche-aliment :
-- useSettings réécrit toute la ligne `settings` à chaque réglage modifié, avec
-- la clé `fodmap` ; tant que la colonne n'existe pas, ces sauvegardes
-- échoueraient (colonne inconnue).
--
-- { "enabled": bool } — affiche la charge en FODMAP dans les fiches aliments.
-- Fusionné côté client avec FODMAP_DEFAULTS (src/lib/fodmap.js). Défaut =
-- désactivé (opt-in, pour chaque compte).
-- =============================================

alter table settings
  add column if not exists fodmap jsonb not null default '{"enabled":false}'::jsonb;

-- Vérification : doit renvoyer une ligne par compte avec {"enabled": false}.
select user_id, fodmap from settings;
