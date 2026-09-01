-- =============================================
-- PLAN DE CUISINE — étapes réordonnables de « Ma fournée » (roadmap §M9,
-- palier « ordonnancement manuel »), rattachées à UNE semaine (colonne
-- `semaine` = lundi 'YYYY-MM-DD', comme batch_cooking_items).
--
-- À partir des recettes de la fournée de la semaine, on met bout à bout
-- TOUTES leurs étapes d'instructions (une ligne = une étape, via
-- parseInstructionSteps), et l'utilisatrice les réorganise + les coche.
-- Chaque étape garde le nom de sa recette (badge de couleur).
--
-- UNE LIGNE = UNE ÉTAPE. `texte` est un snapshot (un bouton « Régénérer »
-- reconstruit tout depuis les recettes actuelles de la fournée).
--
-- Écrit le 2026-09-01. Colonne `semaine` d'origine. À exécuter à la main
-- dans le SQL editor Supabase (voir CLAUDE.md).
-- =============================================

create table if not exists batch_cooking_steps (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id),
  semaine date not null,       -- lundi de la semaine (convention calendrier)
  recette_id uuid references recettes(id) on delete set null,
  recette_nom text not null,   -- snapshot pour le badge
  texte text not null,         -- snapshot de l'étape (texte brut ; grammages ré-injectés à l'affichage)
  ordre integer not null default 0,
  fait boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_batch_cooking_steps_user_semaine
  on batch_cooking_steps (user_id, semaine, ordre);

alter table batch_cooking_steps enable row level security;

create policy "batch_cooking_steps_select_own" on batch_cooking_steps
  for select using (auth.uid() = user_id);
create policy "batch_cooking_steps_insert_own" on batch_cooking_steps
  for insert with check (auth.uid() = user_id);
-- update : réordonner (ordre) et cocher (fait) sur la ligne existante.
create policy "batch_cooking_steps_update_own" on batch_cooking_steps
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "batch_cooking_steps_delete_own" on batch_cooking_steps
  for delete using (auth.uid() = user_id);

-- ── Migration « plan par semaine » (2026-09-01) ──────────────────────────
-- Sur une base où batch_cooking_steps existait déjà SANS colonne `semaine` :
--
--   alter table batch_cooking_steps add column if not exists semaine date;
--   update batch_cooking_steps
--     set semaine = date_trunc('week', now())::date
--     where semaine is null;
--   alter table batch_cooking_steps alter column semaine set not null;
--   create index if not exists idx_batch_cooking_steps_user_semaine
--     on batch_cooking_steps (user_id, semaine, ordre);
