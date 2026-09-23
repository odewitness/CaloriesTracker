-- =============================================
-- LIEUX_SELLES — lieux déjà saisis sur le tracker de transit, réutilisables
-- via menu déroulant (même principe que `marques` pour aliments_custom.marque
-- — voir supabase/sql/README ou supabase_schema.sql table 13). Le champ
-- `selles.lieu` reste du texte libre (pas de FK) : cette table sert
-- uniquement à peupler le menu déroulant (BrandCombobox réutilisé côté
-- client, voir src/components/StoolEntrySheet.jsx) et à éviter de retaper un
-- lieu déjà utilisé.
--
-- Écrit le 2026-09-23. À exécuter une fois, à la main, dans le SQL editor
-- Supabase (pas de CLI connectée depuis Claude Code — voir CLAUDE.md).
-- =============================================

create table if not exists lieux_selles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id),
  nom text not null,
  created_at timestamptz not null default now(),
  unique (user_id, nom)
);

alter table lieux_selles enable row level security;

create policy "lieux_selles_own" on lieux_selles for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
