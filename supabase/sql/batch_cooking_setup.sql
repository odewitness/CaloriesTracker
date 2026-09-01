-- =============================================
-- BATCH COOKING — page « Ma fournée » (roadmap §M9, Palier 3 du chantier
-- planificateur de repas). Une check-list unique des recettes à cuisiner
-- lors d'une session de meal prep, indépendante du planificateur : on y
-- ajoute des recettes, on coche « fait » au fur et à mesure, on retire.
--
-- V1 : UNE seule liste courante par utilisatrice (pas de sessions nommées
-- ni d'historique — piste palier ultérieur). Une ligne = une recette dans
-- la fournée en cours.
--
-- Écrit le 2026-09-01. À exécuter UNE fois, à la main, dans le SQL editor
-- Supabase (pas de CLI connectée depuis Claude Code — voir CLAUDE.md).
-- Référence pour Claude Code ensuite, pas un script à rejouer tel quel sur
-- une base déjà migrée (mêmes conventions que supabase_schema.sql).
-- =============================================

create table if not exists batch_cooking_items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id),
  recette_id uuid references recettes(id) on delete set null,
  nom text not null,               -- snapshot du nom (garde la ligne lisible si la recette est supprimée)
  portions numeric,                -- quantité à préparer, optionnelle (nombre de portions)
  fait boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, recette_id)     -- une même recette n'entre qu'une fois dans la fournée (NULL non concerné)
);

create index if not exists idx_batch_cooking_items_user
  on batch_cooking_items (user_id, created_at);

alter table batch_cooking_items enable row level security;

create policy "batch_cooking_items_select_own" on batch_cooking_items
  for select using (auth.uid() = user_id);
create policy "batch_cooking_items_insert_own" on batch_cooking_items
  for insert with check (auth.uid() = user_id);
-- update : cocher « fait » et éditer les portions se font sur la ligne existante.
create policy "batch_cooking_items_update_own" on batch_cooking_items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "batch_cooking_items_delete_own" on batch_cooking_items
  for delete using (auth.uid() = user_id);
