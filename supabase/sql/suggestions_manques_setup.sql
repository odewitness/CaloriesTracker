-- =============================================
-- SUGGESTIONS MANQUES — historique des aliments suggérés pour combler un
-- manque nutritionnel. Écrit le 2026-08-20. À exécuter une fois, à la main,
-- dans le SQL editor Supabase (pas de CLI connectée depuis Claude Code — voir
-- CLAUDE.md). Référence pour Claude Code par la suite, pas un script à
-- rejouer tel quel sur une base déjà migrée (mêmes conventions que
-- supabase_schema.sql).
--
-- Sert à faire remonter, dans la liste de courses, les aliments qui
-- reviennent le plus souvent dans les suggestions "À combler aujourd'hui" de
-- la page du jour (voir logSuggestions dans src/lib/suggestionsLog.js, appelé
-- depuis TodayGapsSection.jsx à chaque fois qu'une suggestion est affichée) —
-- voir useGroceriesSuggestions.js côté lecture/agrégation.
-- =============================================

create table if not exists suggestions_manques (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id),
  food_source text not null default 'ciqual', -- 'ciqual' | 'custom' | 'off' (rare — aliment Open Food Facts déjà mangé, retrouvé via useRecentFoods)
  food_ref_id text,
  food_name text not null,
  nutrient_key text not null, -- clé du champ manquant visé, ex. 'vit_d', 'fer' — voir VITAMIN_FIELDS/MINERAL_FIELDS/MACRO_FIELDS dans src/lib/nutrients.js, résolu à l'affichage via findField() dans ciqualExplorer.js
  created_at timestamptz not null default now()
);

create index if not exists idx_suggestions_manques_user_date
  on suggestions_manques (user_id, created_at desc);

alter table suggestions_manques enable row level security;

create policy "suggestions_manques_select_own" on suggestions_manques
  for select using (auth.uid() = user_id);
create policy "suggestions_manques_insert_own" on suggestions_manques
  for insert with check (auth.uid() = user_id);
-- Pas de policy update/delete : c'est un historique en écriture seule côté
-- client, jamais modifié après coup.
