-- =============================================
-- CIQUAL.PORTIONS — écriture des "portions courantes" d'un aliment de la base
-- ANSES depuis l'app (fiche Explorer + étape "configurer" de l'ajout au
-- journal). La base ANSES ne renseigne une portion usuelle que pour une
-- minorité d'aliments, d'où la possibilité de la compléter à la main.
--
-- Écrit le 2026-08-30. À exécuter une fois, à la main, dans le SQL editor
-- Supabase. Référence pour Claude Code ensuite (mêmes conventions que
-- supabase_schema.sql).
--
-- Contexte : `ciqual` a RLS ACTIVÉ avec pour seule policy "Anyone can read
-- ciqual" (SELECT, using true). Pas de policy UPDATE → les écritures faites
-- en direct via `supabase.from('ciqual').update(...)` touchaient 0 ligne sans
-- lever d'erreur (bug : les portions perso ne se sauvegardaient jamais).
--
-- On ne rajoute PAS de policy `UPDATE using(true)` : ça laisserait n'importe
-- quel compte (voire anon) réécrire la base de référence partagée via la Data
-- API. On passe par une fonction `security definer` réservée aux comptes
-- connectés, qui ne touche que la colonne `portions`.
-- =============================================

create or replace function set_ciqual_portions(p_alim_code text, p_portions jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  update ciqual
     set portions = coalesce(p_portions, '[]'::jsonb)
   where alim_code = p_alim_code;
  get diagnostics affected = row_count;
  return affected; -- 0 = alim_code inconnu → le client affiche une vraie erreur
end;
$$;

revoke all on function set_ciqual_portions(text, jsonb) from public, anon;
grant execute on function set_ciqual_portions(text, jsonb) to authenticated;
