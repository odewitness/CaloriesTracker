-- =============================================
-- SOMMEIL — suivi manuel des nuits (chantier « Suivi du sommeil », Paliers
-- 1-2 — voir docs/suivi-sommeil.md).
--
-- UNE LIGNE = UNE NUIT, rattachée à la DATE DU RÉVEIL : la nuit du 26 au 27
-- est enregistrée au 27. Une seule nuit par date (upsert sur user_id, date).
--
-- Visible pour les deux comptes (pas de feature flag) : RLS « own » stricte,
-- donnée de santé comme `regles` / `selles`.
--
-- Écrit le 2026-09-27. À exécuter une fois, à la main, dans le SQL editor
-- Supabase, AVANT de tester en local (npm run dev tape la base de prod) et
-- AVANT le merge sur main : useSettings réécrit tout l'objet settings à
-- chaque réglage, la colonne `settings.sommeil` doit donc exister, sinon tous
-- les réglages échouent (colonne inconnue).
-- =============================================

-- 1. TABLE -------------------------------------------------------------------

create table if not exists sommeil (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id),
  date date not null,                        -- date du RÉVEIL
  heure_endormissement time,                 -- nullable
  heure_reveil time,                         -- nullable
  duree_min smallint not null check (duree_min between 0 and 1440),
  qualite smallint check (qualite between 1 and 5),  -- nullable ; 1 😫 → 5 😄
  reveil_naturel boolean,                    -- réveil sans alarme ; nullable = non renseigné
  -- clés multi-sélection (Palier 4, voir SLEEP_FACTORS dans src/lib/sleep.js),
  -- même pattern que regles.symptomes / selles.remarques.
  facteurs text[] not null default '{}',
  sieste_min smallint check (sieste_min between 0 and 600), -- sieste de la journée `date` (Palier 6)
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);
-- L'index de la contrainte unique (user_id, date) sert aussi aux requêtes par
-- plage de dates : pas d'index supplémentaire.

alter table sommeil enable row level security;

create policy "sommeil_select_own" on sommeil
  for select using (auth.uid() = user_id);
create policy "sommeil_insert_own" on sommeil
  for insert with check (auth.uid() = user_id);
create policy "sommeil_update_own" on sommeil
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "sommeil_delete_own" on sommeil
  for delete using (auth.uid() = user_id);

-- 2. RÉGLAGES ----------------------------------------------------------------
-- Bloc unique, même pattern que settings.water / sport / cycle. Fusionné côté
-- client avec SLEEP_DEFAULTS (src/lib/sleep.js). Carte visible par défaut.
alter table settings add column if not exists sommeil jsonb not null default
  '{"card_visible":true,"objectif_min":480,"seuil_nuit_courte_min":45,"conseils_jour":true,"afficher_calendrier":false}'::jsonb;

-- Vérification : table vide, RLS activé, colonne settings présente.
select relname, relrowsecurity from pg_class where relname = 'sommeil';
select column_name from information_schema.columns where table_name = 'settings' and column_name = 'sommeil';
