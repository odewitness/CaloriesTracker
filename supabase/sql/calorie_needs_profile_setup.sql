-- =============================================
-- CALCULATEUR DE BESOINS CALORIQUES — colonnes profil
-- Écrit le 2026-08-18. À exécuter une fois, à la main, dans le SQL editor
-- Supabase (pas de CLI connectée depuis Claude Code — voir CLAUDE.md).
-- Référence pour Claude Code par la suite, pas un script à rejouer tel quel
-- sur une base déjà migrée (mêmes conventions que supabase_schema.sql).
--
-- Ajoute à `profiles` les 3 champs nécessaires au calcul BMR/TDEE
-- (Mifflin-St Jeor) utilisé par le calculateur de la page Profil.
-- =============================================

-- sexe : 'H' ou 'F'.
alter table profiles add column if not exists sexe text;

-- Taille corporelle (hauteur) en cm. À NE PAS CONFONDRE avec
-- mensurations.taille_cm qui désigne le tour de taille (table différente,
-- même nom malheureusement déjà pris par une autre mesure).
alter table profiles add column if not exists taille_cm numeric;

-- Niveau d'activité : 'sedentaire' | 'leger' | 'modere' | 'actif' | 'tres_actif'
-- (voir ACTIVITY_LEVELS dans src/lib/nutrients.js pour le détail de chaque
-- multiplicateur).
alter table profiles add column if not exists niveau_activite text;
