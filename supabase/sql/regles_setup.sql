-- =============================================
-- REGLES — jours de règles, saisis à la main (l'app tierce de suivi de cycle
-- utilisée aujourd'hui n'exporte rien). UNE LIGNE = UN JOUR de règles (la
-- durée varie d'un cycle à l'autre, on marque chaque jour). Le calcul de la
-- phase du cycle regroupe les jours contigus en « règles », dont le 1er jour
-- de chaque bloc sert de repère de cycle (voir src/lib/cycle.js,
-- src/hooks/useCycle.js, docs/cycle-menstruel.md).
--
-- Écrit le 2026-08-29 (chantier « manger en fonction du cycle menstruel »,
-- Palier 1). À exécuter une fois, à la main, dans le SQL editor Supabase
-- (pas de CLI connectée depuis Claude Code — voir CLAUDE.md). Référence pour
-- Claude Code ensuite, pas un script à rejouer sur une base déjà migrée
-- (mêmes conventions que supabase_schema.sql / jours_exclus_setup.sql).
--
-- NB : une 1re version (date_debut / date_fin, une ligne par règles) a été
-- rédigée puis abandonnée avant tout usage. Si tu l'avais déjà exécutée,
-- décommente la ligne suivante pour repartir propre (table vide, aucun
-- risque de perte de données) :
-- drop table if exists regles cascade;
-- =============================================

create table if not exists regles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id),
  date date not null,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists idx_regles_user_date on regles (user_id, date);

alter table regles enable row level security;

create policy "regles_select_own" on regles
  for select using (auth.uid() = user_id);
create policy "regles_insert_own" on regles
  for insert with check (auth.uid() = user_id);
create policy "regles_delete_own" on regles
  for delete using (auth.uid() = user_id);
-- Pas de policy update : un jour est présent ou absent, on insert/delete
-- (même esprit que jours_exclus).

-- Réglages du suivi de cycle : bloc jsonb unique sur `settings`, même pattern
-- que `settings.water`. Fusionné côté client avec CYCLE_DEFAULTS
-- (src/lib/cycle.js) via useSettings. Défaut = fonctionnalité désactivée
-- (opt-in). Voir docs/cycle-menstruel.md §4.1 pour la forme du bloc.
alter table settings
  add column if not exists cycle jsonb not null default '{
    "enabled": false,
    "sous_contraception": false,
    "longueur_cycle": 28,
    "auto_longueur_cycle": true,
    "longueur_luteale": 14,
    "longueur_regles": 5,
    "afficher_sur_calendrier": true,
    "afficher_badge_jour": true,
    "afficher_conseils_micro": true,
    "appliquer_delta_energie": false,
    "delta_energie_luteale_kcal": 120
  }'::jsonb;
