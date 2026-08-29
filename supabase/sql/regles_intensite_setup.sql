-- =============================================
-- REGLES.INTENSITE — intensité du flux par jour de règles (Palier 7 du chantier
-- « manger en fonction du cycle menstruel »). Optionnel : NULL = non renseigné.
-- Valeurs côté client : 'leger' | 'moyen' | 'abondant' (voir PERIOD_FLOW dans
-- src/lib/cycle.js). Sert à nuancer le conseil « fer » (estimation des pertes).
--
-- Écrit le 2026-08-29. À exécuter une fois, à la main, dans le SQL editor
-- Supabase. Référence pour Claude Code ensuite (mêmes conventions que
-- supabase_schema.sql / regles_setup.sql).
--
-- L'intensité est saisie PAR BLOC de règles côté client (tous les jours
-- contigus reçoivent la même valeur) — voir CycleSection. La colonne est
-- quand même par jour pour rester cohérent avec la table (1 ligne = 1 jour).
-- =============================================

alter table regles
  add column if not exists intensite text;

-- Modifier l'intensité = UPDATE (le reste de la table reste insert/delete). On
-- ajoute donc une policy update, absente jusqu'ici.
create policy "regles_update_own" on regles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
