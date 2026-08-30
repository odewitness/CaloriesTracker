-- =============================================
-- OBJECTIF CALORIQUE ADAPTATIF (roadmap §M3) — colonne de réglage.
-- Écrit le 2026-08-30. À exécuter une fois, à la main, dans le SQL editor
-- Supabase. Référence pour Claude Code ensuite.
--
-- L'app compare la tendance réelle du poids (mensurations, ~3 semaines) au
-- rythme que l'objectif calorique actuel est censé produire (deficit visé =
-- TDEE − goal_kcal), et PROPOSE — jamais n'impose — un ajustement de
-- `goal_kcal` de ±100 kcal max (bandeau sur la page du jour). Voir
-- src/hooks/useGoalAdjustment.js et src/components/GoalAdjustBanner.jsx.
--
-- `goal_auto_adjust` :
--   { "enabled": bool, "last_prompt": "YYYY-MM-DD" | null }
-- `enabled` : opt-in, réglé depuis Profil › Objectifs nutritionnels.
-- `last_prompt` : date de la dernière proposition (appliquée OU reportée) —
--   throttle : pas de nouvelle proposition avant 7 jours.
-- Fusionné côté client avec GOAL_AUTO_ADJUST_DEFAULTS (src/hooks/useSettings.js),
-- comme meal_enabled / water / cycle / sport.
-- =============================================

alter table settings add column if not exists goal_auto_adjust jsonb not null
  default '{"enabled":false,"last_prompt":null}'::jsonb;
