-- =============================================
-- SYMPTOMES_DIGESTIFS — symptômes notés sans passage dans le tracker de
-- transit (chantier FODMAP, Palier 4 — voir docs/fodmap.md §6).
--
-- UNE LIGNE = UN ÉPISODE (ex. « ballonnement + gaz, moyen, 15:30 »).
-- Table séparée de `selles` : `selles.bristol` est obligatoire et toutes les
-- stats de l'onglet Digestion supposent qu'une ligne = un passage ; y mêler
-- des symptômes fausserait fréquence et régularité. Côté utilisatrice, ça
-- reste un seul tracker (même carte « Transit », même feuille de saisie).
--
-- Réservé, comme `selles`, au compte STOOL_TRACKER_USER_ID côté client
-- (src/lib/featureFlags.js) ; la vraie barrière est la RLS « own » ci-dessous.
--
-- Écrit le 2026-09-26. À exécuter une fois, à la main, dans le SQL editor
-- Supabase, AVANT le merge sur main de la branche feature/fodmap-transit.
-- =============================================

create table if not exists symptomes_digestifs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id),
  date date not null default current_date,
  heure time,                              -- nullable
  -- clés multi-sélection : 'ballonnement' | 'douleur' | 'gaz' | 'urgence'
  -- (voir DIGESTIVE_SYMPTOMS dans src/lib/stool.js)
  symptomes text[] not null default '{}',
  intensite smallint check (intensite between 1 and 3), -- 1 légère, 2 moyenne, 3 forte ; nullable
  note text,                               -- nullable, texte libre
  created_at timestamptz not null default now()
);

create index if not exists idx_symptomes_digestifs_user_date on symptomes_digestifs (user_id, date desc);

alter table symptomes_digestifs enable row level security;

create policy "symptomes_digestifs_select_own" on symptomes_digestifs
  for select using (auth.uid() = user_id);
create policy "symptomes_digestifs_insert_own" on symptomes_digestifs
  for insert with check (auth.uid() = user_id);
create policy "symptomes_digestifs_update_own" on symptomes_digestifs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "symptomes_digestifs_delete_own" on symptomes_digestifs
  for delete using (auth.uid() = user_id);

-- Vérification : table vide, RLS activé.
select relname, relrowsecurity from pg_class where relname = 'symptomes_digestifs';
