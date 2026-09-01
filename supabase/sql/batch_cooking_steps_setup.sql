-- =============================================
-- PLAN DE CUISINE — étapes réordonnables de « Ma fournée » (roadmap §M9,
-- palier « ordonnancement manuel »). À partir des recettes de la fournée, on
-- met bout à bout TOUTES leurs étapes d'instructions (une ligne = une étape,
-- via parseInstructionSteps), et l'utilisatrice les réorganise dans l'ordre
-- où elle veut cuisiner + les coche au fur et à mesure. Chaque étape garde le
-- nom de sa recette (badge de couleur) pour ne pas perdre le fil.
--
-- V1 : UN seul plan courant par utilisatrice. UNE LIGNE = UNE ÉTAPE. Le texte
-- est un snapshot (la ligne reste lisible si l'instruction de la recette
-- change) ; un bouton « Régénérer » reconstruit tout depuis les recettes
-- actuelles de la fournée.
--
-- Écrit le 2026-09-01. À exécuter UNE fois, à la main, dans le SQL editor
-- Supabase (pas de CLI connectée depuis Claude Code — voir CLAUDE.md).
-- Référence pour Claude Code ensuite, pas un script à rejouer tel quel.
-- =============================================

create table if not exists batch_cooking_steps (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id),
  recette_id uuid references recettes(id) on delete set null,
  recette_nom text not null,   -- snapshot pour le badge
  texte text not null,         -- snapshot de l'étape (texte brut ; grammages ré-injectés à l'affichage)
  ordre integer not null default 0,
  fait boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_batch_cooking_steps_user
  on batch_cooking_steps (user_id, ordre);

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
