// Formate une Date en 'YYYY-MM-DD' (fuseau local, pas UTC) — le format des
// colonnes `date` Supabase. Si `date` est déjà une chaîne, la renvoie telle
// quelle (permet d'appeler fmt() indifféremment sur une Date ou une string
// déjà au bon format).
export function fmt(date) {
  if (typeof date === 'string') return date
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Créneaux horaires approximatifs par repas (en minutes depuis 00:00),
// utilisés pour déduire le repas "du moment" — ex. suggestions d'ajout
// rapide sur la page Aujourd'hui. Le Dîner s'étend jusqu'au petit matin
// (repas de la veille au soir tant que le petit-déjeuner n'a pas commencé).
const MEAL_TIME_RANGES = [
  { meal: 'Petit-déjeuner', startMin: 4 * 60,        endMin: 10 * 60 + 30 },
  { meal: 'Déjeuner',       startMin: 10 * 60 + 30,   endMin: 14 * 60 + 30 },
  { meal: 'Collation',      startMin: 14 * 60 + 30,   endMin: 18 * 60 + 30 },
  { meal: 'Dîner',          startMin: 18 * 60 + 30,   endMin: 28 * 60 }, // "24h + 4h" = jusqu'au petit-déj
]

// Déduit le repas correspondant à l'heure actuelle (ou celle de `date`).
// `mealEnabled` (settings.meal_enabled) permet de replier sur le prochain
// repas activé si celui déduit de l'heure est désactivé.
export function getMealForTime(date = new Date(), mealEnabled = {}) {
  const minutes = date.getHours() * 60 + date.getMinutes()
  const adjusted = minutes < MEAL_TIME_RANGES[0].startMin ? minutes + 24 * 60 : minutes
  const order = MEAL_TIME_RANGES.map(r => r.meal)
  const base = MEAL_TIME_RANGES.find(r => adjusted >= r.startMin && adjusted < r.endMin)?.meal
    || order[order.length - 1]

  if (mealEnabled[base] !== false) return base
  const startIdx = order.indexOf(base)
  for (let i = 1; i <= order.length; i++) {
    const candidate = order[(startIdx + i) % order.length]
    if (mealEnabled[candidate] !== false) return candidate
  }
  return base
}
