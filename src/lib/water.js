// ─────────────────────────────────────────────────────────────────────────────
// Suivi d'hydratation ("tracker d'eau").
//
// Idée directrice : une portion de boisson loggée est une ENTRÉE `journal`
// normale, avec meal = WATER_MEAL, construite via scaleFood() (src/lib/
// nutrients.js). Les boissons Ciqual portant leurs minéraux/vitamines,
// computeTotals() les fait remonter automatiquement dans le détail
// nutritionnel, l'historique, les moyennes et le calendrier — aucune
// agrégation dédiée à écrire.
//
// Même mécanique que la section Compléments (SUPPLEMENT_MEAL) : un meal dédié
// filtré hors de MEALS_ORDER, affiché dans sa propre section.
// ─────────────────────────────────────────────────────────────────────────────
import { scaleFood } from './nutrients'
import { getCategoryLabel } from './ciqualExplorer'

export const WATER_MEAL = 'Hydratation'

// Catégorie Ciqual dans laquelle piocher les boissons (voir foodCategories.js).
export const WATER_CATEGORY = 'Eaux et autres boissons'

// Repère usuel : ~33 ml d'eau par kg de poids et par jour.
export const ML_PER_KG = 33

export const WATER_DEFAULTS = {
  goal_ml: 2000,
  default_food_ref_id: null, // alim_code de la boisson par défaut (Ciqual)
  portions: [
    { id: 'verre', label: 'Verre', ml: 250 },
    { id: 'bouteille', label: 'Bouteille', ml: 500 },
    { id: 'gourde', label: 'Gourde', ml: 750 },
  ],
  card_visible: true,
  notif: {
    enabled: false,
    mode: 'interval', // 'interval' | 'once' | 'smart'
    every_h: 2,
    start_h: 8,
    end_h: 21,
    once_h: 13,
    smart_h: 17,
    smart_threshold: 60, // % de l'objectif en dessous duquel le mode "smart" rappelle
    stop_when_done: true,
  },
}

// Fusionne le bloc `settings.water` brut avec les valeurs par défaut (même
// principe que meal_enabled dans useSettings) — tolère un bloc partiel ou
// absent, une liste de portions vide, un sous-objet notif incomplet.
export function mergeWaterSettings(raw) {
  const w = raw && typeof raw === 'object' ? raw : {}
  return {
    ...WATER_DEFAULTS,
    ...w,
    portions: Array.isArray(w.portions) && w.portions.length > 0 ? w.portions : WATER_DEFAULTS.portions,
    notif: { ...WATER_DEFAULTS.notif, ...(w.notif && typeof w.notif === 'object' ? w.notif : {}) },
  }
}

export function isWaterEntry(entry) {
  return !!entry && entry.meal === WATER_MEAL
}

// Total bu (ml) sur un tableau d'entrées journal — filtre lui-même les
// entrées d'hydratation, donc appelable avec toutes les entrées du jour.
export function waterTotalMl(entries) {
  return (entries || []).reduce((s, e) => s + (isWaterEntry(e) ? (Number(e.qty_g) || 0) : 0), 0)
}

// Construit une entrée journal prête à insérer (addEntry ajoute date/user_id)
// à partir d'une boisson du catalogue Ciqual et d'un volume en ml (≈ g pour
// une boisson, densité ≈ 1).
export function buildWaterEntry(food, ml) {
  return { ...scaleFood(food, ml), meal: WATER_MEAL }
}

const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')

// Boissons du catalogue Ciqual rangées dans la catégorie "Eaux et autres
// boissons", triées par nom.
export function getWaterBeverages(foods) {
  return (foods || [])
    .filter((f) => getCategoryLabel(f.categorie) === WATER_CATEGORY)
    .sort((a, b) => (a.alim_nom || '').localeCompare(b.alim_nom || '', 'fr'))
}

// Boisson par défaut : celle dont l'alim_code est mémorisé dans les réglages,
// sinon, à défaut, l'eau du robinet / de source / la première eau de la liste.
export function pickDefaultBeverage(foods, refId) {
  const bevs = getWaterBeverages(foods)
  if (bevs.length === 0) return null
  if (refId != null && refId !== '') {
    const found = bevs.find((f) => String(f.alim_code) === String(refId))
    if (found) return found
  }
  const byName = (kw) => bevs.find((f) => norm(f.alim_nom).includes(kw))
  return (
    byName('eau du robinet') ||
    byName('eau de source') ||
    byName('eau minerale') ||
    bevs.find((f) => norm(f.alim_nom).startsWith('eau')) ||
    bevs[0]
  )
}

// Objectif suggéré (ml) à partir du poids, arrondi au quart de litre,
// borné à [1 L, 4 L].
export function suggestGoalMl(weightKg) {
  if (!weightKg || weightKg <= 0) return null
  const raw = weightKg * ML_PER_KG
  const rounded = Math.round(raw / 250) * 250
  return Math.min(4000, Math.max(1000, rounded))
}

// "1,5" pour 1500 — affichage en litres, une décimale, virgule française.
export function litres(ml) {
  return (Math.max(0, ml) / 1000).toFixed(1).replace('.', ',')
}

export function newPortionId() {
  return 'p' + Date.now().toString(36)
}
