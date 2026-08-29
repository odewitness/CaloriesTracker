-- =============================================
-- REGLES — dates de 1er jour des règles, saisies à la main (l'app tierce
-- utilisée aujourd'hui n'exporte rien). Une ligne = un début de règles pour
-- cet utilisateur. Sert de base au calcul de la phase du cycle menstruel
-- (voir src/lib/cycle.js et docs/cycle-menstruel.md).
--
-- Écrit le 2026-08-29 (chantier « manger en fonction du cycle menstruel »,
-- Palier 1). À exécuter une fois, à la main, dans le SQL editor Supabase
-- (pas de CLI connectée depuis Claude Code — voir CLAUDE.md). Référence pour
-- Claude Code ensuite, pas un script à rejouer sur une base déjà migrée
-- (mêmes conventions que supabase_schema.sql / jours_exclus_setup.sql).
--
-- `date_fin` est nullable et pas utilisée au Palier 1 : réservée à un futur
-- suivi de flux (durée / intensité des règles). Toggle côté client =
-- insert/delete (voir src/hooks/useCycle.js), corrections = update de
-- date_debut ou delete + re-insert.
-- =============================================

create table if not exists regles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id),
  date_debut date not null,
  date_fin date,
  created_at timestamptz not null default now(),
  unique (user_id, date_debut)
);

create index if not exists idx_regles_user_date on regles (user_id, date_debut);

alter table regles enable row level security;

create policy "regles_select_own" on regles
  for select using (auth.uid() = user_id);
create policy "regles_insert_own" on regles
  for insert with check (auth.uid() = user_id);
create policy "regles_update_own" on regles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "regles_delete_own" on regles
  for delete using (auth.uid() = user_id);

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
