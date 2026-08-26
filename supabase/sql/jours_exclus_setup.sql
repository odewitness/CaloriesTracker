-- =============================================
-- JOURS EXCLUS — marque un jour comme exclu des stats globales (moyennes,
-- série en cours, jours objectif — voir HistoryPage.jsx), sans rien changer
-- au journal lui-même : le jour reste visible et modifiable normalement
-- (TodayPage / DayRecapPanel). Écrit le 2026-08-26. À exécuter une fois, à
-- la main, dans le SQL editor Supabase (pas de CLI connectée depuis Claude
-- Code — voir CLAUDE.md). Référence pour Claude Code par la suite, pas un
-- script à rejouer tel quel sur une base déjà migrée (mêmes conventions que
-- supabase_schema.sql).
--
-- Une ligne = un jour exclu pour cet utilisateur. Absence de ligne = jour
-- normalement compté. Toggle côté client = insert/delete (voir
-- src/hooks/useExcludedDays.js), pas de colonne à mettre à jour.
-- =============================================

create table if not exists jours_exclus (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id),
  date date not null,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists idx_jours_exclus_user_date on jours_exclus (user_id, date);

alter table jours_exclus enable row level security;

create policy "jours_exclus_select_own" on jours_exclus
  for select using (auth.uid() = user_id);
create policy "jours_exclus_insert_own" on jours_exclus
  for insert with check (auth.uid() = user_id);
create policy "jours_exclus_delete_own" on jours_exclus
  for delete using (auth.uid() = user_id);
-- Pas de policy update : le toggle exclu/inclus se fait par insert/delete
-- côté client, jamais de modification d'une ligne existante.
