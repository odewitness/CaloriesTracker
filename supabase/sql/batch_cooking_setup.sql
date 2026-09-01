-- =============================================
-- BATCH COOKING — page « Ma fournée » (roadmap §M9, Palier 3 du chantier
-- planificateur de repas). Check-list des recettes à cuisiner, rattachée à
-- UNE semaine (colonne `semaine` = lundi 'YYYY-MM-DD') : chaque semaine de la
-- vue Menus a sa propre fournée.
--
-- UNE LIGNE = UNE RECETTE dans la fournée d'une semaine.
--
-- Écrit le 2026-09-01. Colonne `semaine` ajoutée le 2026-09-01 (voir la
-- section « migration » plus bas). À exécuter à la main dans le SQL editor
-- Supabase (pas de CLI connectée depuis Claude Code — voir CLAUDE.md).
-- Référence pour Claude Code ensuite, pas un script à rejouer tel quel.
-- =============================================

create table if not exists batch_cooking_items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id),
  semaine date not null,            -- lundi de la semaine (convention calendrier)
  recette_id uuid references recettes(id) on delete set null,
  repas_type_id uuid references repas_types(id) on delete set null,
  nom text not null,                -- snapshot du nom (garde la ligne lisible si la source est supprimée)
  portions numeric,                 -- quantité à préparer, optionnelle (nombre de portions)
  fait boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, semaine, recette_id),     -- une recette n'entre qu'une fois par semaine
  unique (user_id, semaine, repas_type_id)   -- idem pour un repas type
);

create index if not exists idx_batch_cooking_items_user_semaine
  on batch_cooking_items (user_id, semaine);

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

-- ── Migration « fournée par semaine » (2026-09-01) ────────────────────────
-- Sur une base où batch_cooking_items existait déjà SANS colonne `semaine` :
--
--   alter table batch_cooking_items add column if not exists semaine date;
--   update batch_cooking_items
--     set semaine = date_trunc('week', now())::date
--     where semaine is null;
--   alter table batch_cooking_items alter column semaine set not null;
--   alter table batch_cooking_items
--     drop constraint if exists batch_cooking_items_user_id_recette_id_key;
--   alter table batch_cooking_items
--     add constraint batch_cooking_items_user_semaine_recette_key
--     unique (user_id, semaine, recette_id);
--   create index if not exists idx_batch_cooking_items_user_semaine
--     on batch_cooking_items (user_id, semaine);
--
-- ── Migration « repas types dans la fournée » (2026-09-01) ────────────────
--   alter table batch_cooking_items
--     add column if not exists repas_type_id uuid references repas_types(id) on delete set null;
--   alter table batch_cooking_items
--     add constraint batch_cooking_items_user_semaine_repastype_key
--     unique (user_id, semaine, repas_type_id);
