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

// Pas plus une colonne `ciqual` que NAME_FIELD : la popularité vit dans
// `favoris` (use_count/last_used_at), pas dans la base Ciqual. sortFoods()
// a besoin d'un accesseur externe pour ce champ (voir son 3ᵉ paramètre) —
// impossible à dériver de l'aliment seul comme les autres champs.
export const POPULARITY_FIELD = { key: 'popularite', label: 'Les plus utilisés', unit: null, virtual: true }

export const SORT_GROUPS = [
  { label: 'Général',   fields: [NAME_FIELD, POPULARITY_FIELD] },
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
  // La popularité s'intéresse d'abord aux aliments les PLUS utilisés — même
  // logique que les nutriments, à l'inverse du nom qui se lit de A à Z.
  if (fieldKey === POPULARITY_FIELD.key) return 'desc'
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
// `getUsage(food)` : accesseur optionnel vers `{ count, lastUsed }` (voir
// ExplorerPage, construit depuis `favoris.use_count`/`last_used_at`) — la
// seule donnée que sortFoods() ne peut pas dériver de l'aliment lui-même,
// puisqu'elle vit dans une autre table.
export function sortFoods(foods, { field, dir, base, kcalRef = DEFAULT_KCAL_REF }, getUsage) {
  const f = findField(field)
  const mult = dir === 'asc' ? 1 : -1

  if (field === POPULARITY_FIELD.key) {
    return [...foods].sort((a, b) => {
      const ua = getUsage?.(a), ub = getUsage?.(b)
      const ca = ua?.count || 0, cb = ub?.count || 0
      if (ca !== cb) return mult * (ca - cb)
      const la = ua?.lastUsed || '', lb = ub?.lastUsed || ''
      if (la !== lb) return mult * (la < lb ? -1 : 1)
      return a.alim_nom.localeCompare(b.alim_nom, 'fr')
    })
  }

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
// Cible journalière d'un nutriment : la VNR/RNP fixe (field.ref) pour les
// vitamines et minéraux, l'objectif personnel réglé dans Paramètres pour les
// deux macros suivies (protéines, fibres — les seules à avoir un objectif
// chiffré). Null si aucune cible n'existe encore pour ce champ.
function dailyTarget(field, settings) {
  if (field.key === 'proteines') return settings?.goal_proteines > 0 ? settings.goal_proteines : null
  if (field.key === 'fibres')    return settings?.goal_fibres > 0 ? settings.goal_fibres : null
  return field.ref || null
}

// Valeur déjà consommée aujourd'hui pour ce nutriment, dans les mêmes unités
// que dailyTarget() — `totals` utilise les clés courtes prot/fib pour les
// macros, la clé du nutriment lui-même pour les micros.
function consumedToday(totals, field) {
  if (field.key === 'proteines') return totals.prot || 0
  if (field.key === 'fibres')    return totals.fib || 0
  return (field.sumKeys || [field.key]).reduce((s, k) => s + (totals[k] || 0), 0)
}

// Classe les nutriments par écart à l'objectif, du plus déficitaire au moins.
// `totals` = sortie de computeTotals() (clés prot/fib pour les macros, clé
// nutriment pour les micros). Les nutriments `limite` (sel, sodium) sont
// exclus : en manquer n'est pas un problème.
export function getNutrientGaps(totals, settings, limit = 3) {
  if (!totals) return []
  const items = [PROT_FIELD, FIBRES_FIELD, ...CLAIM_MICRO_FIELDS]
    .map(field => {
      const target = dailyTarget(field, settings)
      return target != null ? { field, pct: consumedToday(totals, field) / target } : null
    })
    .filter(Boolean)

  return items
    .filter(i => i.pct < 1)
    .sort((a, b) => a.pct - b.pct)
    .slice(0, limit)
    .map(i => ({ field: i.field, pct: Math.round(i.pct * 100) }))
}

// Manque du jour en valeur absolue (pas en %) pour UN nutriment donné — sert
// au calcul du grammage nécessaire (voir gapCoverage). Null si ce nutriment
// n'a pas de cible journalière (macro sans objectif réglé, ou champ sans VNR
// comme glucides/lipides).
export function getGapAmount(totals, settings, field) {
  if (!totals) return null
  const target = dailyTarget(field, settings)
  if (target == null) return null
  return Math.max(0, target - consumedToday(totals, field))
}

// Grammage nécessaire pour combler le(s) manque(s) du jour sur `gaps`, sous
// la contrainte des calories restantes — le calcul derrière une (ou
// plusieurs) pastille(s) de manque combinée(s) à « tient dans mes calories
// restantes » (voir NutrientGapsBanner / ExplorerPage).
// `gaps` : [{ field, missing }], missing > 0 déjà filtré par l'appelant.
//
// Avec plusieurs manques sélectionnés, on prend le grammage le PLUS exigeant
// des deux : comme chaque nutriment est proportionnel au poids, ce grammage
// couvre forcément aussi les autres manques (au pire en les dépassant), donc
// une seule quantité d'un seul aliment répond à la fois à tous les manques
// cochés — c'est le geste attendu (« qu'est-ce qui comble les DEUX à la
// fois »), pas une quantité par nutriment.
//
// Trois contraintes peuvent limiter le grammage réellement proposé : le
// besoin lui-même (gramsForFullGap), les calories restantes, et un plafond de
// portion réaliste (MAX_REALISTIC_COVERAGE_G — personne ne mange 350 g de
// persil pour son fer). On prend la PLUS PETITE des trois plutôt que de
// masquer l'aliment dès qu'une seule est dépassée : combler une partie du
// manque avec une portion raisonnable reste un progrès utile à montrer, et
// c'est justement le rôle de `pct` (100 seulement si rien ne limite en deçà
// du besoin réel) de dire jusqu'où on va.
export const MAX_REALISTIC_COVERAGE_G = 200

// Retourne null si l'aliment n'apporte pas au moins un des nutriments visés,
// ou s'il n'y a plus aucun manque à combler.
export function gapCoverage(food, gaps, remainingKcal) {
  if (!gaps?.length) return null
  const per100 = gaps.map(g => rawValue(food, g.field))
  if (per100.some(v => v == null || v <= 0)) return null

  const gramsForFullGap = Math.max(...gaps.map((g, i) => (g.missing / per100[i]) * 100))
  const kcalPer100 = food.energie_kcal || 0

  let grams = Math.min(gramsForFullGap, MAX_REALISTIC_COVERAGE_G)
  if (remainingKcal != null && kcalPer100 > 0) {
    grams = Math.min(grams, (remainingKcal / kcalPer100) * 100)
  }
  if (grams <= 0) return null

  const kcal = (grams * kcalPer100) / 100
  if (grams >= gramsForFullGap) return { grams, kcal, pct: 100 }
  const pctPerGap = gaps.map((g, i) => ((grams * per100[i]) / 100 / g.missing) * 100)
  return { grams, kcal, pct: Math.round(Math.min(...pctPerGap)) }
}

// ── Suggestions ──────────────────────────────────────────────────────────────

// Combien du manque `gap` une PORTION RÉALISTE de cet aliment (déclarée en
// base, ou 100 g par défaut — voir getPortion) couvre-t-elle ? Contraire de
// gapCoverage, qui résout "combien de grammes pour combler X %", quitte à
// buter sur MAX_REALISTIC_COVERAGE_G — et donc à afficher ce même plafond
// pour tout aliment qui en a besoin de plus, ce qui rend toutes les
// suggestions identiques (« 200 g ») dès qu'aucun aliment du lot n'est très
// dense sur ces nutriments. Ici on part de ce qu'on mange VRAIMENT (sa
// portion habituelle) et on regarde jusqu'où ça mène : le grammage affiché
// varie donc d'un aliment à l'autre (30 g de noix, 125 g de yaourt...) au
// lieu de converger vers un chiffre inventé.
//
// Retourne null si l'aliment n'apporte pas ce nutriment, ou s'il n'y a plus
// de manque à combler.
export function portionGapCoverage(food, gap) {
  if (!gap?.missing) return null
  const per100 = rawValue(food, gap.field)
  if (per100 == null || per100 <= 0) return null
  const portion = getPortion(food)
  const amount = (per100 * portion.g) / 100
  return { grams: portion.g, pct: Math.round(Math.min(100, (amount / gap.missing) * 100)) }
}

// Meilleure alternative dans la MÊME CATÉGORIE pour un nutriment en manque
// aujourd'hui — sert à la fiche d'un aliment (ExplorerFoodModal) : « un
// aliment similaire est nettement plus riche en fer ». Cherche dans l'ordre
// des manques les plus urgents (`gaps`, sortie de getNutrientGaps) et
// s'arrête au premier qui a une alternative valable, plutôt que d'en
// proposer une par manque — une seule suggestion à la fois se lit, trois se
// noient.
//
// Seuil de significativité : au moins 50 % de plus /100 g que l'aliment
// courant (ou n'importe quelle valeur positive si l'aliment courant n'en
// apporte pas du tout). En dessous, la différence est dans le bruit de
// mesure Ciqual et la suggestion n'apprendrait rien.
export function findBetterAlternative(food, foods, gaps) {
  if (!food || !foods?.length || !gaps?.length) return null
  const category = getCategoryLabel(food.categorie)

  for (const { field } of gaps) {
    const currentVal = rawValue(food, field) || 0
    let best = null
    let bestVal = 0
    for (const candidate of foods) {
      if (candidate.alim_code === food.alim_code) continue
      if (getCategoryLabel(candidate.categorie) !== category) continue
      const v = rawValue(candidate, field)
      if (v == null || v <= bestVal) continue
      best = candidate
      bestVal = v
    }
    if (best && (currentVal === 0 ? bestVal > 0 : bestVal >= currentVal * 1.5)) {
      return { field, food: best, currentVal, betterVal: bestVal }
    }
  }
  return null
}

// Point de coût calorique MINIMAL, pour un couple d'aliments (A, B) donné,
// qui comble à la fois toutes les contraintes `missing` (une par manque,
// même ordre que `aVals`/`bVals`) — x = grammes de A, y = grammes de B.
//
// Géométrie : chaque contrainte k s'écrit x·aVals[k] + y·bVals[k] ≥
// missing[k] (une demi-droite), x,y ≥ 0. La région faisable est un polygone
// convexe, et minimiser une fonction linéaire (le kcal) dessus atteint
// toujours son minimum en un SOMMET de ce polygone — jamais à l'intérieur.
// Les sommets possibles sont : chaque aliment seul (l'autre à 0), et
// l'intersection de chaque paire de contraintes prises à l'égalité. Avec au
// plus une poignée de manques cochés à la fois dans l'app, il y a au plus
// quelques sommets à tester — pas besoin d'un vrai solveur de programme
// linéaire pour un polygone aussi simple.
function minimalKcalVertex(aVals, kcalA, bVals, kcalB, missing) {
  const K = missing.length
  const candidates = []

  let xOnly = 0
  for (let k = 0; k < K; k++) {
    if (aVals[k] <= 0) { xOnly = Infinity; break }
    xOnly = Math.max(xOnly, (missing[k] * 100) / aVals[k])
  }
  if (isFinite(xOnly)) candidates.push([xOnly, 0])

  let yOnly = 0
  for (let k = 0; k < K; k++) {
    if (bVals[k] <= 0) { yOnly = Infinity; break }
    yOnly = Math.max(yOnly, (missing[k] * 100) / bVals[k])
  }
  if (isFinite(yOnly)) candidates.push([0, yOnly])

  for (let i = 0; i < K; i++) {
    for (let j = i + 1; j < K; j++) {
      // Système 2×2 : x·aVals[i] + y·bVals[i] = missing[i]·100 (idem pour j).
      const det = aVals[i] * bVals[j] - aVals[j] * bVals[i]
      if (Math.abs(det) < 1e-9) continue // contraintes parallèles, pas de sommet
      const mi = missing[i] * 100, mj = missing[j] * 100
      const x = (mi * bVals[j] - mj * bVals[i]) / det
      const y = (aVals[i] * mj - aVals[j] * mi) / det
      if (x < -1e-6 || y < -1e-6) continue
      candidates.push([Math.max(0, x), Math.max(0, y)])
    }
  }

  let best = null
  for (const [x, y] of candidates) {
    let feasible = true
    for (let k = 0; k < K; k++) {
      if (x * aVals[k] + y * bVals[k] < missing[k] * 100 - 1e-6) { feasible = false; break }
    }
    if (!feasible) continue
    const kcal = (x * kcalA + y * kcalB) / 100
    if (!best || kcal < best.kcal) best = { gramsA: x, gramsB: y, kcal }
  }
  return best
}

function isBetterCombo(candidate, current) {
  if (!current) return true
  if (candidate.pct !== current.pct) return candidate.pct > current.pct
  // À couverture égale (typiquement deux solutions à 100 %), la moins
  // calorique gagne : inutile de suggérer d'en manger plus que nécessaire.
  return candidate.kcal < current.kcal
}

// Suggestion à DEUX aliments quand aucun aliment seul ne comble bien les
// manques `gaps` sous la contrainte `remainingKcal` (voir gapCoverage — même
// idée, mais répartie sur deux aliments). Résultat :
// { foods: [{ food, grams }, { food, grams }], kcal, pct }.
//
// Deux régimes selon le couple testé :
//  - Si une combinaison à coût calorique minimal (minimalKcalVertex) comble
//    tout DANS le budget, c'est elle qui est retenue — jamais plus que la
//    quantité strictement nécessaire.
//  - Sinon (le budget ne suffit pas à tout combler avec ce couple), on
//    cherche le meilleur partage du budget ENTIER : la seule variable libre
//    devient alors la part donnée à chaque aliment, balayée de 0 à 1 par pas
//    de 5 % (21 points), en gardant le partage qui maximise la couverture la
//    MOINS bonne des manques visés (le nutriment le plus juste). Dépenser
//    tout le budget est alors correct : le budget est la contrainte qui
//    limite la couverture, donc en dépenser moins ne peut que faire pire.
//
// `candidates` : sous-ensemble déjà restreint (les résultats affichés,
// donc déjà cohérents avec les filtres actifs) — tester toutes les paires
// parmi 3000+ aliments Ciqual n'aurait ni sens ni budget de calcul justifié
// ici ; on se limite aux 40 premiers.
export function suggestCombo(candidates, gaps, remainingKcal) {
  if (!gaps?.length || !remainingKcal || remainingKcal <= 0) return null
  const pool = candidates.filter(f => (f.energie_kcal || 0) > 0).slice(0, 40)
  if (pool.length < 2) return null

  const missing = gaps.map(g => g.missing)
  let best = null

  for (let i = 0; i < pool.length; i++) {
    const a = pool[i]
    const aVals = gaps.map(g => rawValue(a, g.field))
    if (aVals.some(v => v == null)) continue
    const kcalA = a.energie_kcal

    for (let j = i + 1; j < pool.length; j++) {
      const b = pool[j]
      const bVals = gaps.map(g => rawValue(b, g.field))
      if (bVals.some(v => v == null)) continue
      const kcalB = b.energie_kcal

      const minimal = minimalKcalVertex(aVals, kcalA, bVals, kcalB, missing)
      if (minimal && minimal.kcal <= remainingKcal) {
        const cand = { foods: [{ food: a, grams: minimal.gramsA }, { food: b, grams: minimal.gramsB }], kcal: minimal.kcal, pct: 100 }
        if (isBetterCombo(cand, best)) best = cand
        continue // ce couple comble déjà tout, pas besoin du repli budget
      }

      let pairBest = null
      for (let step = 0; step <= 20; step++) {
        const r = step / 20 // part du budget calorique donnée à `a`
        const gramsA = (r * remainingKcal / kcalA) * 100
        const gramsB = ((1 - r) * remainingKcal / kcalB) * 100

        let minPct = Infinity
        for (let k = 0; k < gaps.length; k++) {
          const covered = (gramsA * aVals[k] + gramsB * bVals[k]) / 100
          minPct = Math.min(minPct, (covered / missing[k]) * 100)
        }
        const cand = { foods: [{ food: a, grams: gramsA }, { food: b, grams: gramsB }], kcal: remainingKcal, pct: minPct }
        if (isBetterCombo(cand, pairBest)) pairBest = cand
      }
      if (pairBest && isBetterCombo(pairBest, best)) best = pairBest
    }
  }
  return best ? { ...best, pct: Math.round(best.pct) } : null
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
