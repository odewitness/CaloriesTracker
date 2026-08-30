// Source unique de vérité pour tous les champs nutritionnels au-delà des macros
// de base (energie_kcal, proteines, glucides, lipides, fibres) et du sel.
//
// Utilisé par :
// - TodayPage.jsx     → sommer les totaux du jour
// - MealSection.jsx   → reproportionner au prorata quand le grammage change
// - MealsPage.jsx     → idem pour les repas types
// - AddFoodModal.jsx  → savoir quels champs récupérer sur l'aliment sélectionné
// - ManualPage.jsx    → générer le formulaire de saisie d'un aliment personnalisé
// - NutrientPanel.jsx → afficher les jauges vitamines/minéraux/sucres/gras

// ── Sucres détaillés (g / 100g) ──────────────────────────────────────────────
export const SUGAR_FIELDS = [
  { key: 'fructose',   label: 'Fructose',   unit: 'g' },
  { key: 'galactose',  label: 'Galactose',  unit: 'g' },
  { key: 'glucose',    label: 'Glucose',    unit: 'g' },
  { key: 'lactose',    label: 'Lactose',    unit: 'g' },
  { key: 'maltose',    label: 'Maltose',    unit: 'g' },
  { key: 'saccharose', label: 'Saccharose', unit: 'g' },
  { key: 'amidon',     label: 'Amidon',     unit: 'g' },
  { key: 'polyols',    label: 'Polyols',    unit: 'g' },
]

// ── Acides gras détaillés (g / 100g, cholestérol en mg) ─────────────────────
export const FAT_FIELDS = [
  { key: 'ag_monoinsatures',      label: 'Mono-insaturés',          unit: 'g' },
  { key: 'ag_polyinsatures',      label: 'Poly-insaturés',          unit: 'g' },
  { key: 'ag_4_0',                label: 'AG 4:0 (butyrique)',      unit: 'g' },
  { key: 'ag_6_0',                label: 'AG 6:0 (caproïque)',      unit: 'g' },
  { key: 'ag_8_0',                label: 'AG 8:0 (caprylique)',     unit: 'g' },
  { key: 'ag_10_0',               label: 'AG 10:0 (caprique)',      unit: 'g' },
  { key: 'ag_12_0',               label: 'AG 12:0 (laurique)',      unit: 'g' },
  { key: 'ag_14_0',               label: 'AG 14:0 (myristique)',    unit: 'g' },
  { key: 'ag_16_0',               label: 'AG 16:0 (palmitique)',    unit: 'g' },
  { key: 'ag_18_0',               label: 'AG 18:0 (stéarique)',     unit: 'g' },
  { key: 'ag_18_1_oleique',       label: 'Oméga-9 (oléique)',       unit: 'g' },
  { key: 'ag_18_2_linoleique',    label: 'Oméga-6 (linoléique)',    unit: 'g' },
  { key: 'ag_18_3_ala',           label: 'Oméga-3 (ALA)',           unit: 'g' },
  { key: 'ag_20_4_arachidonique', label: 'Oméga-6 (arachidonique)', unit: 'g' },
  { key: 'ag_20_5_epa',           label: 'Oméga-3 (EPA)',           unit: 'g' },
  { key: 'ag_22_6_dha',           label: 'Oméga-3 (DHA)',           unit: 'g' },
  { key: 'cholesterol',           label: 'Cholestérol',             unit: 'mg' },
]

// ── Vitamines avec jauge (ref = RNP/AS adulte indicatif ANSES, non personnalisé ; lss = limite de sécurité si connue) ──
// `short` = libellé compact (lettre/chiffre) utilisé dans les pastilles où la place manque (ex. carte complément alimentaire).
export const VITAMIN_FIELDS = [
  { key: 'vit_c',  label: 'Vitamine C',          short: 'C',   ref: 110,  lss: 1000, unit: 'mg', color: 'var(--green)'  },
  { key: 'vit_d',  label: 'Vitamine D',          short: 'D',   ref: 15,   lss: 100,  unit: 'µg', color: 'var(--amber)'  },
  { key: 'vit_e_totale', sumKeys: ['vit_e_totale', 'vit_e'], label: 'Vitamine E', short: 'E', ref: 13, lss: 300, unit: 'mg', color: 'var(--blue)' },
  { key: 'vit_k1', sumKeys: ['vit_k1', 'vit_k2'], label: 'Vitamine K', short: 'K', ref: 79, lss: null, unit: 'µg', color: 'var(--purple)' },
  { key: 'vit_b1', label: 'Vitamine B1',         short: 'B1',  ref: 1.3,  lss: null, unit: 'mg', color: 'var(--coral)'  },
  { key: 'vit_b2', label: 'Vitamine B2',         short: 'B2',  ref: 1.6,  lss: null, unit: 'mg', color: 'var(--amber)'  },
  { key: 'vit_b3', label: 'Vitamine B3',         short: 'B3',  ref: 14,   lss: 900,  unit: 'mg', color: 'var(--coral)'  },
  { key: 'vit_b5', label: 'Vitamine B5',         short: 'B5',  ref: 5,    lss: null, unit: 'mg', color: 'var(--green)'  },
  { key: 'vit_b6', label: 'Vitamine B6',         short: 'B6',  ref: 1.7,  lss: 25,   unit: 'mg', color: 'var(--blue)'   },
  { key: 'folates', sumKeys: ['folates', 'folates_intrinseques'], label: 'Folates (B9)', short: 'B9', ref: 330, lss: 1000, unit: 'µg', color: 'var(--purple)' },
  { key: 'vit_b12',label: 'Vitamine B12',        short: 'B12', ref: 4,    lss: null, unit: 'µg', color: 'var(--purple)' },
  { key: 'vit_a',  label: 'Vitamine A',          short: 'A',   ref: 650,  lss: 3000, unit: 'µg', color: 'var(--coral)'  },
]

// ── Minéraux avec jauge ───────────────────────────────────────────────────────
// `short` = 3 premières lettres, utilisé dans les pastilles où la place manque.
export const MINERAL_FIELDS = [
  { key: 'calcium',   label: 'Calcium',   short: 'Cal', ref: 950,  lss: 2500, unit: 'mg', color: 'var(--blue)'  },
  { key: 'fer',       label: 'Fer',       short: 'Fer', ref: 16,   lss: 40,   unit: 'mg', color: 'var(--coral)' },
  { key: 'magnesium', label: 'Magnésium', short: 'Mag', ref: 300,  lss: 2500, unit: 'mg', color: 'var(--green)' },
  { key: 'potassium', label: 'Potassium', short: 'Pot', ref: 3500, lss: null, unit: 'mg', color: 'var(--amber)' },
  { key: 'zinc',      label: 'Zinc',      short: 'Zin', ref: 11,   lss: 25,   unit: 'mg', color: 'var(--coral)' },
  { key: 'sodium',    label: 'Sodium',    short: 'Sod', ref: 2000, lss: 2300, unit: 'mg', color: 'var(--amber)', limite: true },
  { key: 'sel',       label: 'Sel',       short: 'Sel', ref: 5,    lss: 8,    unit: 'g',  color: 'var(--coral)', limite: true },
  { key: 'chlorure',  label: 'Chlorure',  short: 'Chl', ref: 3100, lss: null, unit: 'mg', color: 'var(--blue)'  },
  { key: 'cuivre',    label: 'Cuivre',    short: 'Cui', ref: 1.5,  lss: 5,    unit: 'mg', color: 'var(--coral)' },
  { key: 'iode',      label: 'Iode',      short: 'Iod', ref: 150,  lss: 600,  unit: 'µg', color: 'var(--purple)'},
  { key: 'manganese', label: 'Manganèse', short: 'Man', ref: 3,    lss: null, unit: 'mg', color: 'var(--green)' },
  { key: 'phosphore', label: 'Phosphore', short: 'Pho', ref: 550,  lss: null, unit: 'mg', color: 'var(--blue)'  },
  { key: 'selenium',  label: 'Sélénium',  short: 'Sél', ref: 70,   lss: 300,  unit: 'µg', color: 'var(--amber)' },
]

// Sous-détails sans jauge dédiée (déjà couverts par une valeur "totale" ci-dessus :
// rétinol/bêta-carotène ⊂ vit_a, D2/D3 ⊂ vit_d, K2 ⊂ vit_k1, folates intrinsèques/acide
// folique ⊂ folates) — on les stocke quand même pour qui veut le détail brut, juste
// affichés en simple liste, pas en jauge %RNP.
export const DETAIL_ONLY_FIELDS = [
  { key: 'retinol',              label: 'Rétinol',                 unit: 'µg' },
  { key: 'beta_carotene',        label: 'Bêta-carotène',           unit: 'µg' },
  { key: 'vit_e',                label: 'Vitamine E (brute)',      unit: 'mg' },
  { key: 'vit_d2',               label: 'Vitamine D2',             unit: 'µg' },
  { key: 'vit_d3',               label: 'Vitamine D3',             unit: 'µg' },
  { key: 'vit_k2',               label: 'Vitamine K2',             unit: 'µg' },
  { key: 'folates_intrinseques', label: 'Folates intrinsèques',    unit: 'µg' },
  { key: 'acide_folique',        label: 'Acide folique (enrichi)', unit: 'µg' },
]

// Recommandation Anses : ne pas dépasser 100 g/j de sucres totaux chez l'adulte,
// hors lactose et galactose (sucres naturels du lait, non concernés par la limite).
// On calcule donc le total "pertinent" = sucres totaux − lactose − galactose.
// cf. rapport Anses « Actualisation des repères du PNNS : recommandations d'apport de sucres » (2016)
export const SUCRES_ANSES_REF = 100 // g/j

// Recommandations Anses sur les lipides — exprimées en % de l'apport énergétique (AE)
// et non en grammes absolus, car le besoin en lipides dépend de l'énergie totale
// consommée. cf. avis Anses 2010 "Actualisation des ANC pour les acides gras" (saisine 2006-SA-0359).
// 1 g de lipides ≈ 9 kcal — sert à convertir les grammes saisis en % AE du jour.
export const KCAL_PER_G_LIPIDES = 9
export const LIPIDES_AE_TARGET = { min: 35, max: 40 } // % AE recommandé (zone cible, pas un max strict)
export const AGS_AE_MAX = 12 // % AE max recommandé pour les AG saturés totaux

// "Acides gras saturés" garde son nom historique (acides_gras_satures) pour ne pas
// casser les données déjà en base — on l'ajoute manuellement à la liste plutôt que
// dans FAT_FIELDS pour ne pas dupliquer le libellé "Saturés" géré ailleurs.
export const SATURATED_FAT_KEY = 'acides_gras_satures'

// Liste à plat de TOUS les champs nutritionnels numériques (hors macros de base,
// gérées séparément partout) — base commune pour sommer les totaux et reproportionner
// au prorata du grammage sans dupliquer la liste dans 6 fichiers.
export const ALL_NUTRIENT_KEYS = Array.from(new Set([
  'sucres', 'sel', SATURATED_FAT_KEY,
  ...SUGAR_FIELDS.map(f => f.key),
  ...FAT_FIELDS.map(f => f.key),
  ...VITAMIN_FIELDS.map(f => f.key),
  ...MINERAL_FIELDS.map(f => f.key),
  ...DETAIL_ONLY_FIELDS.map(f => f.key),
]))

// ── scaleFood ────────────────────────────────────────────────────────────────
// Recalcule un aliment (valeurs pour 100 g — recherche Ciqual/OFF/custom/recette)
// à un grammage donné, et renvoie un objet directement persistable tel quel en
// entrée de journal (+ `meal`) ou en ligne d'ingrédient de recette.
//
// Source unique pour ce calcul, qui était dupliqué à l'identique dans
// AddFoodModal.confirm() et RecipeFormModal.IngredientSearch.confirm().
//
// `food` = objet tel que manipulé par FoodPicker (alim_nom, _source, alim_code/id,
// valeurs /100g, ALL_NUTRIENT_KEYS...).
export function scaleFood(food, qty_g) {
  const f = (parseFloat(qty_g) || 0) / 100
  const scaled = {
    food_name:   food.alim_nom || food.food_name,
    food_source: food._source || food.food_source || 'ciqual',
    food_ref_id: food.alim_code || food.id || food.food_ref_id || null,
    qty_g:        parseFloat(qty_g) || 0,
    energie_kcal: parseFloat(((food.energie_kcal || 0) * f).toFixed(1)),
    proteines:    parseFloat(((food.proteines    || 0) * f).toFixed(2)),
    glucides:     parseFloat(((food.glucides     || 0) * f).toFixed(2)),
    lipides:      parseFloat(((food.lipides      || 0) * f).toFixed(2)),
    fibres:       parseFloat(((food.fibres       || 0) * f).toFixed(2)),
  }
  for (const key of ALL_NUTRIENT_KEYS) {
    const raw = food[key]
    scaled[key] = raw != null ? parseFloat((raw * f).toFixed(4)) : null
  }
  return scaled
}

// ── Répartition des objectifs par repas ──────────────────────────────────────
// Utilisé par : TodayPage.jsx (affichage compact par MealSection) et
// ProfilePage.jsx (édition des objectifs par repas).
//
// Bases utilisées :
// - Calories : réparties selon des repères usuels en nutrition (proches des
//   habitudes françaises type PNNS/ANSES) à défaut de norme physiologique
//   stricte imposant une répartition précise entre repas.
// - Protéines : réparties à parts EGALES entre les 3 repas principaux plutôt
//   qu'au prorata des calories. La recherche sur la synthèse protéique
//   musculaire (Mamerow et al. 2014, "Dietary Protein Distribution Positively
//   Influences 24-h Muscle Protein Synthesis" ; Moore et al. 2012) montre
//   qu'un apport protéique réparti régulièrement sur la journée (~0.3-0.4
//   g/kg/repas) stimule davantage la synthèse protéique sur 24h qu'une
//   répartition inégale, même à apport total identique.
// - Glucides/lipides : pas de consensus scientifique imposant une répartition
//   précise par repas → réparti simplement au prorata de la part calorique
//   de chaque repas.
//
// Toute valeur peut être surchargée manuellement par l'utilisateur via
// settings.meal_overrides = { [nomDuRepas]: { kcal?, prot?, gluc?, lip? } }.
// Une valeur absente (null/undefined) dans l'override retombe sur le calcul auto.

export const MEALS_ORDER = ['Petit-déjeuner', 'Déjeuner', 'Dîner', 'Collation']

// Part calorique de base de chaque repas (repères PNNS/ANSES).
// Sert de poids RELATIF pour redistribuer le budget restant entre les repas
// actifs non verrouillés — ce n'est donc pas un % fixe mais un ratio de priorité.
export const MEAL_KCAL_SHARE = {
  'Petit-déjeuner': 0.25,
  'Déjeuner':       0.35,
  'Dîner':          0.30,
  'Collation':      0.10,
}

// Defaults utilisés quand le champ meal_enabled est absent de settings.
export const MEAL_ENABLED_DEFAULTS = {
  'Petit-déjeuner': true,
  'Déjeuner':       true,
  'Dîner':          true,
  'Collation':      true,
  'Compléments':    true,   // section compléments alimentaires (pas un repas, pas de calcul kcal/macros)
}

// Part "collation" sur les protéines quand la collation est active.
const COLLATION_PROT_SHARE = 0.10

// ── computeMealTargets ────────────────────────────────────────────────────────
// Logique de redistribution :
//
// CALORIES
//   1. On part du budget total (goal_kcal).
//   2. On soustrait les repas actifs avec une kcal verrouillée manuellement.
//   3. Le budget restant est distribué entre les repas actifs en mode "auto",
//      au prorata de leurs poids de base (MEAL_KCAL_SHARE) normalisés.
//   → Désactiver un repas libère son budget vers les repas auto actifs.
//   → Fixer manuellement la kcal d'un repas fixe sa valeur et les autres auto
//     s'ajustent pour consommer exactement le budget restant.
//
// PROTÉINES
//   Réparties à parts égales entre les repas principaux actifs (science : cf.
//   Mamerow et al. 2014). La collation (si active) reçoit sa part fixe
//   (10% du total) ; le reste va à parts égales sur les repas principaux actifs.
//   Chaque valeur peut être verrouillée individuellement.
//
// GLUCIDES / LIPIDES
//   Distribués au prorata de la part calorique effective de chaque repas
//   (=kcal du repas / total kcal actif), sauf surcharge manuelle.

export function computeMealTargets(settings) {
  const overrides  = settings?.meal_overrides || {}
  const enabledMap = { ...MEAL_ENABLED_DEFAULTS, ...(settings?.meal_enabled || {}) }

  const kcalGoal = settings?.goal_kcal    || 0
  const protGoal = settings?.goal_proteines || 0
  const glucGoal = settings?.goal_glucides  || 0
  const lipGoal  = settings?.goal_lipides   || 0

  const activeMeals = MEALS_ORDER.filter(m => enabledMap[m])

  // ── 1. Calories ──────────────────────────────────────────────────────────
  const kcalLocked    = activeMeals.filter(m => overrides[m]?.kcal != null)
  const kcalAuto      = activeMeals.filter(m => overrides[m]?.kcal == null)
  const fixedKcalSum  = kcalLocked.reduce((s, m) => s + overrides[m].kcal, 0)
  const remainingKcal = Math.max(0, kcalGoal - fixedKcalSum)
  const autoWeightSum = kcalAuto.reduce((s, m) => s + MEAL_KCAL_SHARE[m], 0)

  const mealKcal = {}
  for (const meal of MEALS_ORDER) {
    if (!enabledMap[meal]) { mealKcal[meal] = 0; continue }
    if (overrides[meal]?.kcal != null) {
      mealKcal[meal] = overrides[meal].kcal
    } else {
      const w = autoWeightSum > 0 ? MEAL_KCAL_SHARE[meal] / autoWeightSum : 0
      mealKcal[meal] = remainingKcal * w
    }
  }

  // ── 2. Protéines ─────────────────────────────────────────────────────────
  const collationActive      = enabledMap['Collation']
  const collationProtBudget  = collationActive ? protGoal * COLLATION_PROT_SHARE : 0
  const mainMealsActive      = activeMeals.filter(m => m !== 'Collation')
  const mainProtBudget       = protGoal - collationProtBudget

  // Parmi les repas principaux actifs : part égale, sauf ceux verrouillés
  const protLockedMain  = mainMealsActive.filter(m => overrides[m]?.prot != null)
  const protAutoMain    = mainMealsActive.filter(m => overrides[m]?.prot == null)
  const fixedMainProt   = protLockedMain.reduce((s, m) => s + overrides[m].prot, 0)
  const remainingMainProt = Math.max(0, mainProtBudget - fixedMainProt)
  const protPerAutoMain = protAutoMain.length > 0 ? remainingMainProt / protAutoMain.length : 0

  // Collation protéines
  const collationProtFinal = collationActive
    ? (overrides['Collation']?.prot ?? collationProtBudget)
    : 0

  // ── 3. Glucides & Lipides (prorata kcal) ────────────────────────────────
  const totalActiveKcal = activeMeals.reduce((s, m) => s + mealKcal[m], 0) || 1

  // ── Assemblage ───────────────────────────────────────────────────────────
  const targets = {}
  for (const meal of MEALS_ORDER) {
    if (!enabledMap[meal]) {
      targets[meal] = { kcal: 0, prot: 0, gluc: 0, lip: 0, enabled: false,
        isAuto: { kcal: true, prot: true, gluc: true, lip: true } }
      continue
    }

    const ov       = overrides[meal] || {}
    const kcalVal  = mealKcal[meal]
    const kcalRatio = kcalVal / totalActiveKcal

    let prot
    if (meal === 'Collation') prot = collationProtFinal
    else prot = ov.prot != null ? ov.prot : protPerAutoMain

    const gluc = ov.gluc != null ? ov.gluc : glucGoal * kcalRatio
    const lip  = ov.lip  != null ? ov.lip  : lipGoal  * kcalRatio

    targets[meal] = {
      kcal: Math.round(kcalVal),
      prot: Math.round(prot),
      gluc: Math.round(gluc),
      lip:  Math.round(lip),
      enabled: true,
      isAuto: {
        kcal: ov.kcal == null,
        prot: ov.prot == null,
        gluc: ov.gluc == null,
        lip:  ov.lip  == null,
      },
    }
  }
  return targets
}

// ── computeCalorieNeeds ──────────────────────────────────────────────────────
// Estimation des besoins caloriques (BMR + TDEE) via la formule de
// Mifflin-St Jeor, la plus fiable en usage général (référence utilisée par
// ProfilePage.jsx pour le calculateur "besoins caloriques").
//
//   BMR (homme)  = 10×poids(kg) + 6,25×taille(cm) − 5×âge + 5
//   BMR (femme)  = 10×poids(kg) + 6,25×taille(cm) − 5×âge − 161
//   TDEE = BMR × multiplicateur d'activité
//
// Pour perte/prise, l'ajustement kcal n'est pas un forfait fixe : il est
// dérivé du poids objectif et de la durée choisis par l'utilisatrice, via
// l'équivalence ≈ 7700 kcal par kg de masse grasse (référence usuelle) :
//   ajustement/jour = (poids_objectif − poids_actuel) × 7700 / (durée_semaines × 7)

export const ACTIVITY_LEVELS = [
  { key: 'sedentaire', mult: 1.2,   label: 'Sédentaire',           desc: 'Peu ou pas d’exercice, travail assis' },
  { key: 'leger',      mult: 1.375, label: 'Légèrement actif',     desc: 'Sport léger 1 à 3 j/semaine' },
  { key: 'modere',     mult: 1.55,  label: 'Modérément actif',     desc: 'Sport modéré 3 à 5 j/semaine' },
  { key: 'actif',      mult: 1.725, label: 'Très actif',           desc: 'Sport intense 6 à 7 j/semaine' },
  { key: 'tres_actif', mult: 1.9,   label: 'Extrêmement actif',    desc: 'Sport quotidien + travail physique' },
]

const KCAL_PER_KG = 7700 // équivalence énergétique usuelle d'1 kg de masse grasse

// `maxSafePaceKg` : rythme hebdomadaire au-delà duquel on avertit (perte trop
// rapide = risque de fonte musculaire, prise trop rapide = surtout du gras).
export const CALORIE_OBJECTIVES = [
  { key: 'perte',    label: 'Perte de poids',   protPerKg: 2.0, fatShare: 0.25, maxSafePaceKg: 1 },
  { key: 'maintien', label: 'Maintien',         protPerKg: 1.6, fatShare: 0.30, maxSafePaceKg: null },
  { key: 'prise',    label: 'Prise de muscle',  protPerKg: 1.8, fatShare: 0.25, maxSafePaceKg: 0.5 },
]

// `sexe` : 'H' ou 'F'. Retourne null si sexe/âge/taille/poids manquent.
// Pour perte/prise, sans `objectiveWeightKg`+`objectiveWeeks` renseignés,
// retourne quand même bmr/tdee mais targetKcal/macros/paceKgPerWeek à null
// (rien à appliquer tant que l'objectif de poids n'est pas précisé).
export function computeCalorieNeeds({ sexe, age, tailleCm, poidsKg, activityKey, objectiveKey, objectiveWeightKg, objectiveWeeks }) {
  if (!sexe || !age || !tailleCm || !poidsKg) return null
  const activity  = ACTIVITY_LEVELS.find(a => a.key === activityKey) || ACTIVITY_LEVELS[1]
  const objective = CALORIE_OBJECTIVES.find(o => o.key === objectiveKey) || CALORIE_OBJECTIVES[1]

  const bmr = 10 * poidsKg + 6.25 * tailleCm - 5 * age + (sexe === 'H' ? 5 : -161)
  const tdee = bmr * activity.mult

  let delta = 0
  let paceKgPerWeek = null
  let unsafePace = false
  if (objective.key !== 'maintien') {
    if (!objectiveWeightKg || !objectiveWeeks) {
      return { bmr: Math.round(bmr), tdee: Math.round(tdee), targetKcal: null, paceKgPerWeek: null, unsafePace: false, macros: null }
    }
    const diffKg = objectiveWeightKg - poidsKg
    paceKgPerWeek = diffKg / objectiveWeeks
    delta = (diffKg * KCAL_PER_KG) / (objectiveWeeks * 7)
    unsafePace = objective.maxSafePaceKg != null && Math.abs(paceKgPerWeek) > objective.maxSafePaceKg
  }

  const targetKcal = Math.max(1200, tdee + delta)
  const prot = objective.protPerKg * poidsKg
  const lip  = (targetKcal * objective.fatShare) / 9
  const gluc = Math.max(0, (targetKcal - prot * 4 - lip * 9) / 4)
  const fib  = Math.max(25, Math.round((targetKcal / 1000) * 14))

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    targetKcal: Math.round(targetKcal),
    paceKgPerWeek,
    unsafePace,
    macros: {
      goal_kcal: Math.round(targetKcal),
      goal_proteines: Math.round(prot),
      goal_glucides: Math.round(gluc),
      goal_lipides: Math.round(lip),
      goal_fibres: fib,
    },
  }
}

// ── computeTotals ────────────────────────────────────────────────────────
// Somme les entrées `journal` (ou tout tableau d'objets shape scaleFood())
// en un objet de totaux { kcal, prot, gluc, lip, fib, ...ALL_NUTRIENT_KEYS }.
// Extrait de TodayPage.jsx (DaySlot) pour être réutilisé tel quel par le
// calendrier nutritionnel (DayRecapPanel) — une seule source de vérité pour
// ne jamais avoir deux totaux qui divergent entre pages.
export function computeTotals(entries) {
  const t = { kcal: 0, prot: 0, gluc: 0, lip: 0, fib: 0 }
  for (const key of ALL_NUTRIENT_KEYS) t[key] = 0
  for (const e of entries || []) {
    t.kcal += e.energie_kcal || 0
    t.prot += e.proteines || 0
    t.gluc += e.glucides || 0
    t.lip  += e.lipides || 0
    t.fib  += e.fibres || 0
    for (const key of ALL_NUTRIENT_KEYS) t[key] += e[key] || 0
  }
  return t
}

// ── getDayStatus ─────────────────────────────────────────────────────────
// Statut couleur d'un jour pour le calendrier nutritionnel :
//   'none' — aucune entrée journal ce jour-là → gris
//   'ok'   — calories à ±15% de l'objectif ET chaque macro à ±30% → vert
//   'off'  — les calories ou une macro sortent de leur bande → rouge
// Deux tolérances : serrée sur les calories (le cœur du suivi), plus lâche sur
// protéines / glucides / lipides qui servent surtout de garde-fou « rien
// d'aberrant ». Une macro dont l'objectif n'est pas défini (0) empêche le vert.
export const DAY_STATUS_TOLERANCE = 0.15        // calories
export const DAY_STATUS_MACRO_TOLERANCE = 0.30  // protéines / glucides / lipides

export function getDayStatus(totals, settings, hasEntries) {
  if (!hasEntries) return 'none'
  const within = (val, goal, tol) => goal > 0 && Math.abs(val - goal) / goal <= tol
  const ok =
    within(totals.kcal, settings?.goal_kcal, DAY_STATUS_TOLERANCE) &&
    within(totals.prot, settings?.goal_proteines, DAY_STATUS_MACRO_TOLERANCE) &&
    within(totals.gluc, settings?.goal_glucides, DAY_STATUS_MACRO_TOLERANCE) &&
    within(totals.lip,  settings?.goal_lipides,  DAY_STATUS_MACRO_TOLERANCE)
  return ok ? 'ok' : 'off'
}