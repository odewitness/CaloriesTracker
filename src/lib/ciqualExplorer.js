// ─────────────────────────────────────────────────────────────────────────────
// Logique pure de l'explorateur Ciqual (src/pages/ExplorerPage.jsx).
//
// Pourquoi tout se fait côté client : les tris utiles ici ne sont pas des tris
// de colonne mais des tris sur valeurs DÉRIVÉES (densité pour 100 kcal, valeur
// par portion réelle, % de la VNR). PostgREST ne sait pas trier sur une
// expression — il aurait fallu une vue avec une colonne générée par nutriment,
// et un aller-retour réseau à chaque changement de réglage. On charge donc une
// fois une projection allégée de `ciqual` (voir useCiqualCatalog) et tout le
// tri/filtre se fait en mémoire, instantanément.
//
// VITAMIN_FIELDS / MINERAL_FIELDS restent la source unique de vérité pour les
// libellés, unités et références (RNP/VNR) — rien n'est redéfini ici.
// ─────────────────────────────────────────────────────────────────────────────

import { VITAMIN_FIELDS, MINERAL_FIELDS, SATURATED_FAT_KEY } from './nutrients'

// ── Macros triables ─────────────────────────────────────────────────────────
// Pas de `ref` : les macros n'ont pas de VNR unique (l'objectif dépend de la
// personne), leurs seuils d'allégation se calculent autrement (voir getClaimLevel).
export const MACRO_FIELDS = [
  { key: 'energie_kcal',    label: 'Calories',   unit: 'kcal' },
  { key: 'proteines',       label: 'Protéines',  unit: 'g' },
  { key: 'glucides',        label: 'Glucides',   unit: 'g' },
  { key: 'lipides',         label: 'Lipides',    unit: 'g' },
  { key: 'fibres',          label: 'Fibres',     unit: 'g' },
  { key: 'sucres',          label: 'Sucres',     unit: 'g' },
  { key: SATURATED_FAT_KEY, label: 'AG saturés', unit: 'g' },
]

// Groupes proposés dans le sélecteur de tri (deux niveaux : groupe → nutriment,
// même principe que FoodSortModal — une liste à plat de 32 nutriments serait
// illisible sur mobile).
// Tri neutre, et état par défaut de la page : classer par nom n'applique
// AUCUN point de vue nutritionnel sur la liste. Sans cette option, tout tri
// est forcément « par un nutriment » et il devient impossible de revenir à une
// liste non orientée. `virtual` = ce n'est pas une colonne de `ciqual`, donc
// à exclure de la projection SQL.
export const NAME_FIELD = { key: 'nom', label: 'Nom', unit: null, virtual: true }

export const SORT_GROUPS = [
  { label: 'Général',   fields: [NAME_FIELD] },
  { label: 'Macros',    fields: MACRO_FIELDS },
  { label: 'Vitamines', fields: VITAMIN_FIELDS },
  { label: 'Minéraux',  fields: MINERAL_FIELDS },
]

export const ALL_SORT_FIELDS = SORT_GROUPS.flatMap(g => g.fields)

// Projection minimale envoyée à Supabase : uniquement ce dont l'explorateur a
// besoin pour trier, filtrer et afficher. Un `select('*')` tirerait les ~70
// colonnes de `ciqual` (acides gras détaillés, sucres détaillés, détails
// rétinol/D2/D3...) inutiles ici, pour plusieurs Mo transférés en plus.
// Dérivée des listes de champs, jamais recopiée à la main.
export const EXPLORER_SELECT = Array.from(new Set([
  'id', 'alim_code', 'alim_nom', 'categorie', 'portions',
  ...ALL_SORT_FIELDS.filter(f => !f.virtual).flatMap(f => f.sumKeys || [f.key]),
])).join(',')

export function findField(key) {
  return ALL_SORT_FIELDS.find(f => f.key === key) || NAME_FIELD
}

// Sens « naturel » d'un champ. Un nom se lit de A à Z ; une valeur
// nutritionnelle intéresse d'abord par le haut — on cherche les aliments les
// PLUS riches en fer, pas les moins. Changer de champ repart donc sur ce sens
// plutôt que de conserver celui du champ précédent (sinon, passer du tri par
// nom à un nutriment héritait du A → Z et sortait les aliments les plus
// pauvres). Même convention que le tri des favoris dans FoodPicker.
export function naturalDir(fieldKey) {
  return findField(fieldKey).virtual ? 'asc' : 'desc'
}

const VITAMIN_KEYS = new Set(VITAMIN_FIELDS.map(f => f.key))

// Libellé court pour les grilles de pastilles (choix du tri, choix des
// filtres). Les vitamines y sont réduites à leur lettre ou leur numéro
// (« C », « B12 ») : répéter « Vitamine » douze fois n'apprend rien, le groupe
// s'appelle déjà « Vitamines », et ça libère beaucoup de largeur.
//
// Les minéraux gardent leur nom complet : leurs abrégés existants (« Cal »,
// « Man », « Pho », « Sél ») servent aux pastilles de compléments alimentaires
// où la place manque vraiment, mais ne se lisent pas d'eux-mêmes ici.
//
// Partout ailleurs (bouton de tri, filtres actifs, manques du jour), c'est le
// libellé complet qui est affiché : hors de la grille, « C » seul serait
// ambigu.
export function chipLabel(field) {
  return VITAMIN_KEYS.has(field.key) && field.short ? field.short : field.label
}

// ── Bases de comparaison ────────────────────────────────────────────────────
// C'est le cœur de l'outil. Un classement brut /100 g sur Ciqual remonte des
// épices déshydratées et des ingrédients purs (100 g de thym, de sel, de
// levure) qu'on ne mange jamais tels quels. Deux autres bases rendent le
// classement exploitable :
//   kcal100 — densité nutritionnelle : « le plus de fer par calorie dépensée »
//   portion — valeur réellement apportée par une portion usuelle (colonne
//             `portions` de ciqual), qui remet les épices à leur vraie place.
export const SORT_BASES = [
  { key: 'g100',    label: 'Pour 100 g',        short: '/100 g' },
  { key: 'kcal100', label: 'À calories égales', short: '/100 kcal' },
  { key: 'portion', label: 'Par portion',       short: '/portion' },
]

// Budget calorique de reference du mode « A calories egales ».
//
// A savoir : changer cette valeur ne change PAS l'ordre du classement. Toutes
// les valeurs sont multipliees par le meme facteur, donc le rang de chaque
// aliment est identique a 50 comme a 500 kcal. Ce reglage sert a rendre les
// chiffres interpretables — « 87 g de thon pour 200 kcal » parle davantage que
// la meme information ramenee a 100 kcal.
export const KCAL_REF_OPTIONS = [50, 100, 200, 500]
export const DEFAULT_KCAL_REF = 100

// Énergie minimale pour qu'une comparaison « à calories égales » ait un sens.
//
// Le calcul divise par l'énergie de l'aliment : en dessous de quelques kcal,
// on divise par presque zéro et le classement se remplit d'artefacts. Un soda
// à 0,06 kcal/100 g « apporte » 172 g de protéines pour 100 kcal — vrai au
// sens strict, mais il faudrait en boire 172 kg. Ces aliments ne sont pas
// comparables à calories égales : leur valeur est nulle dans ce mode, donc ils
// partent en fin de liste (règle « valeurs manquantes en dernier »).
//
// 20 kcal/100 g = il faut déjà 500 g pour atteindre 100 kcal ; en dessous, le
// rapport ne décrit plus un aliment mais une division par presque rien.
export const MIN_KCAL_FOR_DENSITY = 20

// Portion usuelle déclarée sur l'aliment. Tous les aliments Ciqual n'en ont
// pas : on retombe alors sur 100 g, en le disant explicitement dans le libellé
// (mieux qu'exclure l'aliment du classement sans prévenir).
// Le libellé porte TOUJOURS le grammage : « 1 cuillère à soupe » ne dit pas
// sur quelle quantité la ligne est calculée, alors que c'est précisément ce
// que le mode « par portion » compare. Et quand l'aliment n'a pas de portion
// déclarée en base, le repli sur 100 g doit être annoncé — sinon le classement
// mélange sans prévenir des portions réelles et des 100 g par défaut.
export function getPortion(food) {
  const p = food.portions?.[0]
  if (p?.g > 0) {
    return { g: p.g, label: p.label ? `${p.label} (${p.g} g)` : `${p.g} g`, declared: true }
  }
  return { g: 100, label: '100 g par défaut', declared: false }
}

// Le repli sur 100 g reste utile là où il faut bien une quantité de référence
// (filtre « tient dans mes calories restantes »), mais il n'a pas sa place
// dans le classement par portion : comparer une portion réelle à un 100 g
// arbitraire fait gagner l'aliment qui n'a simplement pas de portion en base.
// Ces aliments sont donc écartés de ce mode.
export function hasDeclaredPortion(food) {
  return getPortion(food).declared
}

// Valeur brute /100 g, en préservant la distinction null / 0 : dans Ciqual,
// une case vide veut dire « non mesuré », pas « absent ». Les afficher comme
// des zéros ferait passer des aliments jamais analysés pour des aliments
// pauvres. On ne somme donc que les clés renseignées, et on rend null si
// aucune ne l'est.
export function rawValue(food, field) {
  const keys = field.sumKeys || [field.key]
  let sum = null
  for (const k of keys) {
    const v = food[k]
    if (v == null) continue
    sum = (sum ?? 0) + Number(v)
  }
  return sum
}

export function fieldValue(food, field, base, kcalRef = DEFAULT_KCAL_REF) {
  if (field.virtual) return null // le nom n'a pas de valeur chiffrée à comparer
  const raw = rawValue(food, field)
  if (raw == null) return null
  // « Calories pour 100 kcal » ne veut rien dire : on retombe sur la valeur
  // brute plutôt que d'afficher 100 partout.
  if (base === 'kcal100' && field.key !== 'energie_kcal') {
    const kcal = food.energie_kcal
    // Voir MIN_KCAL_FOR_DENSITY : en dessous, le rapport n'est plus qu'une
    // division par presque zéro (eaux, sodas light, bouillons, infusions).
    if (!kcal || kcal < MIN_KCAL_FOR_DENSITY) return null
    return (raw / kcal) * kcalRef
  }
  if (base === 'portion') return (raw * getPortion(food).g) / 100
  return raw
}

// Masse d'aliment nécessaire pour atteindre 100 kcal — le pendant concret du
// tri par densité : « 2,7 mg de fer pour 100 kcal » ne veut rien dire tant
// qu'on ne sait pas que ces 100 kcal représentent 435 g d'épinards. C'est ce
// qui permet de distinguer un aliment vraiment dense d'un aliment simplement
// pauvre en calories. Null si l'aliment n'apporte pas d'énergie (eau, thé) :
// aucune quantité n'atteint jamais 100 kcal.
export function gramsForKcal(food, kcalRef = DEFAULT_KCAL_REF) {
  const kcal = food.energie_kcal
  // Même seuil que le classement lui-même : afficher « 172 414 g pour
  // 100 kcal » ne renseigne sur rien, sinon que l'aliment n'a pas sa place
  // dans cette comparaison.
  if (!kcal || kcal < MIN_KCAL_FOR_DENSITY) return null
  return (kcalRef / kcal) * 100
}

// ── Allégations nutritionnelles (règlement UE n°1924/2006, annexe) ───────────
// Seuils officiels, pas des estimations maison :
//   vitamines & minéraux — « source de » ≥ 15 % de la VNR pour 100 g,
//                          « riche en » ≥ 30 %
//   protéines            — « source » ≥ 12 % de l'énergie, « riche » ≥ 20 %
//   fibres               — « source » ≥ 3 g/100 g, « riche » ≥ 6 g/100 g
// Les nutriments `limite` (sel, sodium) sont exclus : il n'existe évidemment
// pas d'allégation « riche en sel » à valoriser.
export const CLAIM_MICRO_FIELDS = [...VITAMIN_FIELDS, ...MINERAL_FIELDS].filter(f => !f.limite)

const macro = (key) => MACRO_FIELDS.find(f => f.key === key)
const PROT_FIELD   = macro('proteines')
const GLUC_FIELD   = macro('glucides')
const LIP_FIELD    = macro('lipides')
const FIBRES_FIELD = macro('fibres')

export const CLAIM_GROUPS = [
  { label: 'Macros',    fields: [PROT_FIELD, GLUC_FIELD, LIP_FIELD, FIBRES_FIELD] },
  { label: 'Vitamines', fields: VITAMIN_FIELDS },
  { label: 'Minéraux',  fields: MINERAL_FIELDS.filter(f => !f.limite) },
]

// Part de l'énergie totale apportée par un macro (4 kcal/g pour protéines et
// glucides, 9 pour les lipides).
function energyShare(food, key) {
  const kcal = food.energie_kcal
  if (!kcal || kcal <= 0) return null
  const perG = key === 'lipides' ? 9 : 4
  return ((food[key] || 0) * perG) / kcal
}

// 'riche' | 'source' | null — pour UN nutriment donné, sur les valeurs /100 g.
export function getClaimLevel(food, field) {
  // Protéines et fibres ont des seuils d'allégation officiels (UE 1924/2006).
  if (field.key === 'proteines') {
    const share = energyShare(food, 'proteines')
    if (share == null) return null
    return share >= 0.20 ? 'riche' : share >= 0.12 ? 'source' : null
  }
  if (field.key === 'fibres') {
    const v = food.fibres
    if (v == null) return null
    return v >= 6 ? 'riche' : v >= 3 ? 'source' : null
  }
  // Glucides et lipides n'ont AUCUNE allégation officielle « riche en » — le
  // règlement ne valorise pas ces deux macros. On retombe donc sur le critère
  // de dominance énergétique déjà utilisé par getNutriBadge() dans
  // nutriBadge.js, pour que « riche en lipides » veuille dire la même chose
  // ici et sur les cartes de recettes/aliments : le macro fournit à lui seul
  // plus de la moitié de l'énergie de l'aliment.
  if (field.key === 'glucides' || field.key === 'lipides') {
    const share = energyShare(food, field.key)
    if (share == null) return null
    return share > 0.50 ? 'riche' : share > 0.30 ? 'source' : null
  }
  if (!field.ref || field.limite) return null
  const v = rawValue(food, field)
  if (v == null) return null
  const pct = v / field.ref
  return pct >= 0.30 ? 'riche' : pct >= 0.15 ? 'source' : null
}

// Allégations « riche en » d'un aliment, dans l'ordre macros puis micros — sert
// aux pastilles de la liste. On ne remonte que les « riche en » : afficher
// aussi les « source de » noierait la carte sous huit pastilles.
export function getRichClaims(food, max = 3) {
  const out = []
  for (const field of [PROT_FIELD, FIBRES_FIELD, GLUC_FIELD, LIP_FIELD, ...CLAIM_MICRO_FIELDS]) {
    if (getClaimLevel(food, field) === 'riche') out.push(field)
    if (out.length >= max) break
  }
  return out
}

// Variante micro-nutriments seuls. Sur les cartes de résultat, les macros
// sont déjà résumées par le badge de getNutriBadge() : n'y répéter que les
// micros évite le doublon (« Riche en protéines » affiché deux fois sur la
// même carte) tout en gardant visible un « Riche en fer », qui n'apparaîtrait
// nulle part ailleurs tant qu'on ne trie pas sur ce nutriment.
export function getRichMicroClaims(food, max = 1) {
  const out = []
  for (const field of CLAIM_MICRO_FIELDS) {
    if (getClaimLevel(food, field) === 'riche') out.push(field)
    if (out.length >= max) break
  }
  return out
}

// ── Catégories ──────────────────────────────────────────────────────────────
const normalize = (s) => (s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

// Les épices, herbes séchées et aides culinaires faussent tous les classements
// (100 g de thym séché = plusieurs fois la VNR en fer). On les masque par
// défaut, avec un interrupteur pour les réafficher. Détection sur le libellé
// plutôt que sur une liste figée : le nommage exact des catégories dépend de
// l'import Ciqual en base, et une catégorie non reconnue ne masque rien.
// Radicaux volontairement courts : les libellés Ciqual sont au pluriel
// (« Aides culinaires et ingrédients divers »), un mot-clé au singulier ne
// matcherait rien.
const SEASONING_HINTS = ['culinaire', 'ingredient', 'epice', 'herbe', 'condiment']

export function isSeasoningCategory(categorie) {
  const c = normalize(categorie)
  return SEASONING_HINTS.some(h => c.includes(h))
}

// ── Regroupement d'affichage des catégories ─────────────────────────────────
// La table `ciqual` mélange deux imports : l'import ANSES complet (libellés
// tout en minuscules, ~3 500 lignes) et une petite liste d'aliments courants
// ajoutée par-dessus (libellés capitalisés, une cinquantaine de lignes), qui
// découpe les mêmes familles plus finement. D'où des doublons apparents dans
// le filtre : « produits laitiers » d'un côté, « Fromages » et « Lait et
// produits laitiers » de l'autre.
//
// On les ramène à un jeu unique de libellés. C'est PUREMENT une couche
// d'affichage : la colonne `categorie` n'est jamais modifiée en base, et le
// schéma reste inchangé.
//
// La clé est la catégorie brute normalisée (minuscules sans accents) — une
// simple différence de casse (« matières grasses » / « Matières grasses ») est
// donc déjà fusionnée sans avoir à la lister deux fois.
const VIANDES  = 'Viandes, œufs et poissons'
const VEGETAUX = 'Fruits, légumes, légumineuses et oléagineux'
const LAITIERS = 'Produits laitiers'
const CEREALES = 'Produits céréaliers'
const SUCRES   = 'Produits sucrés'
const DIVERS   = 'Divers'

const CATEGORY_ALIASES = {
  'viandes, oeufs, poissons':               VIANDES,
  'viandes et charcuteries':                VIANDES,
  'poissons et produits de la mer':         VIANDES,

  'fruits, legumes, legumineuses et oleagineux': VEGETAUX,
  'legumes et produits derives':            VEGETAUX,
  'fruits':                                 VEGETAUX,
  'fruits a coque':                         VEGETAUX,
  'legumineuses':                           VEGETAUX,

  'produits laitiers':                      LAITIERS,
  'fromages':                               LAITIERS,
  'lait et produits laitiers':              LAITIERS,

  'produits cerealiers':                    CEREALES,
  'cereales et derives':                    CEREALES,

  'produits sucres':                        SUCRES,
  'sucres et confiseries':                  SUCRES,

  'matieres grasses':                       'Matières grasses',
  'aides culinaires et ingredients divers': 'Aides culinaires et ingrédients divers',
  'entrees et plats composes':              'Entrées et plats composés',
  'eaux et autres boissons':                'Eaux et autres boissons',
  'aliments infantiles':                    'Aliments infantiles',
  'glaces et sorbets':                      'Glaces et sorbets',

  // Deux lignes isolées, sans famille évidente (« Dessert (aliment moyen) »,
  // « Crème de coco »). Les ranger ailleurs serait les faire passer pour ce
  // qu'elles ne sont pas.
  'divers':                                 DIVERS,
  'vegetalien':                             DIVERS,
}

export function getCategoryLabel(categorie) {
  if (!categorie) return DIVERS
  const known = CATEGORY_ALIASES[normalize(categorie)]
  if (known) return known
  // Catégorie non répertoriée (import futur) : au minimum une majuscule
  // initiale, plutôt que de la masquer ou de l'afficher telle quelle.
  return categorie.charAt(0).toUpperCase() + categorie.slice(1)
}

// Libellés regroupés réellement présents dans le catalogue chargé — jamais
// codés en dur, pour rester juste si la base évolue.
export function listCategories(foods) {
  return Array.from(new Set(foods.map(f => getCategoryLabel(f.categorie))))
    .sort((a, b) => a.localeCompare(b, 'fr'))
}

// ── État de cuisson ─────────────────────────────────────────────────────────
// Ciqual ne stocke pas la cuisson dans une colonne : elle n'existe que dans le
// libellé (« Carotte, crue », « Riz basmati, cuit », « Croquette, à cuire »).
// On la déduit donc du nom — environ un tiers des 3 552 aliments porte un
// marqueur, les autres restent « non précisé » et ne sont jamais exclus tant
// que le filtre n'est pas utilisé.
//
// Les modes de cuisson (rôti, grillé, poêlé, sauté…) sont inclus car ils
// rattrapent ~130 aliments qui ne portent pas le mot « cuit » (« Veau,
// escalope, poêlée »). Mais ces mots sont ambigus : ils désignent parfois une
// DÉCOUPE (« Veau, rôti cru ») ou un NOM DE PLAT (« Poêlée de légumes,
// surgelée, crue »). D'où l'ordre de priorité ci-dessous — « à cuire » puis
// « cru » l'emportent toujours, ce qui tranche correctement ces cas.
// Restent quelques produits type « Poêlée de légumes surgelée » sans mention
// « crue », classés à tort comme cuits : une poignée sur 3 552.
const COOKING_PATTERNS = [
  ['a_cuire', /(^|[^a-z])a cuire([^a-z]|$)/],
  ['cru',     /(^|[^a-z])(cru|crus|crue|crues)([^a-z]|$)/],
  ['cuit',    /(^|[^a-z])(cuit|cuits|cuite|cuites|precuit|precuits|precuite|precuites|bouilli|bouillis|bouillie|bouillies|roti|rotis|rotie|roties|grille|grilles|grillee|grillees|poele|poeles|poelee|poelees|frit|frits|frite|frites|braise|braises|braisee|braisees|saute|sautes|sautee|sautees|mijote|mijotee|vapeur|etouffee)([^a-z]|$)/],
]

export const COOKING_OPTIONS = [
  { key: 'cru',     label: 'Cru' },
  { key: 'cuit',    label: 'Cuit' },
  { key: 'a_cuire', label: 'À cuire' },
]

export function getCookingState(food) {
  const s = normalize(food.alim_nom)
  for (const [state, re] of COOKING_PATTERNS) if (re.test(s)) return state
  return null
}

// ── Filtre + tri ────────────────────────────────────────────────────────────
export const DEFAULT_FILTERS = {
  query: '',
  categories: [],
  claims: [],          // clés de nutriments dont on veut « riche en »
  cooking: [],         // états de cuisson retenus (OU logique, cf. filterFoods)
  favoritesOnly: false,
  fitsRemainingKcal: false,
  showSeasonings: false,
}

// La page s'ouvre sur un tri par nom : aucun nutriment n'est privilégié tant
// que l'utilisatrice n'en a pas choisi un. Ni les filtres ni le tri ne sont
// mémorisés d'une ouverture à l'autre — un réglage pris pour un besoin ponctuel
// ne doit pas devenir l'état permanent de la page.
export const DEFAULT_SORT = { field: 'nom', dir: 'asc', base: 'g100', kcalRef: DEFAULT_KCAL_REF }

// Libelle du mode de comparaison courant, reference calorique incluse — une
// seule source pour le bouton « Trier » et le sous-titre des valeurs.
export function describeBase(sort) {
  if (sort.base === 'kcal100') return `Pour ${sort.kcalRef ?? DEFAULT_KCAL_REF} kcal`
  return SORT_BASES.find(b => b.key === sort.base)?.label ?? ''
}

export function baseShortLabel(sort) {
  if (sort.base === 'kcal100') return `/${sort.kcalRef ?? DEFAULT_KCAL_REF} kcal`
  return SORT_BASES.find(b => b.key === sort.base)?.short ?? ''
}

export function filterFoods(foods, filters, { isFavorite, remainingKcal } = {}) {
  const q = normalize(filters.query).trim()
  const claimFields = filters.claims.map(findField)

  return foods.filter(food => {
    // Le filtre porte sur le libellé REGROUPÉ, pas sur la catégorie brute :
    // sans ça, cocher « Produits laitiers » laisserait de côté les lignes
    // rangées sous « Fromages » par le second import.
    const categorie = getCategoryLabel(food.categorie)
    if (!filters.showSeasonings && isSeasoningCategory(categorie)) return false
    if (q && !normalize(food.alim_nom).includes(q)) return false
    if (filters.categories.length && !filters.categories.includes(categorie)) return false
    // Plusieurs pastilles « riche en » = ET logique : on cherche l'aliment qui
    // coche tous les besoins à la fois, pas l'union des trois listes.
    if (claimFields.length && !claimFields.every(f => getClaimLevel(food, f) === 'riche')) return false
    // Contrairement aux pastilles « riche en », la cuisson est un OU : un
    // aliment ne peut pas être cru ET cuit, cocher les deux veut dire « l'un
    // ou l'autre ». Calculé seulement si le filtre est utilisé — l'analyse du
    // libellé tournerait sinon sur 3 552 aliments à chaque frappe.
    if (filters.cooking?.length && !filters.cooking.includes(getCookingState(food))) return false
    if (filters.favoritesOnly && !isFavorite?.(food)) return false
    if (filters.fitsRemainingKcal && remainingKcal != null) {
      const kcalPortion = ((food.energie_kcal || 0) * getPortion(food).g) / 100
      if (kcalPortion > remainingKcal) return false
    }
    return true
  })
}

// ── Résumé des filtres actifs ───────────────────────────────────────────────
// Les filtres doivent rester VISIBLES sur la page, pas seulement dans la
// feuille de réglages : sans ça, une liste restreinte à « riche en vitamine D »
// donne l'impression que le tri ne répond plus, alors que c'est le filtre qui
// limite les résultats. Chaque entrée est retirable individuellement.
export function describeActiveFilters(filters, remainingKcal) {
  const out = []
  for (const k of filters.claims) {
    // Seule l'initiale passe en minuscule : un toLowerCase() complet donnait
    // « riche en vitamine c » ou « folates (b9) », où la lettre du nutriment
    // est justement ce qui l'identifie.
    const label = findField(k).label
    out.push({
      id: `claim:${k}`, kind: 'claim', value: k,
      label: `Riche en ${label.charAt(0).toLowerCase()}${label.slice(1)}`,
    })
  }
  for (const c of filters.categories) {
    out.push({ id: `cat:${c}`, kind: 'category', value: c, label: c })
  }
  for (const k of filters.cooking || []) {
    const opt = COOKING_OPTIONS.find(o => o.key === k)
    if (opt) out.push({ id: `cook:${k}`, kind: 'cooking', value: k, label: opt.label })
  }
  if (filters.favoritesOnly) out.push({ id: 'fav', kind: 'favoritesOnly', label: 'Mes favoris' })
  if (filters.fitsRemainingKcal) {
    out.push({
      id: 'kcal', kind: 'fitsRemainingKcal',
      label: remainingKcal != null ? `≤ ${Math.round(remainingKcal)} kcal` : 'Calories restantes',
    })
  }
  if (filters.showSeasonings) out.push({ id: 'seasoning', kind: 'showSeasonings', label: 'Épices affichées' })
  return out
}

export function removeFilter(filters, item) {
  if (item.kind === 'claim')    return { ...filters, claims: filters.claims.filter(k => k !== item.value) }
  if (item.kind === 'category') return { ...filters, categories: filters.categories.filter(c => c !== item.value) }
  if (item.kind === 'cooking')  return { ...filters, cooking: filters.cooking.filter(k => k !== item.value) }
  return { ...filters, [item.kind]: false }
}

// Les valeurs manquantes finissent TOUJOURS en fin de liste, quel que soit le
// sens du tri. (En SQL, `order by ... desc` remonte les NULL en premier : la
// première page serait pleine d'aliments sans donnée. Même piège en JS si on
// traite null comme 0.)
export function sortFoods(foods, { field, dir, base, kcalRef = DEFAULT_KCAL_REF }) {
  const f = findField(field)
  const mult = dir === 'asc' ? 1 : -1

  if (f.virtual) {
    return [...foods].sort((a, b) => mult * a.alim_nom.localeCompare(b.alim_nom, 'fr'))
  }

  return [...foods]
    .map(food => ({ food, val: fieldValue(food, f, base, kcalRef) }))
    .sort((a, b) => {
      if (a.val == null && b.val == null) return a.food.alim_nom.localeCompare(b.food.alim_nom, 'fr')
      if (a.val == null) return 1
      if (b.val == null) return -1
      if (a.val !== b.val) return mult * (a.val - b.val)
      return a.food.alim_nom.localeCompare(b.food.alim_nom, 'fr')
    })
    .map(x => x.food)
}

// ── Manques du jour ─────────────────────────────────────────────────────────
// Classe les nutriments par écart à l'objectif, du plus déficitaire au moins.
// `totals` = sortie de computeTotals() (clés prot/fib pour les macros, clé
// nutriment pour les micros). Les nutriments `limite` (sel, sodium) sont
// exclus : en manquer n'est pas un problème.
export function getNutrientGaps(totals, settings, limit = 3) {
  if (!totals) return []
  const items = []

  if (settings?.goal_proteines > 0) {
    items.push({ field: PROT_FIELD, pct: (totals.prot || 0) / settings.goal_proteines })
  }
  if (settings?.goal_fibres > 0) {
    items.push({ field: FIBRES_FIELD, pct: (totals.fib || 0) / settings.goal_fibres })
  }
  for (const field of CLAIM_MICRO_FIELDS) {
    const val = (field.sumKeys || [field.key]).reduce((s, k) => s + (totals[k] || 0), 0)
    items.push({ field, pct: val / field.ref })
  }

  return items
    .filter(i => i.pct < 1)
    .sort((a, b) => a.pct - b.pct)
    .slice(0, limit)
    .map(i => ({ field: i.field, pct: Math.round(i.pct * 100) }))
}

// ── Formatage ───────────────────────────────────────────────────────────────
export function formatValue(val, unit) {
  if (val == null) return '—'
  if (val === 0) return `0 ${unit}`
  const abs = Math.abs(val)
  const rounded = abs >= 100 ? Math.round(val)
    : abs >= 10 ? Math.round(val * 10) / 10
    : abs >= 1  ? Math.round(val * 100) / 100
    : Math.round(val * 1000) / 1000
  return `${rounded} ${unit}`
}
