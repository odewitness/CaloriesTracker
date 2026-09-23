// ─────────────────────────────────────────────────────────────────────────────
// featureFlags.js — fonctionnalités visibles pour un seul compte de l'app (app
// à deux comptes, voir CLAUDE.md). La protection côté client (masquer l'UI)
// n'est qu'un confort d'affichage : la vraie barrière est toujours la policy
// RLS "own" côté Supabase (auth.uid() = user_id).
// ─────────────────────────────────────────────────────────────────────────────

// Tracker de transit (Bristol/couleur/remarques) — visible uniquement pour ce
// compte, voir StoolSection / StoolEntrySheet.
export const STOOL_TRACKER_USER_ID = '0acfe134-159c-4827-bdf7-cc072c86ef2a'
