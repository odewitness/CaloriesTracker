-- =============================================
-- REGLES.SYMPTOMES — symptômes par jour de règles (Palier 8 du chantier
-- « manger en fonction du cycle menstruel »). Optionnel : NULL = non renseigné.
-- Tableau de texte : clés prédéfinies (voir PERIOD_SYMPTOMS dans
-- src/lib/cycle.js) et/ou entrées libres saisies à la main, mélangées.
-- Données privées : visibles seulement par l'utilisatrice (RLS "own", déjà en
-- place sur `regles` — aucune nouvelle policy nécessaire, la policy update
-- ajoutée pour `intensite` couvre aussi cette colonne).
--
-- Écrit le 2026-08-30. À exécuter une fois, à la main, dans le SQL editor
-- Supabase. Référence pour Claude Code ensuite (mêmes conventions que
-- supabase_schema.sql / regles_setup.sql / regles_intensite_setup.sql).
-- =============================================

alter table regles
  add column if not exists symptomes text[];
