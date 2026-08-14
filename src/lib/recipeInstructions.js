// ─────────────────────────────────────────────────────────────────────────────
// parseInstructionSteps — transforme le texte brut saisi/collé dans le champ
// "Instructions" en une liste d'étapes numérotées.
// Convention : une ligne = une étape. Les lignes vides sont ignorées, et une
// numérotation déjà présente dans le texte collé ("1.", "2)", "- ", "• ")
// est retirée pour éviter un double numérotage à l'affichage.
// ─────────────────────────────────────────────────────────────────────────────
export function parseInstructionSteps(text) {
  if (!text) return []
  return text
    .split(/\r?\n/)
    .map(line => line.trim().replace(/^(\d+[.)]|[-•*])\s*/, ''))
    .filter(Boolean)
}
