-- =============================================
-- ACTIVITES_SPORT — séances de sport, saisies à la main (Palier 1 du chantier
-- « Suivi de l'activité sportive », voir docs/suivi-sport.md).
--
-- UNE LIGNE = UNE SÉANCE. `source` = 'manuel' au Palier 1 ; 'strava' plus tard
-- (Palier 5), avec `source_id` = id de l'activité côté fournisseur pour la
-- déduplication des imports. `modifie_manuellement` : posé à true dès qu'une
-- séance importée est retouchée, pour qu'une resynchro ne l'écrase pas.
--
-- Écrit le 2026-08-30. À exécuter une fois, à la main, dans le SQL editor
-- Supabase (pas de CLI connectée depuis Claude Code — voir CLAUDE.md).
-- Référence pour Claude Code ensuite, pas un script à rejouer sur une base
-- déjà migrée (mêmes conventions que supabase_schema.sql / regles_setup.sql).
--
-- App utilisée par deux comptes → RLS « own » stricte (pattern mensurations /
-- regles), surtout PAS le pattern mono-utilisateur de journal / settings.
-- =============================================

create table if not exists activites_sport (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id),
  date date not null,
  heure_debut time,                        -- nullable
  type text not null,                      -- clé de SPORT_TYPES (src/lib/sport.js)
  duree_min numeric not null,
  distance_km numeric,                     -- nullable (selon le type)
  intensite text,                          -- nullable : 'faible' | 'moderee' | 'elevee'
  energie_kcal numeric,                    -- nullable : estimée (MET) ou source, éditable
  fc_moyenne integer,                      -- nullable
  fc_max integer,                          -- nullable
  source text not null default 'manuel',   -- 'manuel' | 'strava'
  source_id text,                          -- nullable : id externe, déduplication des imports
  modifie_manuellement boolean not null default false,
  notes text,                              -- nullable
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_activites_sport_source
  on activites_sport (user_id, source, source_id) where source_id is not null;
create index if not exists idx_activites_sport_user_date
  on activites_sport (user_id, date desc);

alter table activites_sport enable row level security;

create policy "activites_sport_select_own" on activites_sport
  for select using (auth.uid() = user_id);
create policy "activites_sport_insert_own" on activites_sport
  for insert with check (auth.uid() = user_id);
create policy "activites_sport_update_own" on activites_sport
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "activites_sport_delete_own" on activites_sport
  for delete using (auth.uid() = user_id);

-- Réglages du suivi sport : bloc jsonb unique sur `settings`, même pattern que
-- `settings.water` / `settings.cycle`. Fusionné côté client avec SPORT_DEFAULTS
-- (src/lib/sport.js) via useSettings. Défaut = fonctionnalité désactivée
-- (opt-in). Voir docs/suivi-sport.md §4.1 pour la forme du bloc.
-- `mode_energie` ('aucun' | 'bilan' | 'manger_selon_effort') n'a AUCUN effet
-- sur les cibles au Palier 1 (branché aux Paliers 6/7).
alter table settings
  add column if not exists sport jsonb not null default '{
    "enabled": false,
    "objectif_hebdo_minutes": 150,
    "objectif_hebdo_seances": 0,
    "afficher_page_jour": true,
    "afficher_calendrier": true,
    "mode_energie": "aucun",
    "depense_max_creditee_kcal": 400,
    "rappels": { "enabled": false, "jours": [], "heure": 18 },
    "strava": { "connected": false, "athlete_nom": null, "derniere_synchro": null, "auto": true }
  }'::jsonb;

-- Ajoute le bloc « Activité » (clé 'sport') à l'ordre par défaut des sections
-- de la page du jour, entre « Repas du jour » et « Compléments ». Les lignes
-- déjà enregistrées sont complétées côté client (normalizeTodaySectionsOrder,
-- src/lib/todaySections.js) — ce nouveau défaut ne concerne que les comptes
-- sans réglage d'ordre existant.
alter table settings
  alter column ordre_sections_jour
  set default '["phase","bilan","nutriments","manques","repas","sport","complements","eau"]'::jsonb;
