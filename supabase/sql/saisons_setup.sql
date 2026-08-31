-- =============================================
-- SAISONS — colonne `saisons text[]` sur recettes, repas_types et
-- partages_recettes.
--
-- Multi-sélection de saison(s) assignable à une recette et à un repas type,
-- sur le même modèle que la colonne `categories text[]` existante (valeurs
-- libellées côté client : voir SEASONS dans src/lib/seasons.js — 'Printemps' |
-- 'Été' | 'Automne' | 'Hiver'). Sert à filtrer les listes de recettes / repas
-- types par saison. La colonne sur partages_recettes n'existe que pour
-- snapshoter la saison au moment d'un partage social (reprise par
-- « Ajouter à mes recettes »).
--
-- Écrit le 2026-08-31. À exécuter une fois, à la main, dans le SQL editor
-- Supabase (pas de CLI connectée — voir CLAUDE.md). Référence, pas un script à
-- rejouer sur une base déjà migrée.
-- =============================================

alter table recettes          add column if not exists saisons text[] not null default '{}';
alter table repas_types       add column if not exists saisons text[] not null default '{}';
alter table partages_recettes add column if not exists saisons text[] not null default '{}';
