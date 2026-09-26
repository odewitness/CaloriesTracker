-- =============================================
-- ALIMENTS_CUSTOM.FODMAP — réglage FODMAP d'un aliment perso (chantier
-- FODMAP, Palier 3b — voir docs/fodmap.md).
--
-- Écrit le 2026-09-26. À exécuter une fois, à la main, dans le SQL editor
-- Supabase, AVANT le merge sur main de la branche feature/fodmap-aliments-perso :
-- le formulaire d'aliment perso écrit la clé `fodmap` quand l'affichage FODMAP
-- est activé ; tant que la colonne n'existe pas, ces sauvegardes échoueraient.
--
-- null = aucun réglage (tout est calculé). Sinon objet, une clé par famille
-- réglée : { "oligo" | "fructose" | "polyols" | "lactose": "absent" | "present" }.
-- Clé absente = « Auto ».
-- =============================================

alter table aliments_custom
  add column if not exists fodmap jsonb;

-- Vérification : la colonne existe et vaut null partout.
select count(*) as total, count(fodmap) as avec_reglage from aliments_custom;
