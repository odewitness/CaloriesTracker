-- =============================================
-- ORDRE DES SECTIONS DE LA PAGE DU JOUR — colonne ajoutée le 2026-08-30.
-- À exécuter une fois, à la main, dans le SQL editor Supabase (pas de CLI
-- connectée depuis Claude Code — voir CLAUDE.md). Référence pour Claude Code
-- par la suite, pas un script à rejouer tel quel sur une base déjà migrée.
--
-- `settings.ordre_sections_jour` : tableau JSON des clés des blocs de contenu
-- de la page du jour, dans l'ordre choisi par l'utilisatrice (réglé depuis
-- Profil > Page du jour). Clés possibles :
--   'phase'       — pastille de phase du cycle (si le suivi de cycle est activé)
--   'bilan'       — carte Bilan calorique (anneau de calories)
--   'nutriments'  — Détail des nutriments
--   'manques'     — À combler aujourd'hui (le jour même, si activé)
--   'repas'       — Repas du jour
--   'complements' — Compléments
--   'eau'         — carte Eau
-- Fusionné côté client avec l'ordre par défaut (normalizeTodaySectionsOrder
-- dans src/lib/todaySections.js), comme meal_enabled / water : robuste si la
-- valeur stockée est partielle, ancienne ou nulle.
-- =============================================

alter table settings
  add column if not exists ordre_sections_jour jsonb not null
  default '["phase","bilan","nutriments","manques","repas","complements","eau"]'::jsonb;
