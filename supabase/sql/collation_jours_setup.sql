-- =============================================
-- COLLATION_JOURS — surcharge « par jour » de l'activation de la Collation.
--
-- La Collation s'activait/désactivait uniquement en global via
-- settings.meal_enabled.Collation (voir src/components/profile/MealSplitSection.jsx).
-- Cette table permet de surcharger cet état POUR UN JOUR précis, depuis
-- l'interrupteur de la carte Collation de la page du jour
-- (src/components/MealSection.jsx + src/hooks/useCollationDay.js).
--
-- Sémantique :
--   ligne présente  → surcharge explicite pour ce jour (`active` = true/false)
--   ligne absente   → on suit le défaut global settings.meal_enabled.Collation
--
-- UNE LIGNE = UN JOUR. App à deux comptes → RLS « own » stricte, comme
-- pas_jour / jours_exclus. La policy update sert au ré-enregistrement d'un jour
-- (upsert on conflict user_id,date quand on rebascule l'interrupteur).
--
-- Écrit le 2026-08-31. À exécuter une fois, à la main, dans le SQL editor
-- Supabase (pas de CLI connectée — voir CLAUDE.md). Référence, pas un script à
-- rejouer sur une base déjà migrée.
-- =============================================

create table if not exists collation_jours (
  user_id uuid not null references auth.users(id),
  date date not null,
  active boolean not null,                  -- surcharge explicite pour ce jour
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

create index if not exists idx_collation_jours_user_date on collation_jours (user_id, date desc);

alter table collation_jours enable row level security;

create policy "collation_jours_select_own" on collation_jours
  for select using (auth.uid() = user_id);
create policy "collation_jours_insert_own" on collation_jours
  for insert with check (auth.uid() = user_id);
create policy "collation_jours_update_own" on collation_jours
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "collation_jours_delete_own" on collation_jours
  for delete using (auth.uid() = user_id);
