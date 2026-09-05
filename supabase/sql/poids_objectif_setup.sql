-- =============================================
-- OBJECTIF DE POIDS PERSISTANT — colonne de réglage (voir docs/objectif-poids.md).
-- Écrit le 2026-09-05. À exécuter une fois, à la main, dans le SQL editor
-- Supabase. Référence pour Claude Code ensuite.
--
-- Poids désiré + date visée, saisis une fois et conservés (avant : le
-- calculateur de calories de Profil > Objectifs demandait déjà ces deux
-- valeurs, mais seulement pour un calcul ponctuel, jamais persisté).
--
-- `poids_objectif` :
--   { "poids_desire": number | null, "date_objectif": "YYYY-MM-DD" | null }
-- Fusionné côté client avec GOAL_WEIGHT_DEFAULTS (src/lib/poidsObjectif.js),
-- comme meal_enabled / water / cycle / sport / goal_auto_adjust.
--
-- Palier 1 : affichage seul (comparaison rythme nécessaire / rythme réel dans
-- Profil > Objectifs). Palier 2 prévoit de brancher useGoalAdjustment dessus.
-- =============================================

alter table settings add column if not exists poids_objectif jsonb not null
  default '{"poids_desire":null,"date_objectif":null}'::jsonb;
