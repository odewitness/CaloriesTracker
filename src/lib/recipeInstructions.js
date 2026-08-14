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

// ─────────────────────────────────────────────────────────────────────────────
// annotateInstructionSteps — repère, dans chaque étape, la première mention
// d'un ingrédient de LA recette (jamais une recherche dans tout Ciqual) et
// insère son grammage entre parenthèses juste après.
//
// Heuristique volontairement simple (pas de NLP) : on cherche le nom complet
// de l'ingrédient normalisé (minuscules, sans accents) dans le texte, et à
// défaut ses "mots significatifs" (hors mots grammaticaux courts). Chaque
// ingrédient n'est annoté qu'une seule fois sur l'ensemble de la recette (la
// 1ʳᵉ étape où il apparaît), et on n'annote pas si un grammage est déjà écrit
// juste après dans le texte (l'utilisateur l'a précisé lui-même).
//
// Retourne, pour chaque étape, un tableau de segments { text, highlight? } —
// à rendre tel quel (le segment avec highlight=true est le grammage inséré).
// ─────────────────────────────────────────────────────────────────────────────
const STOPWORDS = new Set([
  'de', 'du', 'des', 'la', 'le', 'les', 'un', 'une', 'et', 'à', 'au', 'aux',
  'en', 'avec', 'sans', 'pour', 'sur', 'dans', 'ce', 'ces', 'cet', 'cette',
  'par', 'ou', 'se', 'sa', 'son', 'ses', 'leur', 'leurs', 'qui', 'que',
])
const MIN_WORD_LEN = 3

function normalize(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Candidats de recherche pour un ingrédient, du plus spécifique au moins
// spécifique : nom complet normalisé, puis ses mots significatifs (triés du
// plus long au plus court pour privilégier le match le plus précis).
function buildCandidates(foodName) {
  const full = normalize(foodName).trim()
  const words = full
    .split(/[^a-z0-9]+/)
    .filter(w => w.length >= MIN_WORD_LEN && !STOPWORDS.has(w))
    .sort((a, b) => b.length - a.length)
  return [full, ...words].filter((c, i, arr) => c && arr.indexOf(c) === i)
}

function formatQty(g) {
  return `${Math.round(g)} g`
}

export function annotateInstructionSteps(steps, ingredients) {
  const usedIds = new Set()
  const items = (ingredients || [])
    .filter(ing => ing.qty_g > 0 && ing.food_name)
    .map(ing => ({ ing, key: ing.id || ing.food_name, candidates: buildCandidates(ing.food_name) }))

  return steps.map(step => {
    const normStep = normalize(step)
    const matches = []

    for (const { ing, key, candidates } of items) {
      if (usedIds.has(key)) continue
      for (const cand of candidates) {
        const re = new RegExp(`\\b${escapeRegExp(cand)}s?\\b`, 'i')
        const m = re.exec(normStep)
        if (m) {
          matches.push({ start: m.index, end: m.index + m[0].length, ing, key })
          break
        }
      }
    }

    // Résout les chevauchements en gardant le match qui commence le plus tôt
    matches.sort((a, b) => a.start - b.start)
    const resolved = []
    let lastEnd = -1
    for (const m of matches) {
      if (m.start >= lastEnd) { resolved.push(m); lastEnd = m.end }
    }

    if (resolved.length === 0) return [{ text: step }]

    const segments = []
    let cursor = 0
    for (const m of resolved) {
      usedIds.add(m.key)
      const after = normStep.slice(m.end, m.end + 15)
      const alreadyHasQty = /\d+\s*(g|gr|grammes|ml|cl|l)\b/.test(after)
      if (alreadyHasQty) continue
      segments.push({ text: step.slice(cursor, m.end) })
      segments.push({ text: ` (${formatQty(m.ing.qty_g)})`, highlight: true })
      cursor = m.end
    }
    segments.push({ text: step.slice(cursor) })
    return segments
  })
}
