-- =============================================
-- PAS_JOUR — total de pas d'une journée (chantier « Suivi de l'activité
-- sportive », Palier 10). UNE LIGNE = UN JOUR. Saisie manuelle (l'utilisatrice
-- recopie le total de son téléphone / sa montre). Data par utilisatrice,
-- RLS « own » stricte (pattern regles / mensurations / activites_sport).
--
-- + colonne `activites_sport.compte_dans_pas` : une séance (marche, tapis,
--   rando, course) marquée comme DÉJÀ incluse dans le total de pas du jour —
--   elle n'est alors pas recomptée en énergie dans le bilan / « manger selon
--   l'effort » (anti-doublon). Défaut false.
-- + clés `settings.sport` : `afficher_pas`, `objectif_pas_jour`,
--   `pas_seuil_baseline` (fusionnées côté client par mergeSportSettings, mais
--   on met le défaut à jour pour cohérence).
--
-- Écrit le 2026-08-30. À exécuter une fois, à la main, dans le SQL editor
-- Supabase (pas de CLI connectée — voir CLAUDE.md). Référence, pas un script à
-- rejouer sur une base déjà migrée.
-- =============================================

create table if not exists pas_jour (
  user_id uuid not null references auth.users(id),
  date date not null,
  nb_pas integer not null,
  source text not null default 'manuel',   -- 'manuel' | (import plus tard)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

create index if not exists idx_pas_jour_user_date on pas_jour (user_id, date desc);

alter table pas_jour enable row level security;

create policy "pas_jour_select_own" on pas_jour
  for select using (auth.uid() = user_id);
create policy "pas_jour_insert_own" on pas_jour
  for insert with check (auth.uid() = user_id);
create policy "pas_jour_update_own" on pas_jour
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "pas_jour_delete_own" on pas_jour
  for delete using (auth.uid() = user_id);

-- Séance déjà comptée dans le total de pas du jour (anti-doublon).
alter table activites_sport
  add column if not exists compte_dans_pas boolean not null default false;

-- Nouveau défaut de settings.sport (les lignes existantes sont complétées
-- côté client par mergeSportSettings, src/lib/sport.js — ce défaut ne concerne
-- que les comptes sans bloc `sport` enregistré).
alter table settings
  alter column sport
  set default '{
    "enabled": false,
    "objectif_hebdo_minutes": 150,
    "objectif_hebdo_seances": 0,
    "afficher_page_jour": true,
    "afficher_calendrier": true,
    "afficher_pas": false,
    "objectif_pas_jour": 8000,
    "pas_seuil_baseline": 4000,
    "mode_energie": "aucun",
    "depense_max_creditee_kcal": 400,
    "rappels": { "enabled": false, "jours": [], "heure": 18 },
    "strava": { "connected": false, "athlete_nom": null, "derniere_synchro": null, "auto": true }
  }'::jsonb;
